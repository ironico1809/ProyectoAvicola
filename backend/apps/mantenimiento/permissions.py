"""Permiso personalizado: solo Superusuarios pueden acceder al módulo de mantenimiento."""

from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    """Permite el acceso únicamente a usuarios con tipo_usuario='Superusuario'.

    Aplica tanto al flag `is_superuser` de Django como al campo
    `tipo_usuario` propio del modelo Usuario del proyecto.
    """

    message = "Solo los Superusuarios pueden acceder al módulo de mantenimiento."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user:
            return False
        if not getattr(user, "is_authenticated", False):
            return False
        return (
            getattr(user, "is_superuser", False)
            or getattr(user, "tipo_usuario", "") == "Superusuario"
        )
