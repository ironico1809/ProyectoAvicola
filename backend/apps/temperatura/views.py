import random
import os
import requests as http_requests

from django.utils import timezone
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.galpones.models import Galpon
from apps.core.mixins import TenantSafeView
from apps.temperatura.models import TemperaturaGalpon, PrediccionTemperatura
from apps.temperatura.prediccion_service import predecir_temperatura_galpon
from apps.temperatura.sensor_virtual_service import (
    entrenar_sensor_virtual,
    guardar_modelo_entrenado,
    predecir_sensor_virtual,
)
from apps.temperatura.serializers import (
    TemperaturaGalponSerializer,
    PrediccionTemperaturaSerializer,
)
from apps.bitacora.utils import registrar_evento

# ─────────────────────────────────────────────────────────────────────────────
# WeatherManager: gestiona la base real de temperatura por galpón
# ─────────────────────────────────────────────────────────────────────────────

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")


class WeatherManager:
    """
    Gestiona el estado del monitoreo meteorológico por galpón.

    Cada galpón tiene su propia base de temperatura real obtenida de
    OpenWeatherMap. A partir de esa base se aplica una fluctuación
    aleatoria pequeña para simular variaciones de sensor.
    """

    def __init__(self):
        # { galpon_id: { base_temp, base_humidity } }
        self._bases: dict = {}
        # { galpon_id: { temp, humidity } }  — overrides por galpón
        self._manual_overrides: dict = {}

    def fetch_real_base(self, galpon_id: int, lat: float, lon: float) -> dict:
        """
        Llama a OpenWeatherMap UNA SOLA VEZ para obtener la temperatura
        real del lugar y la guarda como base para ese galpón.
        """
        url = (
            f"https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
        )
        try:
            resp = http_requests.get(url, timeout=5)
            data = resp.json()
            base_temp = float(data["main"]["temp"])
            base_humidity = float(data["main"]["humidity"])
        except Exception:
            # Valores de respaldo si falla la conexión
            base_temp = 28.0
            base_humidity = 60.0

        self._bases[galpon_id] = {
            "base_temp": base_temp,
            "base_humidity": base_humidity,
        }
        return {"base_temp": base_temp, "base_humidity": base_humidity}

    def get_current_data(self, galpon_id: int) -> dict:
        """
        Devuelve la temperatura actual para un galpón.

        - Si ese galpón tiene un override manual, lo devuelve.
        - Si no, aplica fluctuación ±0.2°C sobre la base real.
        """
        if galpon_id in self._manual_overrides:
            override = self._manual_overrides[galpon_id]
            return {
                "temp": override["temp"],
                "humidity": override["humidity"],
                "source": "manual_override",
            }

        if galpon_id not in self._bases:
            temp = generar_temperatura_simulada()
            return {"temp": temp, "humidity": 60.0, "source": "simulated_fallback"}

        entry = self._bases[galpon_id]
        entry["base_temp"] += random.uniform(-0.2, 0.2)
        entry["base_humidity"] += random.uniform(-0.5, 0.5)
        return {
            "temp": round(entry["base_temp"], 2),
            "humidity": round(entry["base_humidity"], 1),
            "source": "simulated_real_base",
        }

    def set_manual_override(self, galpon_id: int, temp: float, humidity: float) -> None:
        """Fuerza un valor para un galpón específico."""
        self._manual_overrides[galpon_id] = {"temp": temp, "humidity": humidity}

    def clear_manual_override(self, galpon_id: int) -> None:
        """Elimina el override de un galpón, volviendo a la simulación."""
        self._manual_overrides.pop(galpon_id, None)

    def has_base(self, galpon_id: int) -> bool:
        return galpon_id in self._bases


# Instancia global (vive mientras el proceso Django esté activo)
weather_service = WeatherManager()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def calcular_estado_temperatura(temperatura):
    """
    Calcula el estado de la temperatura.

    Regla del sistema:
    - Menor a 24°C: FRIO
    - Entre 24°C y 34°C: NORMAL
    - Mayor a 34°C: CALOR
    """
    temperatura = float(temperatura)

    if temperatura < 24:
        return 'FRIO'

    if temperatura > 34:
        return 'CALOR'

    return 'NORMAL'


