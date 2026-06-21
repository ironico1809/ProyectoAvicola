import os
import pickle
try:
    import numpy as np
except ImportError:
    np = None
from django.utils import timezone
from datetime import timedelta
from django.db import models
from django.db.models import Avg, Sum

from apps.lotes.models import Lote
from apps.temperatura.models import TemperaturaGalpon
from apps.alimentacion.models import Alimentacion
from apps.mortandad.models import RegistroMortalidad, PrediccionMortalidad
from apps.sanitario.models import AlertaSanitaria

def obtener_valores_entrada_lote(lote):
    """
    Recopila y calcula en tiempo real los parámetros necesarios para la predicción de mortalidad.
    """
    # 1. Edad del lote
    edad_dias = (timezone.localdate() - lote.fecha_ingreso).days
    if edad_dias < 1:
        edad_dias = 1
        
    # 2. Temperatura y Humedad promedio en las últimas 24 horas en el galpón
    hace_24h = timezone.now() - timedelta(hours=24)
    clima_avg = TemperaturaGalpon.objects.filter(
        galpon=lote.galpon,
        fecha_hora__gte=hace_24h
    ).aggregate(Avg('temperatura'), Avg('humedad_externa'))
    
    avg_temp_val = clima_avg['temperatura__avg']
    avg_hum_val = clima_avg['humedad_externa__avg']
    
    # Fallback si no hay registros de temperatura/humedad
    if avg_temp_val is None:
        avg_temp = 25.0
    else:
        avg_temp = float(avg_temp_val)
        
    if avg_hum_val is None:
        avg_hum = 60.0
    else:
        avg_hum = float(avg_hum_val)
        
    # 3. Desviación de consumo de alimento
    hoy = timezone.localdate()
    
    # Buscar el último registro de alimentación de este lote
    ultimo_registro = Alimentacion.objects.filter(lote=lote).order_by('-fecha').first()
    
    if ultimo_registro:
        alimento_hoy = Alimentacion.objects.filter(
            lote=lote,
            fecha=ultimo_registro.fecha
        ).aggregate(Sum('cantidad_kg'))['cantidad_kg__sum'] or 0.0
    else:
        alimento_hoy = 0.0
        
    alimento_hoy = float(alimento_hoy)
    
    # Curva estándar teórica de consumo diario en kg por ave:
    kg_por_ave = 0.02 + 0.003 * edad_dias
    alimento_esperado = lote.cantidad_actual * kg_por_ave
    
    # Si no hay registros en absoluto para el lote, asumimos desviación 0 para no castigar falsamente a la IA con -100%
    if not ultimo_registro or alimento_esperado <= 0:
        desviacion = 0.0
    else:
        desviacion = ((alimento_hoy - alimento_esperado) / alimento_esperado) * 100.0
        # Clamping de seguridad
        desviacion = min(max(desviacion, -100.0), 50.0)
        
    # 4. Bajas en los últimos 3 días
    hace_3d = timezone.now() - timedelta(days=3)
    bajas_3d = RegistroMortalidad.objects.filter(
        lote=lote,
        fecha_hora__gte=hace_3d
    ).aggregate(Sum('cantidad'))['cantidad__sum'] or 0
    bajas_3d = int(bajas_3d)
    
    # 5. Alerta sanitaria pendiente activa
    alerta_activa = AlertaSanitaria.objects.filter(
        lote=lote,
        estado='Pendiente'
    ).exists()
    
    return {
        'edad_dias': edad_dias,
        'temperatura_promedio': avg_temp,
        'humedad_promedio': avg_hum,
        'desviacion_alimento': desviacion,
        'bajas_recientes': bajas_3d,
        'alerta_sanitaria': alerta_activa
    }

