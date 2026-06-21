from __future__ import annotations

import random
import math
from datetime import datetime, timedelta, date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.galpones.models import Galpon
from apps.lotes.models import Lote, ControlCalidad, CurvaCrecimientoEstandar
from apps.alimentacion.models import Alimentacion
from apps.insumos.models import Proveedor, Insumo, MovimientoAlmacen, ControlSanitario
from apps.sanitario.models import AlertaSanitaria
from apps.mortandad.models import RegistroMortalidad, PrediccionMortalidad
from apps.temperatura.models import TemperaturaGalpon, PrediccionTemperatura
from apps.ventas.models import Cliente, VentaLote
from apps.usuarios.models import Usuario
from apps.bitacora.models import BitacoraEvento

from apps.temperatura.views import calcular_estado_temperatura
from apps.temperatura.prediccion_service import predecir_temperatura_galpon
from apps.mortandad.prediccion_service import predecir_mortalidad_lote


def get_peso_estandar(edad_dias):
    points = [
        (1, 0.042), (3, 0.080), (5, 0.130), (7, 0.190), (10, 0.310),
        (14, 0.520), (17, 0.720), (21, 0.980), (24, 1.200), (28, 1.520),
        (31, 1.800), (35, 2.150), (38, 2.450), (42, 2.800), (45, 3.050),
        (49, 3.400), (55, 4.000)
    ]
    if edad_dias <= 1:
        return Decimal('0.042')
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i+1]
        if x1 <= edad_dias <= x2:
            val = y1 + (y2 - y1) * (edad_dias - x1) / (x2 - x1)
            return Decimal(str(round(val, 4)))
    return Decimal('4.000')


def seed_alimentacion(lote, dias_crianza, insumo_iniciador, insumo_crecimiento, insumo_finalizador, empresa, lote_id_especial_enfermo=None):
    """Genera registros de alimentación diaria coherentes para un lote."""
    registros = []
    for d in range(1, dias_crianza + 1):
        fecha_reg = lote.fecha_ingreso + timedelta(days=d - 1)
        if d <= 14:
            ins = insumo_iniciador
        elif d <= 28:
            ins = insumo_crecimiento
        else:
            ins = insumo_finalizador

        kg_por_ave = 0.02 + 0.003 * d
        cant_aves = lote.cantidad_inicial

        esperado = cant_aves * kg_por_ave

        if lote_id_especial_enfermo and lote.id_lote == lote_id_especial_enfermo and d >= 26:
            desv = random.uniform(0.53, 0.57)
            obs = "Consumo severamente afectado por cuadro respiratorio"
        else:
            desv = random.uniform(0.97, 1.03)
            obs = "Consumo diario dentro de parámetros normales"

        cant_real = round(esperado * desv, 2)
        registros.append(Alimentacion(
            lote=lote,
            insumo=ins,
            fecha=fecha_reg,
            cantidad_kg=Decimal(str(cant_real)),
            tipo_alimento=ins.nombre,
            observacion=obs,
            empresa=empresa
        ))
    Alimentacion.objects.bulk_create(registros)


def seed_mortalidad_normal(lote, dias_ciclo, empresa, now):
    """Genera bajas naturales esporádicas (0-1 por evento) durante el ciclo."""
    num_bajas = max(1, int(dias_ciclo * lote.cantidad_inicial * 0.0015))
    dias_con_bajas = random.sample(range(1, dias_ciclo + 1), min(num_bajas, dias_ciclo))
    for d in dias_con_bajas:
        RegistroMortalidad.objects.create(
            lote=lote,
            cantidad=1,
            causa=random.choice(["Causa natural", "Debilidad general", "Aplastamiento"]),
            fecha_hora=now - timedelta(days=(dias_ciclo - d)),
            empresa=empresa
        )
    return num_bajas