def generar_temperatura_simulada():
    """
    Genera una temperatura simulada según la hora del día.
    """
    hora_actual = timezone.localtime().hour

    if hora_actual >= 20 or hora_actual < 6:
        temperatura = random.uniform(22, 27)
    elif 6 <= hora_actual < 12:
        temperatura = random.uniform(24, 30)
    else:
        temperatura = random.uniform(30, 38)

    return round(temperatura, 2)


def obtener_mensaje_estado(estado):
    """Devuelve un mensaje entendible para el frontend."""
    if estado == 'FRIO':
        return 'Alerta de frío: la temperatura está por debajo del rango recomendado.'
    if estado == 'CALOR':
        return 'Alerta de calor: la temperatura está por encima del rango recomendado.'
    if estado == 'NORMAL':
        return 'Temperatura dentro del rango normal.'
    return 'Sin información de temperatura.'


# ─────────────────────────────────────────────────────────────────────────────
# Vistas existentes
# ─────────────────────────────────────────────────────────────────────────────

class TemperaturaTiempoRealView(APIView):
    """
    CU09 - Monitorear temperatura en tiempo real.

    Endpoint:
    GET /temperatura/tiempo-real/

    Usa el WeatherManager si el galpón tiene coordenadas registradas
    (base real de OpenWeather). Si no, cae en simulación por hora.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        galpones = Galpon.objects.filter(estado='activo').order_by('id')

        # Evitar que el polling del frontend llene la BD:
        # - Este endpoint se consulta en “tiempo real” (cada pocos segundos).
        # - NO debemos persistir un registro en cada GET.
        # Guardamos como máximo 1 registro simulado por galpón cada N segundos
        # (configurable por env var).
        try:
            persist_every_seconds = int(os.getenv("TEMPERATURA_PERSIST_EVERY_SECONDS", "1800"))
        except ValueError:
            persist_every_seconds = 1800

        now = timezone.now()

        data = []

        for galpon in galpones:
            clima = weather_service.get_current_data(galpon.id)
            temperatura = clima["temp"]
            humedad = clima.get("humidity", 60.0)
            estado = calcular_estado_temperatura(temperatura)

            # ¿Debemos persistir?
            # - Si no hay registro previo simulado
            # - o si pasó el intervalo
            # - o si cambió el estado (FRIO/NORMAL/CALOR)
            ultimo = (
                TemperaturaGalpon.objects
                .filter(galpon=galpon, fuente='SIMULADO')
                .order_by('-fecha_hora', '-id')
                .first()
            )

            should_persist = False
            if not ultimo:
                should_persist = True
            else:
                age_seconds = (now - ultimo.fecha_hora).total_seconds()
                if age_seconds >= persist_every_seconds:
                    should_persist = True
                elif str(ultimo.estado) != str(estado):
                    should_persist = True

            registro = None
            if should_persist:
                empresa_id = getattr(getattr(request, 'user', None), 'empresa_id', None)
                registro = TemperaturaGalpon.objects.create(
                    galpon=galpon,
                    temperatura=temperatura,
                    temperatura_externa=temperatura,
                    humedad_externa=humedad,
                    estado=estado,
                    fuente='SIMULADO',
                    empresa_id=empresa_id,
                )

            data.append({
                'id': registro.id if registro else (ultimo.id if ultimo else None),
                'id_galpon': galpon.id,
                'galpon_nombre': galpon.nombre,
                'temperatura': temperatura,
                'estado': estado,
                'fuente': 'SIMULADO',
                # “tiempo real” de la lectura (aunque no siempre se persista)
                'fecha_hora': now,
                'alerta': estado in ['FRIO', 'CALOR'],
                'mensaje': obtener_mensaje_estado(estado),
                'source': clima.get('source', 'simulated_fallback'),
            })

        return Response(data, status=status.HTTP_200_OK)


class TemperaturaManualCreateView(APIView):
    """
    CU08 - Registrar temperatura del galpón manualmente.

    Endpoint:
    POST /temperatura/manual/
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TemperaturaGalponSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        galpon = serializer.validated_data['galpon']
        temperatura = serializer.validated_data['temperatura']
        estado = calcular_estado_temperatura(temperatura)

        registro = TemperaturaGalpon.objects.create(
            galpon=galpon,
            temperatura=temperatura,
            estado=estado,
            fuente='MANUAL',
            usuario=request.user,
        )

        registrar_evento(
            request,
            accion='crear',
            modulo='temperatura',
            entidad='TemperaturaGalpon',
            entidad_id=registro.id,
            entidad_nombre=f"Temperatura {registro.temperatura}°C - {galpon.nombre}",
            detalle={
                'id_galpon': galpon.id,
                'galpon': galpon.nombre,
                'temperatura': registro.temperatura,
                'estado': registro.estado,
                'fuente': registro.fuente,
                'usuario_id': request.user.id,
                'usuario': request.user.nom_usuario,
            },
            usuario=request.user,
        )

        return Response(
            TemperaturaGalponSerializer(registro).data,
            status=status.HTTP_201_CREATED
        )


