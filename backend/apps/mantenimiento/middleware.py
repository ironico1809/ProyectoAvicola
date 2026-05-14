"""Middleware de Modo Mantenimiento para AviGranja.

Intercepta TODAS las peticiones HTTP y, si el sistema está en modo
mantenimiento, devuelve un 503 JSON para cualquier usuario que NO sea
Superusuario.

Comportamiento:
- Las rutas de la lista RUTAS_EXCLUIDAS siempre pasan (estado público + login).
- Si el tiempo de mantenimiento ya expiró, auto-desactiva el flag y deja pasar.
- Si el usuario es SuperAdmin/Superusuario, siempre pasa.
- Cualquier otro usuario recibe una respuesta 503 con JSON estructurado.

Posición en MIDDLEWARE (settings.py):
    Debe ir DESPUÉS de 'django.contrib.auth.middleware.AuthenticationMiddleware'
    para poder leer request.user correctamente.
"""

import logging

from django.http import JsonResponse
from django.utils import timezone

logger = logging.getLogger(__name__)


class ModoMantenimientoMiddleware:
    """Middleware de bloqueo global durante restauraciones de base de datos."""

    # Rutas que NUNCA se bloquean (acceso público necesario)
    RUTAS_EXCLUIDAS = (
        "/mantenimiento/estado/",   # polling del frontend para detectar el estado
        "/usuarios/login/",          # el login debe funcionar siempre
        "/usuarios/token/",          # renovación de tokens JWT
        "/admin/",                   # panel Django admin (por si acaso)
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # ── 1. Saltar rutas excluidas ─────────────────────────────────────────
        if any(request.path.startswith(ruta) for ruta in self.RUTAS_EXCLUIDAS):
            return self.get_response(request)

        # ── 2. Leer el estado actual (consulta ligera al singleton) ───────────
        try:
            from apps.mantenimiento.models import BackupConfig  # import tardío

            config = BackupConfig.get_singleton()

            if not config.modo_mantenimiento:
                # Sin mantenimiento activo → flujo normal
                return self.get_response(request)

            # ── 3. Verificar si el período ya expiró ─────────────────────────
            ahora = timezone.now()
            if config.mantenimiento_hasta and ahora >= config.mantenimiento_hasta:
                config.desactivar_mantenimiento()
                logger.info("ModoMantenimiento: período expirado, sistema desbloqueado.")
                return self.get_response(request)

            # ── 4. SuperAdmin siempre pasa ────────────────────────────────────
            user = getattr(request, "user", None)
            if user and getattr(user, "is_authenticated", False):
                es_superadmin = getattr(user, "is_superuser", False) or (
                    getattr(user, "tipo_usuario", "") == "Superusuario"
                )
                if es_superadmin:
                    return self.get_response(request)

            # ── 5. Bloquear con 503 ───────────────────────────────────────────
            hasta_iso = (
                config.mantenimiento_hasta.isoformat()
                if config.mantenimiento_hasta
                else None
            )
            return JsonResponse(
                {
                    "codigo": "MODO_MANTENIMIENTO",
                    "mensaje": (
                        "AviGranja se encuentra en mantenimiento preventivo. "
                        "Estamos optimizando el sistema para usted. "
                        "Tiempo estimado: 5 minutos."
                    ),
                    "en_mantenimiento": True,
                    "hasta": hasta_iso,
                    "segundos_restantes": config.segundos_restantes,
                },
                status=503,
            )

        except Exception as exc:  # pylint: disable=broad-except
            # Nunca dejar caer la aplicación por un error en el middleware
            logger.error("ModoMantenimientoMiddleware error (no crítico): %s", exc)
            return self.get_response(request)
