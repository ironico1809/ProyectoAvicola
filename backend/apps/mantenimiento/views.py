"""Vistas de la app `mantenimiento`.

Endpoints disponibles:
  GET  /mantenimiento/estado/         → estado público (AllowAny) — polling frontend
  GET  /mantenimiento/config/         → configuración del scheduler  [IsSuperAdmin]
  PUT  /mantenimiento/config/         → actualizar hora y activo      [IsSuperAdmin]
  GET  /mantenimiento/backups/        → historial de respaldos        [IsSuperAdmin]
  POST /mantenimiento/backup-manual/  → genera backup inmediato       [IsSuperAdmin]
  POST /mantenimiento/restore/        → restaura + activa mantenimiento [IsSuperAdmin]
  GET  /mantenimiento/descargar/<id>/ → descarga el .json.gz          [IsSuperAdmin]
"""

import logging
import mimetypes
from pathlib import Path

from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.mantenimiento.models import BackupConfig, BackupLog
from apps.mantenimiento.permissions import IsSuperAdmin
from apps.mantenimiento.serializers import (
    BackupConfigSerializer,
    BackupEstadoSerializer,
    BackupLogSerializer,
)
from apps.mantenimiento.services import generar_backup, restaurar_backup

logger = logging.getLogger(__name__)


# ── Endpoint público de estado ────────────────────────────────────────────────

class EstadoMantenimientoView(APIView):
    """GET — devuelve el estado actual del modo mantenimiento.

    Este endpoint es **público** (no requiere token). El frontend lo consulta
    cada 10 segundos para saber si debe mostrar la pantalla de bloqueo global.

    Respuesta:
        {
          "en_mantenimiento": true | false,
          "hasta": "2026-05-14T12:05:00Z" | null,
          "segundos_restantes": 234
        }
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # sin autenticación JWT para este endpoint

    def get(self, request):
        config = BackupConfig.get_singleton()

        # Auto-desactivar si el período ya expiró
        from django.utils import timezone
        if (
            config.modo_mantenimiento
            and config.mantenimiento_hasta
            and timezone.now() >= config.mantenimiento_hasta
        ):
            config.desactivar_mantenimiento()
            logger.info("EstadoMantenimientoView: período expirado, auto-desactivado.")

        return Response(BackupEstadoSerializer(config).data)


# ── Vistas protegidas (IsSuperAdmin) ─────────────────────────────────────────

class BackupConfigView(APIView):
    """GET / PUT de la configuración singleton del scheduler automático."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        config = BackupConfig.get_singleton()
        return Response(BackupConfigSerializer(config).data)

    def put(self, request):
        config = BackupConfig.get_singleton()
        serializer = BackupConfigSerializer(config, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)


class BackupListView(APIView):
    """GET — lista el historial de respaldos ordenado por fecha descendente."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        logs = BackupLog.objects.all()
        return Response(BackupLogSerializer(logs, many=True).data)


class BackupManualView(APIView):
    """POST — genera un backup manual de inmediato."""

    permission_classes = [IsSuperAdmin]

    def post(self, request):
        try:
            log = generar_backup(tipo="MANUAL")
            return Response(
                {
                    "mensaje": "Copia de seguridad generada correctamente.",
                    "backup": BackupLogSerializer(log).data,
                },
                status=status.HTTP_201_CREATED,
            )
        except RuntimeError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RestoreView(APIView):
    """POST — restaura la base de datos desde un BackupLog.

    Flujo de seguridad transaccional:
    1. Activa el modo mantenimiento ANTES de limpiar tablas (bloquea no-SuperAdmin).
    2. Ejecuta flush() + loaddata().
    3. Si el restore falla → desactiva el bloqueo para no dejar el sistema roto.
    4. Si tiene éxito → el bloqueo dura 5 min desde el inicio (ahora + 5 min).

    Payload: { "backup_id": <int> }
    """

    permission_classes = [IsSuperAdmin]

    def post(self, request):
        backup_id = request.data.get("backup_id")  # type: ignore[union-attr]
        if not backup_id:
            return Response(
                {"error": "Se requiere el campo 'backup_id'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            log = BackupLog.objects.get(pk=backup_id)
        except BackupLog.DoesNotExist:
            return Response(
                {"error": f"No existe un respaldo con id={backup_id}."},
                status=status.HTTP_404_NOT_FOUND,
            )

        config = BackupConfig.get_singleton()

        # ── Paso 1: Activar bloqueo antes del flush ───────────────────────────
        config.activar_mantenimiento(minutos=5)
        logger.info("Restore iniciado: modo mantenimiento activado hasta %s", config.mantenimiento_hasta)

        try:
            # ── Paso 2: Ejecutar restauración ─────────────────────────────────
            restaurar_backup(log)
            logger.info("Restore completado desde: %s", log.nombre_archivo)
            return Response(
                {
                    "mensaje": f"Sistema restaurado correctamente desde '{log.nombre_archivo}'.",
                    "en_mantenimiento": True,
                    "hasta": config.mantenimiento_hasta.isoformat() if config.mantenimiento_hasta else None,
                    "segundos_restantes": config.segundos_restantes,
                }
            )

        except FileNotFoundError as exc:
            # ── Paso 3: Desactivar bloqueo si falla ──────────────────────────
            config.desactivar_mantenimiento()
            logger.error("Restore fallido (archivo no encontrado): %s", exc)
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)

        except RuntimeError as exc:
            config.desactivar_mantenimiento()
            logger.error("Restore fallido (runtime): %s", exc)
            return Response(
                {"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DescargarBackupView(APIView):
    """GET — envía el archivo .json.gz al navegador como descarga.

    Ruta: /mantenimiento/descargar/<backup_id>/
    """

    permission_classes = [IsSuperAdmin]

    def get(self, request, backup_id: int):
        try:
            log = BackupLog.objects.get(pk=backup_id)
        except BackupLog.DoesNotExist:
            raise Http404("Backup no encontrado.")

        ruta = Path(log.ruta_archivo)
        if not ruta.exists():
            return Response(
                {"error": "El archivo de respaldo ya no existe en el servidor."},
                status=status.HTTP_404_NOT_FOUND,
            )

        content_type, _ = mimetypes.guess_type(str(ruta))
        content_type = content_type or "application/gzip"

        response = FileResponse(
            open(ruta, "rb"),
            content_type=content_type,
            as_attachment=True,
            filename=log.nombre_archivo,
        )
        return response
