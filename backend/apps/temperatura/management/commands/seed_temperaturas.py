from __future__ import annotations

import random
from datetime import datetime, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.galpones.models import Galpon
from apps.temperatura.models import TemperaturaGalpon
from apps.temperatura.views import calcular_estado_temperatura


def _simular_temp_para_timestamp(ts: datetime) -> float:
    """Simulación simple basada en la hora del día.

    Mantiene una forma similar a `generar_temperatura_simulada()` pero permite
    generar histórico para timestamps pasados.
    """

    hora = ts.hour
    if hora >= 20 or hora < 6:
        base = random.uniform(22, 27)
    elif 6 <= hora < 12:
        base = random.uniform(24, 30)
    else:
        base = random.uniform(30, 38)

    # Ruido suave
    base += random.uniform(-0.4, 0.4)
    return round(base, 2)


def _simular_clima_externo(ts: datetime) -> tuple[float, float]:
    """Simula clima externo (temp/humedad) para entrenar el sensor virtual.

    No es clima real histórico; es un proxy suficiente para demo.
    """

    temp = _simular_temp_para_timestamp(ts) + random.uniform(-2.0, 2.0)
    humedad = 60.0 + random.uniform(-15.0, 15.0)
    if humedad < 10:
        humedad = 10.0
    if humedad > 95:
        humedad = 95.0
    return round(temp, 2), round(humedad, 2)


class Command(BaseCommand):
    help = (
        "Genera lecturas históricas simuladas en TemperaturaGalpon para pruebas/dev. "
        "Útil para tener dataset de 3 meses / 1 año y alimentar CU27."
    )

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=90, help='Cantidad de días hacia atrás (ej. 90 o 365).')
        parser.add_argument('--interval-minutes', type=int, default=30, help='Frecuencia de muestreo (minutos).')
        parser.add_argument('--empresa-id', type=int, default=None, help='Filtra galpones por empresa.')
        parser.add_argument('--galpon-id', type=int, default=None, help='Genera para un galpón específico.')
        parser.add_argument('--clear', action='store_true', help='Borra lecturas existentes del rango antes de insertar.')
        parser.add_argument('--max-per-galpon', type=int, default=20000, help='Tope de inserciones por galpón para evitar explosión de datos.')

    def handle(self, *args, **options):
        days: int = options['days']
        interval_minutes: int = options['interval_minutes']
        empresa_id = options.get('empresa_id')
        galpon_id = options.get('galpon_id')
        clear: bool = bool(options.get('clear'))
        max_per_galpon: int = int(options.get('max_per_galpon') or 20000)

        if days < 1:
            self.stdout.write(self.style.ERROR('--days debe ser >= 1'))
            return

        if interval_minutes < 1:
            self.stdout.write(self.style.ERROR('--interval-minutes debe ser >= 1'))
            return

        now = timezone.now()
        start = now - timedelta(days=days)

        galpones = Galpon.objects.filter(estado='activo').order_by('id')
        if empresa_id is not None:
            galpones = galpones.filter(empresa_id=empresa_id)
        if galpon_id is not None:
            galpones = galpones.filter(id=galpon_id)

        total_insertadas = 0
        total_borradas = 0

        for galpon in galpones:
            # Cantidad de muestras aproximadas
            total_muestras = int(((now - start).total_seconds() // 60) // interval_minutes)
            if total_muestras > max_per_galpon:
                total_muestras = max_per_galpon

            # Generamos timestamps equiespaciados hacia atrás
            timestamps: list[datetime] = []
            ts = start
            for _ in range(total_muestras):
                timestamps.append(ts)
                ts = ts + timedelta(minutes=interval_minutes)

            if clear:
                borradas, _ = TemperaturaGalpon.objects.filter(
                    galpon=galpon,
                    fecha_hora__gte=start,
                    fecha_hora__lte=now,
                ).delete()
                total_borradas += int(borradas)

            rows: list[TemperaturaGalpon] = []
            for ts in timestamps:
                temp_ext, hum_ext = _simular_clima_externo(ts)
                # Temperatura interna simulada: external + pequeña inercia/bias
                temp = round(float(temp_ext + random.uniform(-1.0, 1.0)), 2)
                estado = calcular_estado_temperatura(temp)
                rows.append(
                    TemperaturaGalpon(
                        galpon=galpon,
                        temperatura=temp,
                        temperatura_externa=temp_ext,
                        humedad_externa=hum_ext,
                        estado=estado,
                        fuente='SIMULADO',
                        empresa_id=galpon.empresa_id,
                        fecha_hora=ts,
                    )
                )

            with transaction.atomic():
                TemperaturaGalpon.objects.bulk_create(rows, batch_size=1000)

            total_insertadas += len(rows)
            self.stdout.write(
                f"Galpón {galpon.id} ({galpon.nombre}): insertadas={len(rows)} desde={start.date()} intervalo={interval_minutes}min"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed completado: insertadas={total_insertadas} borradas={total_borradas} rango={days}d interval={interval_minutes}min"
            )
        )
