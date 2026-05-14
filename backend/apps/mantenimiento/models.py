"""Modelos de la app `mantenimiento`.

Define las entidades para el control de copias de seguridad:
- `BackupConfig`: configuración singleton del respaldo automático (hora + activo +
                  modo_mantenimiento + mantenimiento_hasta).
- `BackupLog`:    registro histórico de cada copia generada.
"""

from datetime import timedelta

from django.db import models
from django.utils import timezone


class BackupConfig(models.Model):
    """Configuración global del respaldo automático y modo mantenimiento.

    Diseñada como singleton (siempre existe el registro con id=1).
    El planificador de fondo consulta este registro cada minuto.
    """

    hora_automatica = models.TimeField(
        null=True,
        blank=True,
        help_text="Hora diaria en la que se ejecutará el respaldo automático (HH:MM).",
    )
    activo = models.BooleanField(
        default=False,
        help_text="Si es True, el planificador ejecutará el respaldo a la hora configurada.",
    )

    # ── Modo Mantenimiento ────────────────────────────────────────────────────
    modo_mantenimiento = models.BooleanField(
        default=False,
        help_text="Si True, el sistema bloquea todas las peticiones de no-SuperAdmin.",
    )
    mantenimiento_hasta = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp de auto-desactivación del modo mantenimiento.",
    )

    class Meta:
        db_table = "backup_config"
        verbose_name = "Configuración de Respaldo"
        verbose_name_plural = "Configuración de Respaldo"

    def __str__(self):
        estado = "activo" if self.activo else "inactivo"
        hora = self.hora_automatica.strftime("%H:%M") if self.hora_automatica else "sin configurar"
        mnt = " [MANTENIMIENTO]" if self.modo_mantenimiento else ""
        return f"BackupConfig [{estado}]{mnt} — hora: {hora}"

    @classmethod
    def get_singleton(cls):
        """Retorna (o crea) la única instancia de configuración."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def activar_mantenimiento(self, minutos: int = 5) -> None:
        """Activa el modo mantenimiento y programa su auto-desactivación.

        El conteo de minutos empieza en el momento de la llamada (antes del flush),
        garantizando que nadie entre mientras las tablas se están limpiando.

        Args:
            minutos: Duración mínima del bloqueo. Por defecto 5 minutos.
        """
        self.modo_mantenimiento = True
        self.mantenimiento_hasta = timezone.now() + timedelta(minutes=minutos)
        self.save(update_fields=["modo_mantenimiento", "mantenimiento_hasta"])

    def desactivar_mantenimiento(self) -> None:
        """Desactiva el modo mantenimiento de forma inmediata.

        Llamado cuando el restore falla, para no dejar el sistema bloqueado.
        """
        self.modo_mantenimiento = False
        self.mantenimiento_hasta = None
        self.save(update_fields=["modo_mantenimiento", "mantenimiento_hasta"])

    @property
    def segundos_restantes(self) -> int:
        """Segundos que quedan para que expire el modo mantenimiento."""
        if not self.modo_mantenimiento or not self.mantenimiento_hasta:
            return 0
        delta = self.mantenimiento_hasta - timezone.now()
        return max(0, int(delta.total_seconds()))


class BackupLog(models.Model):
    """Registro de una copia de seguridad generada.

    Mantiene la metadata necesaria para listar, descargar y restaurar respaldos.
    """

    TIPO_CHOICES = [
        ("MANUAL", "Manual"),
        ("AUTOMATICO", "Automático"),
    ]

    nombre_archivo = models.CharField(
        max_length=255,
        help_text="Nombre del archivo .json.gz generado.",
    )
    ruta_archivo = models.CharField(
        max_length=512,
        help_text="Ruta absoluta en el servidor para localizar el archivo.",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    tamano = models.CharField(
        max_length=30,
        help_text="Tamaño legible por humanos, ej: '2.4 MB'.",
    )
    tipo = models.CharField(
        max_length=10,
        choices=TIPO_CHOICES,
        default="MANUAL",
    )

    class Meta:
        db_table = "backup_log"
        ordering = ["-fecha_creacion"]
        verbose_name = "Registro de Respaldo"
        verbose_name_plural = "Historial de Respaldos"

    def __str__(self):
        return f"{self.nombre_archivo} [{self.tipo}] — {self.fecha_creacion:%Y-%m-%d %H:%M}"
