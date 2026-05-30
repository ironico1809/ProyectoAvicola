from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.galpones.models import Galpon
from apps.temperatura.models import PrediccionTemperatura
from apps.temperatura.prediccion_service import predecir_temperatura_galpon
from apps.temperatura.views import calcular_estado_temperatura


class Command(BaseCommand):
    help = (
        "Genera predicciones de temperatura (CU27) para todos los galpones activos. "
        "Pensado para ser ejecutado por un scheduler (cada hora)."
    )

    def add_arguments(self, parser):
        parser.add_argument('--horizonte-horas', type=int, default=3)
        parser.add_argument('--ventana-horas', type=int, default=2160)
        parser.add_argument('--empresa-id', type=int, default=None)
        parser.add_argument('--galpon-id', type=int, default=None)

    def handle(self, *args, **options):
        horizonte_horas: int = options['horizonte_horas']
        ventana_horas: int = options['ventana_horas']
        empresa_id = options.get('empresa_id')
        galpon_id = options.get('galpon_id')

        qs = Galpon.objects.filter(estado='activo').order_by('id')
        if empresa_id is not None:
            qs = qs.filter(empresa_id=empresa_id)
        if galpon_id is not None:
            qs = qs.filter(id=galpon_id)

        total = 0
        creadas = 0
        omitidas = 0

        for galpon in qs:
            total += 1
            resultado = predecir_temperatura_galpon(
                galpon_id=galpon.id,
                horizonte_horas=horizonte_horas,
                ventana_horas=ventana_horas,
                empresa_id=galpon.empresa_id,
            )

            if not resultado:
                omitidas += 1
                continue

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

            PrediccionTemperatura.objects.create(
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
            creadas += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Predicciones: total_galpones={total} creadas={creadas} omitidas={omitidas} "
                f"(horizonte_horas={horizonte_horas}, ventana_horas={ventana_horas})"
            )
        )