class TemperaturaHistorialView(APIView):
    """
    Consulta el historial de temperaturas.

    Endpoint:
    GET /temperatura/historial/

    Filtros opcionales: id_galpon, fecha_inicio, fecha_fin
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = TemperaturaGalpon.objects.select_related('galpon').all()

        id_galpon = request.query_params.get('id_galpon')
        fecha_inicio_raw = request.query_params.get('fecha_inicio')
        fecha_fin_raw = request.query_params.get('fecha_fin')

        if id_galpon:
            queryset = queryset.filter(galpon_id=id_galpon)

        if fecha_inicio_raw:
            fecha_inicio = parse_date(fecha_inicio_raw)
            if fecha_inicio is None:
                return Response(
                    {'fecha_inicio': 'Formato inválido. Use YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            queryset = queryset.filter(fecha_hora__date__gte=fecha_inicio)

        if fecha_fin_raw:
            fecha_fin = parse_date(fecha_fin_raw)
            if fecha_fin is None:
                return Response(
                    {'fecha_fin': 'Formato inválido. Use YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            queryset = queryset.filter(fecha_hora__date__lte=fecha_fin)

        # Por defecto devolvemos más registros (útil para rangos 3 meses / 1 año).
        # Para evitar respuestas gigantes, se limita con un máximo.
        limit_raw = request.query_params.get('limit', '2000')
        try:
            limit = int(limit_raw)
        except ValueError:
            return Response(
                {'limit': 'limit debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if limit < 1:
            limit = 1
        if limit > 10000:
            limit = 10000

        queryset = queryset.order_by('-fecha_hora', '-id')[:limit]

        return Response(
            TemperaturaGalponSerializer(queryset, many=True).data,
            status=status.HTTP_200_OK
        )


class TemperaturaUltimaPorGalponView(APIView):
    """
    Devuelve la última temperatura registrada por cada galpón.

    Endpoint:
    GET /temperatura/ultimas/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        galpones = Galpon.objects.all().order_by('id')
        data = []

        for galpon in galpones:
            ultimo = (
                TemperaturaGalpon.objects
                .filter(galpon=galpon)
                .order_by('-fecha_hora', '-id')
                .first()
            )

            if ultimo:
                data.append({
                    'id_galpon': galpon.id,
                    'galpon_nombre': galpon.nombre,
                    'temperatura': ultimo.temperatura,
                    'estado': ultimo.estado,
                    'fuente': ultimo.fuente,
                    'fecha_hora': ultimo.fecha_hora,
                    'alerta': ultimo.estado in ['FRIO', 'CALOR'],
                    'mensaje': obtener_mensaje_estado(ultimo.estado),
                })
            else:
                data.append({
                    'id_galpon': galpon.id,
                    'galpon_nombre': galpon.nombre,
                    'temperatura': None,
                    'estado': 'SIN_DATOS',
                    'fuente': None,
                    'fecha_hora': None,
                    'alerta': False,
                    'mensaje': 'Todavía no hay registros de temperatura.',
                })

        return Response(data, status=status.HTTP_200_OK)


