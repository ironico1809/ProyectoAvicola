"""Configuración de la app `mantenimiento`.

El método `ready()` lanza un hilo de fondo que verifica cada 60 segundos
si debe ejecutar el backup automático configurado en BackupConfig.

Guardias:
- Solo se lanza en el proceso principal de `runserver` (no en el recargador).
- Se detecta mediante la variable de entorno RUN_MAIN=true que Django establece.
- En producción con gunicorn/uwsgi el hilo se lanza sin problemas porque no hay
  recargador automático.
"""

import logging
import os
import threading
from datetime import datetime

from django.apps import AppConfig

logger = logging.getLogger(__name__)


def _scheduler_loop():
    """Bucle del planificador de backups automáticos.

    Comprueba cada 60 segundos si la hora actual coincide con la hora
    configurada en BackupConfig (margen de ±1 minuto para tolerar drift).
    """
    import time

    # Tiempo de espera en segundos entre comprobaciones
    INTERVALO = 60
    # Margen de tolerancia en segundos (el hilo puede despertar hasta 1 min tarde)
    MARGEN = 90

    ultimo_backup_dia: int | None = None  # evita disparar varias veces el mismo día

    while True:
        try:
            from apps.mantenimiento.models import BackupConfig
            from apps.mantenimiento.services import generar_backup

            config = BackupConfig.get_singleton()

            if config.activo and config.hora_automatica:
                ahora = datetime.now()
                hora_cfg = config.hora_automatica

                # Segundos desde medianoche
                seg_ahora = ahora.hour * 3600 + ahora.minute * 60 + ahora.second
                seg_cfg = hora_cfg.hour * 3600 + hora_cfg.minute * 60

                diferencia = abs(seg_ahora - seg_cfg)

                if diferencia <= MARGEN and ultimo_backup_dia != ahora.date():
                    logger.info(
                        "Scheduler: ejecutando backup automático a las %s",
                        ahora.strftime("%H:%M"),
                    )
                    generar_backup(tipo="AUTOMATICO")
                    ultimo_backup_dia = ahora.date()

        except Exception as exc:
            # Nunca dejar caer el hilo por errores transitorios de BD
            logger.warning("Scheduler error (no crítico): %s", exc)

        time.sleep(INTERVALO)


class MantenimientoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.mantenimiento"
    verbose_name = "Mantenimiento y Respaldos"

    def ready(self):
        # Solo lanzar el hilo en el proceso real (no en el fork del reloader)
        if os.environ.get("RUN_MAIN") == "true" or not os.environ.get("RUN_MAIN"):
            hilo = threading.Thread(target=_scheduler_loop, daemon=True, name="BackupScheduler")
            hilo.start()
            logger.info("BackupScheduler iniciado.")