def seed_control_calidad(lote, dias_ciclo, usuario, empresa, now):
    """Genera pesajes de control de calidad periódicos."""
    for d in [1, 4, 7, 10, 14, 17, 21, 24, 28, 31, 35, 38, 42, 45]:
        if d > dias_ciclo:
            break
        fecha_reg = datetime.combine(lote.fecha_ingreso + timedelta(days=d - 1), datetime.min.time()) + timedelta(hours=9)
        peso_est = get_peso_estandar(d)
        if lote.raza_tipo == "Ross 308":
            peso_est *= Decimal("1.01")
        elif lote.raza_tipo == "Cobb 500":
            peso_est *= Decimal("0.99")
        mult = Decimal(str(random.uniform(0.97, 1.03)))
        peso_reg = round(peso_est * mult, 4)
        diff = round(((peso_reg - peso_est) / peso_est) * Decimal('100.0'), 4)
        est_des = "Bajo Peso" if diff < Decimal('-5.0') else ("Sobre Peso" if diff > Decimal('5.0') else "Normal")
        ControlCalidad.objects.create(
            id_lote=lote,
            usuario_id=usuario,
            empresa_id=empresa,
            peso_registrado=peso_reg,
            edad_dias=d,
            peso_estandar=peso_est,
            porcentaje_diferencia=diff,
            estado_desarrollo=est_des,
            observacion=f"Pesaje de rutina día {d}.",
            fecha_registro=timezone.make_aware(fecha_reg)
        )


def seed_temperaturas(galpones_config, empresa, now):
    """Genera 72 horas de registros climáticos por hora para los galpones dados."""
    rows = []
    for g, con_calor in galpones_config:
        for h in range(72, -1, -1):
            ts = now - timedelta(hours=h)
            hora = ts.hour
            temp_base = 25.5 + 4.5 * math.sin((hora - 9) * math.pi / 12)
            temp_ext = temp_base + random.uniform(-1.0, 1.0)
            hum_ext = 65.0 - 15.0 * math.sin((hora - 9) * math.pi / 12) + random.uniform(-4.0, 4.0)
            temp_int = temp_ext + random.uniform(-0.4, 0.4)
            if con_calor and h <= 24:
                temp_int += random.uniform(3.5, 5.0)
                temp_int = min(temp_int, 36.5)
            rows.append(TemperaturaGalpon(
                galpon=g,
                temperatura=Decimal(str(round(temp_int, 2))),
                temperatura_externa=Decimal(str(round(temp_ext, 2))),
                humedad_externa=Decimal(str(round(hum_ext, 2))),
                estado=calcular_estado_temperatura(round(temp_int, 2)),
                fuente="SIMULADO",
                usuario=None,
                fecha_hora=ts,
                empresa=empresa
            ))
    TemperaturaGalpon.objects.bulk_create(rows)
    return len(rows)