class TemperaturaAlertasView(APIView):
    """
    Endpoint global para detectar alertas de temperatura.

    Endpoint:
    GET /temperatura/alertas/

    Lee el ÚLTIMO registro real de cada galpón activo.
    Solo incluye registros con estado FRIO o CALOR.
    """

    TEMP_MIN = 0
    TEMP_MAX = 60

    permission_classes = [IsAuthenticated]

    def get(self, request):
        galpones = Galpon.objects.filter(estado='activo').order_by('id')

        alertas = []

        for galpon in galpones:
            ultimo = (
                TemperaturaGalpon.objects
                .filter(galpon=galpon)
                .order_by('-fecha_hora', '-id')
                .first()
            )

            if not ultimo:
                continue

            temp_float = float(ultimo.temperatura)

            if temp_float < self.TEMP_MIN or temp_float > self.TEMP_MAX:
                continue

            estado_real = calcular_estado_temperatura(temp_float)

            if estado_real not in ('FRIO', 'CALOR'):
                continue

            alertas.append({
                'id': ultimo.id,
                'id_galpon': galpon.id,
                'galpon_nombre': galpon.nombre,
                'temperatura': ultimo.temperatura,
                'estado': estado_real,
                'fecha_hora': ultimo.fecha_hora,
                'alerta': True,
                'mensaje': obtener_mensaje_estado(estado_real),
            })

        return Response(alertas, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Nuevos endpoints: Reverse Geocoding + Simulación con base real
# ─────────────────────────────────────────────────────────────────────────────

class ReverseGeocodingView(APIView):
    """
    Convierte coordenadas (lat, lon) en un nombre de lugar legible.

    Endpoint:
    GET /temperatura/reverse-geocoding/?lat=-17.78&lon=-63.18

    La llamada a OpenWeather se hace desde el backend para no exponer
    la API key en el JavaScript del cliente.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')

        if not lat or not lon:
            return Response(
                {'error': 'Se requieren los parámetros lat y lon.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except ValueError:
            return Response(
                {'error': 'lat y lon deben ser números válidos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        url = (
            f"http://api.openweathermap.org/geo/1.0/reverse"
            f"?lat={lat_f}&lon={lon_f}&limit=1&appid={OPENWEATHER_API_KEY}"
        )

        try:
            resp = http_requests.get(url, timeout=5)
            data = resp.json()

            if data and isinstance(data, list) and len(data) > 0:
                lugar = data[0]
                nombre = lugar.get('name', '')
                estado_lugar = lugar.get('state', '')
                pais = lugar.get('country', '')
                partes = [p for p in [nombre, estado_lugar] if p]
                nombre_completo = ', '.join(partes)
                if pais:
                    nombre_completo += f' ({pais})'
            else:
                nombre_completo = 'Ubicación desconocida'

        except Exception as e:
            nombre_completo = 'Ubicación desconocida'

        return Response({
            'nombre': nombre_completo,
            'lat': lat_f,
            'lon': lon_f,
        }, status=status.HTTP_200_OK)


class SimulacionIniciarView(APIView):
    """
    Inicia el monitoreo con base real de OpenWeather para un galpón.

    Endpoint:
    POST /temperatura/simulacion/iniciar/

    Body: { "galpon_id": 1, "lat": -17.78, "lon": -63.18 }

    Llama a OpenWeather UNA SOLA VEZ y guarda la temperatura base
    en el WeatherManager global. Los siguientes polls de tiempo-real
    usarán esa base con fluctuación ±0.2°C.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        galpon_id = request.data.get('galpon_id')
        lat = request.data.get('lat')
        lon = request.data.get('lon')

        if not galpon_id or lat is None or lon is None:
            return Response(
                {'error': 'Se requieren galpon_id, lat y lon.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            galpon = Galpon.objects.get(pk=galpon_id)
        except Galpon.DoesNotExist:
            return Response(
                {'error': 'Galpón no encontrado.'},
                status=status.HTTP_404_NOT_FOUND
            )

        resultado = weather_service.fetch_real_base(
            galpon_id=galpon.id,
            lat=float(lat),
            lon=float(lon),
        )

        return Response({
            'status': 'Monitoreo iniciado con base real',
            'galpon': galpon.nombre,
            'base_temp': resultado['base_temp'],
            'base_humidity': resultado['base_humidity'],
        }, status=status.HTTP_200_OK)


class ClimaActualView(APIView):
    """
    Devuelve la temperatura actual del WeatherManager sin guardar en BD.

    Endpoint:
    GET /temperatura/clima/actual/?galpon_id=1

    Útil para el panel de operador que quiere ver el valor en tiempo real
    sin generar un registro nuevo en la base de datos.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        galpon_id_raw = request.query_params.get('galpon_id')

        if not galpon_id_raw:
            return Response(
                {'error': 'Se requiere el parámetro galpon_id.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            galpon_id = int(galpon_id_raw)
        except ValueError:
            return Response(
                {'error': 'galpon_id debe ser un número entero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        clima = weather_service.get_current_data(galpon_id)
        estado = calcular_estado_temperatura(clima['temp'])

        return Response({
            'galpon_id': galpon_id,
            'temp': clima['temp'],
            'humidity': clima['humidity'],
            'source': clima['source'],
            'estado': estado,
            'alerta': estado in ('FRIO', 'CALOR'),
            'mensaje': obtener_mensaje_estado(estado),
        }, status=status.HTTP_200_OK)


class ClimaManualOverrideView(APIView):
    """
    Fuerza un valor de temperatura en el WeatherManager para un galpón específico.

    Endpoint:
    POST /temperatura/clima/manual/

    Body activar:   { "galpon_id": 1, "temp": 35, "humidity": 70 }
    Body desactivar: { "galpon_id": 1, "desactivar": true }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        galpon_id_raw = request.data.get('galpon_id')
        desactivar = request.data.get('desactivar', False)

        if not galpon_id_raw:
            return Response(
                {'error': 'Se requiere galpon_id.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            galpon_id = int(galpon_id_raw)
        except (ValueError, TypeError):
            return Response(
                {'error': 'galpon_id debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if desactivar:
            weather_service.clear_manual_override(galpon_id)
            return Response(
                {'status': 'Override eliminado. Volviendo a simulación.'},
                status=status.HTTP_200_OK
            )

        temp = request.data.get('temp')
        humidity = request.data.get('humidity', 60)

        if temp is None:
            return Response(
                {'error': 'Se requiere el campo temp.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            temp_f = float(temp)
            humidity_f = float(humidity)
        except (ValueError, TypeError):
            return Response(
                {'error': 'temp y humidity deben ser números.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if temp_f < 0 or temp_f > 60:
            return Response(
                {'error': 'La temperatura debe estar entre 0°C y 60°C.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        weather_service.set_manual_override(galpon_id, temp_f, humidity_f)
        estado = calcular_estado_temperatura(temp_f)

        return Response({
            'status': 'Override activado para el galpón',
            'galpon_id': galpon_id,
            'temp': temp_f,
            'humidity': humidity_f,
            'estado': estado,
            'alerta': estado in ('FRIO', 'CALOR'),
            'mensaje': obtener_mensaje_estado(estado),
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# CU27: Predicción de variación de temperatura (IA)
# ─────────────────────────────────────────────────────────────────────────────


class PrediccionTemperaturaUltimaView(TenantSafeView):
    """Devuelve la última predicción generada para un galpón.

    Endpoint:
    GET /temperatura/prediccion/ultima/?galpon_id=1
    """

    permission_classes = [IsAuthenticated]
    queryset = PrediccionTemperatura.objects.select_related('galpon').all()

    def get(self, request):
        galpon_id_raw = request.query_params.get('galpon_id')

        if not galpon_id_raw:
            return Response(
                {'error': 'Se requiere el parámetro galpon_id.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            galpon_id = int(galpon_id_raw)
        except ValueError:
            return Response(
                {'error': 'galpon_id debe ser un número entero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pred = (
            self.get_queryset()
            .filter(galpon_id=galpon_id)
            .order_by('-fecha_hora', '-id')
            .first()
        )

        if not pred:
            return Response(
                {'error': 'Sin predicción registrada para este galpón.'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            PrediccionTemperaturaSerializer(pred).data,
            status=status.HTTP_200_OK
        )


class PrediccionTemperaturaUltimasView(TenantSafeView):
    """Devuelve la última predicción para cada galpón activo.

    Endpoint:
    GET /temperatura/prediccion/ultimas/
    """

    permission_classes = [IsAuthenticated]
    queryset = PrediccionTemperatura.objects.select_related('galpon').all()

    def get(self, request):
        galpones = self.filter_by_tenant(Galpon.objects.filter(estado='activo').order_by('id'))

        data = []
        for galpon in galpones:
            pred = (
                self.get_queryset()
                .filter(galpon=galpon)
                .order_by('-fecha_hora', '-id')
                .first()
            )
            if pred:
                data.append(PrediccionTemperaturaSerializer(pred).data)

        return Response(data, status=status.HTTP_200_OK)


class PrediccionTemperaturaGenerarView(TenantSafeView):
    """Genera y persiste una predicción para un galpón (manual/operativa).

    Endpoint:
    POST /temperatura/prediccion/generar/

    Body:
    { "galpon_id": 1, "horizonte_horas": 3, "ventana_horas": 24 }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        galpon_id_raw = request.data.get('galpon_id')
        if not galpon_id_raw:
            return Response(
                {'error': 'Se requiere galpon_id.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            galpon_id = int(galpon_id_raw)
        except (ValueError, TypeError):
            return Response(
                {'error': 'galpon_id debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            galpon = self.filter_by_tenant(Galpon.objects.all()).get(pk=galpon_id)
        except Galpon.DoesNotExist:
            return Response(
                {'error': 'Galpón no encontrado.'},
                status=status.HTTP_404_NOT_FOUND
            )

        horizonte_horas_raw = request.data.get('horizonte_horas', 3)
        # Por defecto usamos 90 días para tener suficiente histórico.
        # Para 1 año: ventana_horas=8760
        ventana_horas_raw = request.data.get('ventana_horas', 2160)

        try:
            horizonte_horas = int(horizonte_horas_raw)
            ventana_horas = int(ventana_horas_raw)
        except (ValueError, TypeError):
            return Response(
                {'error': 'horizonte_horas y ventana_horas deben ser enteros.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        resultado = predecir_temperatura_galpon(
            galpon_id=galpon.id,
            horizonte_horas=horizonte_horas,
            ventana_horas=ventana_horas,
            empresa_id=galpon.empresa_id,
        )

        if not resultado:
            return Response(
                {'error': 'No hay suficientes datos para generar una predicción.'},
                status=status.HTTP_409_CONFLICT
            )

        estado_predicho = calcular_estado_temperatura(resultado.temperatura_predicha)
        umbral_superado = estado_predicho in ('FRIO', 'CALOR')

        if umbral_superado:
            mensaje = (
                f"Alerta Predictiva: Se espera {('Frío' if estado_predicho == 'FRIO' else 'Calor')} "
                f"Extremo ({resultado.temperatura_predicha}°C) en {galpon.nombre} en {horizonte_horas}h."
            )
        else:
            mensaje = (
                f"Predicción: temperatura dentro de rango esperado "
                f"({resultado.temperatura_predicha}°C) en {galpon.nombre} en {horizonte_horas}h."
            )

        pred = PrediccionTemperatura.objects.create(
            galpon=galpon,
            empresa_id=galpon.empresa_id,
            horizonte_horas=horizonte_horas,
            ventana_horas=ventana_horas,
            temperatura_predicha=resultado.temperatura_predicha,
            estado_predicho=estado_predicho,
            confianza=resultado.confianza,
            puntos=resultado.puntos,
            umbral_superado=umbral_superado,
            mensaje=mensaje,
        )

        # Bitácora (auditoría)
        registrar_evento(
            request,
            accion='crear',
            modulo='temperatura',
            entidad='PrediccionTemperatura',
            entidad_id=pred.id,
            entidad_nombre=f"Predicción {galpon.nombre}",
            detalle={
                'galpon_id': galpon.id,
                'galpon': galpon.nombre,
                'horizonte_horas': horizonte_horas,
                'ventana_horas': ventana_horas,
                'temperatura_predicha': str(resultado.temperatura_predicha),
                'estado_predicho': estado_predicho,
                'confianza': resultado.confianza,
                'umbral_superado': umbral_superado,
            },
            usuario=request.user,
        )

        return Response(
            PrediccionTemperaturaSerializer(pred).data,
            status=status.HTTP_201_CREATED
        )


# ─────────────────────────────────────────────────────────────────────────────
# Sensor virtual inteligente (ML) — estimar temperatura interna sin sensores
# ─────────────────────────────────────────────────────────────────────────────


class SensorVirtualEntrenarView(TenantSafeView):
    """Entrena un modelo para estimar temperatura interna.

    Endpoint:
    POST /temperatura/sensor-virtual/entrenar/

    Body opcional:
    { "galpon_id": 1, "ventana_horas": 2160 }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        galpon_id_raw = request.data.get('galpon_id', None)
        ventana_horas_raw = request.data.get('ventana_horas', 2160)

        galpon_id = None
        if galpon_id_raw not in (None, ''):
            try:
                galpon_id = int(galpon_id_raw)
            except (ValueError, TypeError):
                return Response({'error': 'galpon_id debe ser entero.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ventana_horas = int(ventana_horas_raw)
        except (ValueError, TypeError):
            return Response({'error': 'ventana_horas debe ser entero.'}, status=status.HTTP_400_BAD_REQUEST)

        empresa_id = self.get_tenant_id()

        # Validar acceso a galpón si se especifica
        if galpon_id is not None:
            try:
                self.filter_by_tenant(Galpon.objects.all()).get(pk=galpon_id)
            except Galpon.DoesNotExist:
                return Response({'error': 'Galpón no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        resultado = entrenar_sensor_virtual(
            empresa_id=empresa_id,
            galpon_id=galpon_id,
            ventana_horas=ventana_horas,
        )

        if not resultado:
            return Response(
                {
                    'error': 'No hay suficientes datos para entrenar. Asegúrate de tener lecturas con temperatura_externa/humedad_externa.',
                    'tip': 'Usa `python manage.py seed_temperaturas --days 90 --interval-minutes 60 --clear` y luego reintenta.',
                },
                status=status.HTTP_409_CONFLICT
            )

        modelo = guardar_modelo_entrenado(
            empresa_id=empresa_id,
            galpon_id=galpon_id,
            ventana_horas=ventana_horas,
            resultado=resultado,
        )

        registrar_evento(
            request,
            accion='crear',
            modulo='temperatura',
            entidad='ModeloSensorVirtualTemperatura',
            entidad_id=modelo.id,
            entidad_nombre='Modelo Sensor Virtual',
            detalle={
                'galpon_id': galpon_id,
                'ventana_horas': ventana_horas,
                'r2': modelo.r2,
                'n_muestras': modelo.n_muestras,
                'features': modelo.feature_names,
            },
            usuario=request.user,
        )

        return Response(
            {
                'status': 'Modelo entrenado',
                'modelo_id': modelo.id,
                'galpon_id': galpon_id,
                'ventana_horas': modelo.ventana_horas,
                'r2': modelo.r2,
                'n_muestras': modelo.n_muestras,
                'features': modelo.feature_names,
            },
            status=status.HTTP_201_CREATED
        )


class SensorVirtualActualView(TenantSafeView):
    """Devuelve temperatura interna estimada por el modelo entrenado.

    Endpoint:
    GET /temperatura/sensor-virtual/actual/?galpon_id=1
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        galpon_id_raw = request.query_params.get('galpon_id')
        if not galpon_id_raw:
            return Response({'error': 'Se requiere galpon_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            galpon_id = int(galpon_id_raw)
        except ValueError:
            return Response({'error': 'galpon_id debe ser entero.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            galpon = self.filter_by_tenant(Galpon.objects.all()).get(pk=galpon_id)
        except Galpon.DoesNotExist:
            return Response({'error': 'Galpón no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        empresa_id = self.get_tenant_id()

        # Clima externo actual (proxy)
        clima = weather_service.get_current_data(galpon.id)
        temp_ext = float(clima.get('temp', 28.0))
        hum_ext = float(clima.get('humidity', 60.0))

        # Última temp interna registrada (fallback)
        ultimo = (
            self.filter_by_tenant(TemperaturaGalpon.objects.filter(galpon=galpon))
            .order_by('-fecha_hora', '-id')
            .first()
        )
        temp_prev = float(ultimo.temperatura) if ultimo else temp_ext

        pred = predecir_sensor_virtual(
            empresa_id=empresa_id,
            galpon_id=galpon.id,
            temp_externa=temp_ext,
            humedad_externa=hum_ext,
            temp_prev=temp_prev,
        )

        if not pred:
            return Response(
                {
                    'error': 'No existe un modelo entrenado o no es compatible.',
                    'tip': 'Entrena con POST /temperatura/sensor-virtual/entrenar/ y asegúrate de tener datos seed con clima externo.',
                },
                status=status.HTTP_409_CONFLICT
            )

        temp_est = float(pred['temperatura_estimada'])
        estado = calcular_estado_temperatura(temp_est)

        return Response(
            {
                'galpon_id': galpon.id,
                'galpon_nombre': galpon.nombre,
                'temp_externa': temp_ext,
                'humedad_externa': hum_ext,
                'temp_prev': temp_prev,
                'temperatura_estimada': temp_est,
                'estado': estado,
                'alerta': estado in ('FRIO', 'CALOR'),
                'mensaje': obtener_mensaje_estado(estado),
                'modelo': {
                    'modelo_id': pred['modelo_id'],
                    'r2': pred['r2'],
                    'n_muestras': pred['n_muestras'],
                    'ventana_horas': pred['ventana_horas'],
                    'features': pred['feature_names'],
                },
                'source': clima.get('source', 'unknown'),
            },
            status=status.HTTP_200_OK
        )