def predecir_mortalidad_lote(lote_id, empresa_id=None):
    """
    Ejecuta el modelo de IA para predecir el riesgo de mortalidad de un lote.
    Intenta cargar el archivo .pkl del modelo entrenado de sklearn, y si no está,
    utiliza el motor matemático fallback.
    """
    try:
        if empresa_id:
            lote = Lote.objects.get(pk=lote_id, empresa_id=empresa_id)
        else:
            lote = Lote.objects.get(pk=lote_id)
    except Lote.DoesNotExist:
        return None
        
    # Recopilar variables
    valores = obtener_valores_entrada_lote(lote)
    edad = valores['edad_dias']
    temp = valores['temperatura_promedio']
    hum = valores['humedad_promedio']
    feed_dev = valores['desviacion_alimento']
    bajas = valores['bajas_recientes']
    alerta = 1 if valores['alerta_sanitaria'] else 0
    
    # Cálculo de THI (Temperature-Humidity Index) simplificado
    thi = temp - (0.55 - (0.0055 * hum)) * (temp - 14.5)

    riesgo_porcentaje = 0.0
    modelo_cargado = False
    
    # Intentar usar el modelo entrenado (.pkl)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(current_dir, "modelo_mortalidad.pkl")
    
    if os.path.exists(model_path):
        try:
            with open(model_path, "rb") as f:
                model = pickle.load(f)
                
            # Formatear entrada para el modelo
            features = np.array([[edad, temp, feed_dev, bajas, alerta]])
            # Obtener probabilidad de clase 1 (alto riesgo)
            prob_high = model.predict_proba(features)[0][1]
            riesgo_porcentaje = round(float(prob_high * 100), 2)
            modelo_cargado = True
        except Exception as e:
            # Si hay algún problema, caemos en el fallback matemático
            pass
            
    # Motor matemático fallback en Python puro (reglas probabilísticas deterministas)
    if not modelo_cargado:
        riesgo_score = 0.03  # Base line
        
        # Cálculo de THI (Temperature-Humidity Index) simplificado
        # THI = T - [0.55 - (0.0055 * RH)] * (T - 14.5)
        # Un THI > 27 es estrés severo.
        thi = temp - (0.55 - (0.0055 * hum)) * (temp - 14.5)
        
        if thi > 28:
            riesgo_score += (thi - 28) * 0.08
        elif thi > 25:
            riesgo_score += (thi - 25) * 0.03
            
        # Estrés por temperatura fría extrema
        if temp < 18:
            riesgo_score += (18 - temp) * 0.02
            
        # Desviación de alimentación
        if feed_dev < -10:
            riesgo_score += abs(feed_dev + 10) * 0.012
            
        # Bajas previas acumuladas
        if bajas > 5:
            # Si el total de bajas de 3 días supera el 1% del lote, incrementa riesgo
            pct_bajas = (bajas / max(lote.cantidad_inicial, 1)) * 100.0
            riesgo_score += (pct_bajas * 0.5)
            
        if alerta:
            riesgo_score += 0.3
            
        riesgo_porcentaje = min(riesgo_score * 100, 100.0)
        riesgo_porcentaje = round(float(riesgo_porcentaje), 2)
        
    # Clasificar nivel de riesgo
    if riesgo_porcentaje < 20:
        nivel_riesgo = 'Bajo'
    elif riesgo_porcentaje < 60:
        nivel_riesgo = 'Medio'
    else:
        nivel_riesgo = 'Alto'
        
    # Generar factores clave estructurados para explicación UI
    factores_clave = [
        f"Edad: {edad} días",
        f"Temperatura prom. (24h): {temp:.1f}°C",
        f"Humedad prom. (24h): {hum:.1f}%",
        f"Índice de Estrés Térmico (THI): {thi:.1f}" if not modelo_cargado else "Análisis de Red Neuronal"
    ]
    if temp < 18:
        factores_clave.append(f"Estrés por frío: temperatura promedio reciente de {temp:.1f}°C")
        
    if feed_dev < -10:
        factores_clave.append(f"Bajo consumo de alimento: consumo {-feed_dev:.1f}% por debajo del estándar")
        
    if bajas > 0:
        factores_clave.append(f"Mortalidad reciente detectada: {bajas} bajas registradas en los últimos 3 días")
        
    if alerta == 1:
        factores_clave.append("Alerta sanitaria activa sin resolver en el lote")
        
    if edad <= 7:
        factores_clave.append("Período crítico de adaptación (flock joven)")
        
    # Generar recomendaciones
    recomendaciones = []
    if nivel_riesgo == 'Bajo':
        recomendaciones.append("Mantener el plan de manejo y bioseguridad estándar.")
        recomendaciones.append("Continuar el registro diario de alimentación y bajas.")
    elif nivel_riesgo == 'Medio':
        if thi > 25 or temp < 18:
            recomendaciones.append("Ajustar la ventilación, extractores o cortinas del galpón inmediatamente.")
        if feed_dev < -10:
            recomendaciones.append("Revisar el estado físico de los comederos y la calidad del alimento.")
        recomendaciones.append("Suministrar electrolitos o vitaminas en el agua de bebida para contrarrestar el estrés.")
        recomendaciones.append("Incrementar la frecuencia de inspecciones visuales en el galpón.")
    else:  # Alto
        recomendaciones.append("¡Atención Veterinaria Urgente! Contactar al médico veterinario de inmediato.")
        if thi > 28:
            recomendaciones.append("Activar sistemas de nebulización o refrigeración para mitigar el golpe de calor severo.")
        recomendaciones.append("Aislar de inmediato aves que muestren signos clínicos o postración.")
        recomendaciones.append("Revisar rigurosamente el suministro y la presión del agua en los bebederos.")
        recomendaciones.append("Suspender movimientos estresantes o vacunaciones hasta estabilizar el lote.")
        
    # Convertir lista de strings a formato de objeto para soportar estados de CU29
    recomendaciones_db = []
    for idx, r_text in enumerate(recomendaciones):
        recomendaciones_db.append({
            "id": idx + 1,
            "texto": r_text,
            "estado": "Pendiente"
        })

    # Crear y guardar registro de predicción en BD
    pred = PrediccionMortalidad.objects.create(
        lote=lote,
        empresa_id=empresa_id if empresa_id else 1,
        riesgo_porcentaje=riesgo_porcentaje,
        nivel_riesgo=nivel_riesgo,
        temperatura_promedio=temp,
        humedad_promedio=hum,
        edad_dias=edad,
        desviacion_alimento=feed_dev,
        bajas_recientes=bajas,
        alerta_sanitaria=valores['alerta_sanitaria'],
        factores_clave=factores_clave,
        recomendaciones=recomendaciones_db,
    )
    
    return pred