class Command(BaseCommand):
    help = "Pobla de datos reales y coherentes las tablas de la empresa ID 1 para predicciones y demo."

    def handle(self, *args, **options):
        self.stdout.write("Iniciando poblamiento completo de datos demo para empresa ID 1...")

        try:
            from apps.empresas.models import Empresa
            empresa = Empresa.objects.get(pk=1)
            self.stdout.write(f"Empresa encontrada: {empresa.nombre}")
        except Empresa.DoesNotExist:
            self.stdout.write(self.style.ERROR("Error: La empresa ID 1 no existe."))
            return

        usuario = Usuario.objects.filter(empresa_id=1).first()
        today = timezone.localdate()
        now = timezone.now()

        with transaction.atomic():
            # ─── LIMPIEZA ────────────────────────────────────────────────
            self.stdout.write("Limpiando datos anteriores de empresa 1...")
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM registro_enfermedad_lote WHERE id_lote IN "
                    "(SELECT id_lote FROM lote WHERE empresa_id = 1)"
                )
                cursor.execute("DELETE FROM alertas_sanitarias")

            PrediccionMortalidad.objects.filter(empresa_id=1).delete()
            RegistroMortalidad.objects.filter(empresa_id=1).delete()
            AlertaSanitaria.objects.filter(empresa_id=1).delete()
            ControlSanitario.objects.filter(empresa_id=1).delete()
            Alimentacion.objects.filter(empresa_id=1).delete()
            ControlCalidad.objects.filter(empresa_id=1).delete()
            VentaLote.objects.filter(empresa_id=1).delete()
            Lote.objects.filter(empresa_id=1).delete()
            MovimientoAlmacen.objects.filter(empresa_id=1).delete()
            Insumo.objects.filter(empresa_id=1).delete()
            Proveedor.objects.filter(empresa_id=1).delete()
            Cliente.objects.filter(empresa_id=1).delete()
            TemperaturaGalpon.objects.filter(empresa_id=1).delete()
            PrediccionTemperatura.objects.filter(empresa_id=1).delete()

            # ─── CURVA ESTÁNDAR ──────────────────────────────────────────
            self.stdout.write("Poblando curvas de crecimiento estándar...")
            CurvaCrecimientoEstandar.objects.all().delete()
            curvas = []
            for raza in ["Broiler", "Ross 308", "Cobb 500"]:
                for d in range(1, 51):
                    peso = get_peso_estandar(d)
                    if raza == "Ross 308":
                        peso *= Decimal('1.01')
                    elif raza == "Cobb 500":
                        peso *= Decimal('0.99')
                    curvas.append(CurvaCrecimientoEstandar(
                        raza=raza, edad_dias=d,
                        peso_estandar=round(peso, 4), unidad_medida="kg",
                        activo=True, created_at=now, updated_at=now
                    ))
            CurvaCrecimientoEstandar.objects.bulk_create(curvas)
            self.stdout.write(f"  {len(curvas)} curvas creadas.")

            # ─── GALPONES (7 con distintos estados) ──────────────────────
            self.stdout.write("Configurando galpones...")
            galpones_def = [
                # (id, nombre, capacidad, estado, latitud, longitud)
                (20, "Galpón A - Engorde Principal",   2000, "activo",         Decimal("-17.7825"), Decimal("-63.1840")),
                (21, "Galpón B - Crianza Norte",       1500, "activo",         Decimal("-17.7831"), Decimal("-63.1835")),
                (22, "Galpón C - Engorde Sur",         1800, "activo",         Decimal("-17.7845"), Decimal("-63.1820")),
                (23, "Galpón D - Reproductoras",       1200, "activo",         Decimal("-17.7860"), Decimal("-63.1810")),
                (24, "Galpón E - Cuarentena",           800, "activo",         Decimal("-17.7870"), Decimal("-63.1800")),
                (25, "Galpón F - En Mantenimiento",    1000, "mantenimiento",  Decimal("-17.7880"), Decimal("-63.1790")),
                (26, "Galpón G - Histórico",           1600, "activo",         Decimal("-17.7890"), Decimal("-63.1780")),
            ]
            galpones_obj = {}
            for gid, nombre, cap, estado, lat, lon in galpones_def:
                g, _ = Galpon.objects.get_or_create(
                    id=gid,
                    defaults=dict(nombre=nombre, capacidad=cap, estado=estado,
                                  latitud=lat, longitud=lon,
                                  ubicacion_nombre="Santa Cruz de la Sierra, Bolivia",
                                  empresa=empresa)
                )
                g.nombre = nombre; g.capacidad = cap; g.estado = estado
                g.empresa = empresa; g.save()
                galpones_obj[gid] = g
                self.stdout.write(f"  {nombre} (ID:{gid}) — {estado}")

            # ─── INSUMOS ─────────────────────────────────────────────────
            self.stdout.write("Poblando insumos y proveedores...")
            prov_alim = Proveedor.objects.create(
                nombre="Distribuidora Avícola El Progreso",
                contacto="Ing. Mario Vargas", telefono="+591 77012345",
                direccion="Parque Industrial PI-24, Santa Cruz", empresa=empresa)
            prov_vet = Proveedor.objects.create(
                nombre="Fármacos y Vacunas del Oriente",
                contacto="Dra. Elena Ruiz", telefono="+591 33458990",
                direccion="Av. Banzer Km 5, Santa Cruz", empresa=empresa)

            ins_ini  = Insumo.objects.create(nombre="Alimento Iniciador (Fase 1)",  tipo="Alimento",    unidad_medida="kg",      stock_actual=Decimal("6500"),  stock_minimo=Decimal("1000"), empresa=empresa)
            ins_cre  = Insumo.objects.create(nombre="Alimento Crecimiento (Fase 2)", tipo="Alimento",   unidad_medida="kg",      stock_actual=Decimal("9200"),  stock_minimo=Decimal("1500"), empresa=empresa)
            ins_fin  = Insumo.objects.create(nombre="Alimento Finalizador (Fase 3)", tipo="Alimento",   unidad_medida="kg",      stock_actual=Decimal("14000"), stock_minimo=Decimal("2000"), empresa=empresa)
            ins_amoxi= Insumo.objects.create(nombre="Amoxicilina 10%",               tipo="Medicamento", unidad_medida="kg",      stock_actual=Decimal("30"),    stock_minimo=Decimal("5"),   empresa=empresa)
            ins_vac  = Insumo.objects.create(nombre="Vacuna Triple Avícola",          tipo="Vacuna",      unidad_medida="unidades",stock_actual=Decimal("4000"),  stock_minimo=Decimal("500"), empresa=empresa)
            ins_vit  = Insumo.objects.create(nombre="Vitaminas y Electrolitos",       tipo="Suministro",  unidad_medida="kg",      stock_actual=Decimal("80"),    stock_minimo=Decimal("10"),  empresa=empresa)

            for ins, prov, cant, mot in [
                (ins_ini,  prov_alim, Decimal("12000"), "Compra mensual iniciador"),
                (ins_cre,  prov_alim, Decimal("16000"), "Compra mensual crecimiento"),
                (ins_fin,  prov_alim, Decimal("22000"), "Compra mensual finalizador"),
                (ins_amoxi,prov_vet,  Decimal("60"),    "Reposición antibiótico trimestral"),
                (ins_vac,  prov_vet,  Decimal("5000"),  "Campaña de vacunación semestral"),
                (ins_vit,  prov_vet,  Decimal("100"),   "Suplemento vitamínico mensual"),
            ]:
                MovimientoAlmacen.objects.create(
                    insumo=ins, proveedor=prov, tipo_movimiento="Entrada",
                    cantidad=cant, motivo=mot, empresa=empresa,
                    observacion="Carga inicial demo.")

            # ─── CLIENTES ────────────────────────────────────────────────
            cli_corp  = Cliente.objects.create(nombre="Distribuidora El Solar",   telefono="+591 33499090", email="compras@elsolar.com.bo",    empresa=empresa)
            cli_local = Cliente.objects.create(nombre="Pollerías El Campeón",     telefono="+591 70044556", email="elcampeon@pollerias.com",    empresa=empresa)
            cli_super = Cliente.objects.create(nombre="Supermercados FreshMart",  telefono="+591 78012233", email="carnes@freshmart.bo",        empresa=empresa)
            cli_rest  = Cliente.objects.create(nombre="Restaurante Don Pepe",     telefono="+591 71230045", email="donpepe@restaurante.com",    empresa=empresa)

            # ─── LOTES (9 lotes — todos los estados del ciclo) ───────────
            self.stdout.write("Creando lotes con todos los estados del ciclo...")

            # Estado Crianza (muy joven, < 14 dias)
            l_crianza_a = Lote.objects.create(id_lote=201, galpon=galpones_obj[21],
                raza_tipo="Ross 308",
                fecha_ingreso=today - timedelta(days=7),
                fecha_salida_estimada=today + timedelta(days=38),
                cantidad_inicial=1200, cantidad_actual=1200,
                peso_inicial=Decimal("0.042"), estado="Crianza", empresa=empresa)

            l_crianza_b = Lote.objects.create(id_lote=202, galpon=galpones_obj[23],
                raza_tipo="Cobb 500",
                fecha_ingreso=today - timedelta(days=3),
                fecha_salida_estimada=today + timedelta(days=42),
                cantidad_inicial=900, cantidad_actual=900,
                peso_inicial=Decimal("0.043"), estado="Crianza", empresa=empresa)

            # Estado Crecimiento (14-28 días)
            l_crec_a = Lote.objects.create(id_lote=203, galpon=galpones_obj[20],
                raza_tipo="Broiler",
                fecha_ingreso=today - timedelta(days=21),
                fecha_salida_estimada=today + timedelta(days=24),
                cantidad_inicial=1800, cantidad_actual=1800,
                peso_inicial=Decimal("0.042"), estado="Crecimiento", empresa=empresa)

            l_crec_b = Lote.objects.create(id_lote=204, galpon=galpones_obj[21],
                raza_tipo="Ross 308",
                fecha_ingreso=today - timedelta(days=17),
                fecha_salida_estimada=today + timedelta(days=28),
                cantidad_inicial=1500, cantidad_actual=1500,
                peso_inicial=Decimal("0.042"), estado="Crecimiento", empresa=empresa)

            # Estado Engorde (28-42 días) — uno con alerta sanitaria
            l_eng_sano = Lote.objects.create(id_lote=205, galpon=galpones_obj[22],
                raza_tipo="Cobb 500",
                fecha_ingreso=today - timedelta(days=34),
                fecha_salida_estimada=today + timedelta(days=11),
                cantidad_inicial=1600, cantidad_actual=1600,
                peso_inicial=Decimal("0.043"), estado="Engorde", empresa=empresa)

            l_eng_alerta = Lote.objects.create(id_lote=206, galpon=galpones_obj[20],
                raza_tipo="Ross 308",
                fecha_ingreso=today - timedelta(days=28),
                fecha_salida_estimada=today + timedelta(days=17),
                cantidad_inicial=2000, cantidad_actual=2000,
                peso_inicial=Decimal("0.042"), estado="Engorde", empresa=empresa)

            # Estado Listo para Venta (> 42 días, peso >= 2.80 kg)
            l_listo = Lote.objects.create(id_lote=207, galpon=galpones_obj[26],
                raza_tipo="Broiler",
                fecha_ingreso=today - timedelta(days=44),
                fecha_salida_estimada=today + timedelta(days=1),
                cantidad_inicial=1400, cantidad_actual=1400,
                peso_inicial=Decimal("0.042"), estado="Listo para Venta", empresa=empresa)

            # Estado Finalizado (venta parcial reciente)
            l_vendido_parcial = Lote.objects.create(id_lote=208, galpon=galpones_obj[26],
                raza_tipo="Cobb 500",
                fecha_ingreso=today - timedelta(days=50),
                fecha_salida_estimada=today - timedelta(days=5),
                cantidad_inicial=1000, cantidad_actual=1000,
                peso_inicial=Decimal("0.043"), estado="Finalizado", empresa=empresa)

            # Estado Finalizado histórico (ciclo completo vendido hace 30 días)
            l_historico = Lote.objects.create(id_lote=209, galpon=galpones_obj[24],
                raza_tipo="Ross 308",
                fecha_ingreso=today - timedelta(days=85),
                fecha_salida_estimada=today - timedelta(days=40),
                cantidad_inicial=800, cantidad_actual=800,
                peso_inicial=Decimal("0.043"), estado="Finalizado", empresa=empresa)

            self.stdout.write("  9 lotes creados correctamente.")

            # ─── MORTALIDAD ───────────────────────────────────────────────
            self.stdout.write("Registrando mortalidades...")

            # Bajas normales para lotes activos jóvenes
            for lote, dias in [(l_crianza_a, 7), (l_crianza_b, 3)]:
                seed_mortalidad_normal(lote, dias, empresa, now)

            # Crecimiento: bajas moderadas
            for lote, dias in [(l_crec_a, 21), (l_crec_b, 17)]:
                seed_mortalidad_normal(lote, dias, empresa, now)

            # Engorde sano: bajas naturales
            seed_mortalidad_normal(l_eng_sano, 34, empresa, now)

            # Lote alerta (l_eng_alerta): pico de mortandad en últimos 3 días
            for d_ago, cant, causa in [(3, 8, "Dificultad respiratoria"), (2, 12, "Bronquitis Infecciosa"), (1, 9, "Bronquitis Infecciosa")]:
                RegistroMortalidad.objects.create(
                    lote=l_eng_alerta, cantidad=cant, causa=causa,
                    fecha_hora=now - timedelta(days=d_ago), empresa=empresa)

            # Listo para venta
            seed_mortalidad_normal(l_listo, 44, empresa, now)

            # Finalizados
            for lote, dias in [(l_vendido_parcial, 45), (l_historico, 45)]:
                seed_mortalidad_normal(lote, dias, empresa, now)

            # Refrescar cantidades actuales
            for l in [l_crianza_a, l_crianza_b, l_crec_a, l_crec_b,
                      l_eng_sano, l_eng_alerta, l_listo, l_vendido_parcial, l_historico]:
                l.refresh_from_db()
                self.stdout.write(f"  Lote {l.id_lote} ({l.estado}): {l.cantidad_actual}/{l.cantidad_inicial} aves")

            # ─── ALIMENTACIÓN ─────────────────────────────────────────────
            self.stdout.write("Poblando alimentación diaria...")
            for lote, dias in [
                (l_crianza_a, 7), (l_crianza_b, 3),
                (l_crec_a, 21), (l_crec_b, 17),
                (l_eng_sano, 34), (l_listo, 44),
                (l_vendido_parcial, 45), (l_historico, 45),
            ]:
                seed_alimentacion(lote, dias, ins_ini, ins_cre, ins_fin, empresa)

            # Lote alerta: alimentación con caída severa en últimos 3 días
            seed_alimentacion(l_eng_alerta, 28, ins_ini, ins_cre, ins_fin, empresa,
                              lote_id_especial_enfermo=206)

            # ─── CONTROL DE CALIDAD ───────────────────────────────────────
            self.stdout.write("Poblando controles de calidad...")
            for lote, dias in [
                (l_crianza_a, 7), (l_crianza_b, 3),
                (l_crec_a, 21), (l_crec_b, 17),
                (l_eng_sano, 34), (l_eng_alerta, 28),
                (l_listo, 44), (l_vendido_parcial, 45), (l_historico, 45),
            ]:
                seed_control_calidad(lote, dias, usuario, empresa, now)

            # ─── SANIDAD Y ALERTAS (Lote 206 — Alerta Bronquitis) ─────────
            self.stdout.write("Registrando alertas sanitarias...")
            brote = ControlSanitario.objects.create(
                lote=l_eng_alerta, insumo=ins_amoxi,
                tipo_tratamiento="Antibiotico", dosis=Decimal("0.00"),
                unidad_dosis="g/ave",
                fecha_aplicacion=today - timedelta(days=3),
                responsable=usuario.nom_usuario if usuario else "Veterinario",
                observacion="Confirmación de Bronquitis Infecciosa en Lote 206. Inicio de mortandad atípica.",
                estado_enfermedad="activo", tipo_registro="enfermedad",
                enfermedad_sintoma="Bronquitis Infecciosa — estertores, dificultad respiratoria",
                cantidad_aves_afectadas=160, porcentaje_afectacion=Decimal("8.00"),
                usuario=usuario, empresa=empresa)

            ControlSanitario.objects.create(
                lote=l_eng_alerta, insumo=ins_amoxi,
                tipo_tratamiento="Antibiotico", dosis=Decimal("1.20"),
                unidad_dosis="g/L de agua",
                fecha_aplicacion=today - timedelta(days=2),
                responsable=usuario.nom_usuario if usuario else "Veterinario",
                observacion="Tratamiento masivo con Amoxicilina 10% en agua de bebida — 5 días.",
                estado_enfermedad="en_tratamiento", tipo_registro="tratamiento",
                enfermedad_sintoma="Bronquitis Infecciosa",
                cantidad_aves_afectadas=160, porcentaje_afectacion=Decimal("8.00"),
                usuario=usuario, empresa=empresa)

            # Vacunación completada en Lote 201 (Crianza A)
            ControlSanitario.objects.create(
                lote=l_crianza_a, insumo=ins_vac,
                tipo_tratamiento="Vacuna", dosis=Decimal("1.00"),
                unidad_dosis="unidades/ave",
                fecha_aplicacion=today - timedelta(days=5),
                responsable=usuario.nom_usuario if usuario else "Operario",
                observacion="Vacunación preventiva Triple completada con éxito.",
                estado_enfermedad="resuelto", tipo_registro="tratamiento",
                usuario=usuario, empresa=empresa)

            # Vitaminas en Lote 203 (Crecimiento)
            ControlSanitario.objects.create(
                lote=l_crec_a, insumo=ins_vit,
                tipo_tratamiento="Vitamina", dosis=Decimal("0.50"),
                unidad_dosis="g/L de agua",
                fecha_aplicacion=today - timedelta(days=3),
                responsable=usuario.nom_usuario if usuario else "Operario",
                observacion="Suplemento vitamínico preventivo por estrés calórico.",
                estado_enfermedad="resuelto", tipo_registro="tratamiento",
                usuario=usuario, empresa=empresa)

            AlertaSanitaria.objects.create(
                lote=l_eng_alerta, registro_enfermedad=brote, insumo=ins_amoxi,
                tipo_alerta="Afectacion", nivel="Alto",
                causa="Brote de Bronquitis Infecciosa en Galpón A",
                mensaje="Lote 206 presenta Bronquitis Infecciosa con 8% de afectación y 29 bajas en 3 días.",
                porcentaje_detectado=Decimal("8.00"), cantidad_detectada=160,
                estado="Pendiente", fecha_hora=now - timedelta(days=3),
                usuario=usuario, empresa=empresa)

            AlertaSanitaria.objects.create(
                lote=l_crec_a, registro_enfermedad=None, insumo=ins_vit,
                tipo_alerta="Mortandad", nivel="Medio",
                causa="Incremento leve de mortalidad en Lote 203",
                mensaje="Lote 203 registra un leve incremento de mortalidad. Se recomienda revisión.",
                porcentaje_detectado=Decimal("1.20"), cantidad_detectada=5,
                estado="Atendida", fecha_hora=now - timedelta(days=5),
                usuario=usuario, empresa=empresa)

            # ─── CLIMA (72 h por hora en todos los galpones activos) ──────
            self.stdout.write("Simulando temperatura y humedad (72 horas)...")
            galpones_clima = [
                (galpones_obj[20], True),   # Galpón A con ola de calor
                (galpones_obj[21], False),
                (galpones_obj[22], False),
                (galpones_obj[23], False),
                (galpones_obj[24], False),
                (galpones_obj[26], False),
            ]
            n_temp = seed_temperaturas(galpones_clima, empresa, now)
            self.stdout.write(f"  {n_temp} registros climáticos generados.")

            # ─── VENTAS ───────────────────────────────────────────────────
            self.stdout.write("Registrando ventas...")

            # Venta completa del lote histórico 209
            bajas_hist = RegistroMortalidad.objects.filter(lote=l_historico).count()
            cant_venta_hist = l_historico.cantidad_inicial - bajas_hist
            VentaLote.objects.create(
                cliente=cli_corp, lote=l_historico,
                fecha_venta=now - timedelta(days=40),
                cantidad=cant_venta_hist,
                precio_unitario=Decimal("17.00"),
                precio_total=Decimal(str(cant_venta_hist * 17)),
                peso_total_vendido=Decimal(str(round(cant_venta_hist * 3.10, 2))),
                tipo_venta="Por unidad",
                observacion="Venta completa lote histórico Ross 308 — ciclo 45 días.",
                empresa=empresa)
            l_historico.cantidad_actual = 0
            l_historico.estado = "Finalizado"
            l_historico.save()

            # Venta completa del lote 208 (vendido hace 5 días)
            bajas_208 = RegistroMortalidad.objects.filter(lote=l_vendido_parcial).count()
            cant_venta_208 = l_vendido_parcial.cantidad_inicial - bajas_208
            VentaLote.objects.create(
                cliente=cli_super, lote=l_vendido_parcial,
                fecha_venta=now - timedelta(days=5),
                cantidad=cant_venta_208,
                precio_unitario=Decimal("16.50"),
                precio_total=Decimal(str(cant_venta_208 * Decimal("16.50"))),
                peso_total_vendido=Decimal(str(round(cant_venta_208 * 3.05, 2))),
                tipo_venta="Por unidad",
                observacion="Venta total lote Cobb 500 a supermercado.",
                empresa=empresa)
            l_vendido_parcial.cantidad_actual = 0
            l_vendido_parcial.estado = "Finalizado"
            l_vendido_parcial.save()

            # Venta parcial del lote listo para venta 207 (300 aves hoy)
            VentaLote.objects.create(
                cliente=cli_local, lote=l_listo,
                fecha_venta=now,
                cantidad=300,
                precio_unitario=Decimal("16.00"),
                precio_total=Decimal("4800.00"),
                peso_total_vendido=Decimal("840.00"),
                tipo_venta="Por unidad",
                observacion="Primera entrega de 300 aves a cliente local.",
                empresa=empresa)
            l_listo.cantidad_actual -= 300
            l_listo.save()

            # Segunda venta parcial del lote 207 (restaurante, 150 aves)
            VentaLote.objects.create(
                cliente=cli_rest, lote=l_listo,
                fecha_venta=now - timedelta(hours=3),
                cantidad=150,
                precio_unitario=Decimal("17.50"),
                precio_total=Decimal("2625.00"),
                peso_total_vendido=Decimal("427.50"),
                tipo_venta="Por unidad",
                observacion="Venta especial a restaurante.",
                empresa=empresa)
            l_listo.cantidad_actual -= 150
            l_listo.save()

            # ─── BITÁCORA ─────────────────────────────────────────────────
            self.stdout.write("Registrando bitácora de eventos...")
            eventos = [
                ("crear", f"Ingreso de Lote 201 — 1200 Ross 308 en Galpón B", timedelta(days=7)),
                ("crear", f"Ingreso de Lote 203 — 1800 Broiler en Galpón A", timedelta(days=21)),
                ("crear", f"Ingreso de Lote 206 — 2000 Ross 308 en Galpón A", timedelta(days=28)),
                ("alerta", "Alerta Sanitaria: Bronquitis Infecciosa en Lote 206", timedelta(days=3)),
                ("vacunacion", "Vacunación Triple completada en Lote 201", timedelta(days=5)),
                ("venta", "Venta parcial de 300 aves del Lote 207 por $4,800", timedelta(hours=2)),
                ("venta", "Venta parcial de 150 aves del Lote 207 a Restaurante Don Pepe", timedelta(hours=3)),
                ("venta", "Venta completa del Lote 208 — 990 Cobb 500", timedelta(days=5)),
            ]
            for accion, desc, delta in eventos:
                BitacoraEvento.objects.create(
                    usuario=usuario, accion=accion, descripcion=desc,
                    fecha_hora=now - delta, empresa=empresa)

        # ─── PREDICCIONES IA (fuera del transaction.atomic) ──────────────
        self.stdout.write("Ejecutando predicciones de IA...")

        # Temperatura
        for gid, _ in galpones_clima:
            res = predecir_temperatura_galpon(galpon_id=gid.id, horizonte_horas=3, ventana_horas=72, empresa_id=1)
            if res:
                est = calcular_estado_temperatura(res.temperatura_predicha)
                umbral = est in ('FRIO', 'CALOR')
                msg = (f"Alerta: calor extremo ({res.temperatura_predicha}°C) en {gid.nombre} en 3h."
                       if umbral else
                       f"Temperatura estable ({res.temperatura_predicha}°C) en {gid.nombre}.")
                PrediccionTemperatura.objects.create(
                    galpon=gid, empresa_id=1, horizonte_horas=3, ventana_horas=72,
                    temperatura_predicha=res.temperatura_predicha, estado_predicho=est,
                    confianza=res.confianza, puntos=res.puntos,
                    umbral_superado=umbral, mensaje=msg)
                self.stdout.write(f"  Temperatura {gid.nombre}: {res.temperatura_predicha}°C ({est})")

        # Mortalidad — todos los lotes activos
        lotes_activos = [l_crianza_a, l_crianza_b, l_crec_a, l_crec_b,
                         l_eng_sano, l_eng_alerta, l_listo]
        for l in lotes_activos:
            res = predecir_mortalidad_lote(l.id_lote, empresa_id=1)
            if res:
                self.stdout.write(
                    f"  Mortalidad Lote {l.id_lote} ({l.raza_tipo}, {l.estado}): "
                    f"Riesgo={res.riesgo_porcentaje}% — {res.nivel_riesgo}")

        self.stdout.write(self.style.SUCCESS(
            "\n[OK] Poblamiento completo finalizado con exito para empresa ID 1!"))
