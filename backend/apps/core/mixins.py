"""Mixins y clases base para el blindaje de seguridad y aislamiento multi-tenant."""

from rest_framework.views import APIView


class TenantSafeView(APIView):
    """Clase base de seguridad que garantiza el aislamiento estricto de datos por Tenant (Empresa).

    Todas las vistas operativas del sistema deben heredar de esta clase en lugar de `APIView`.

    Comportamiento de filtrado en lecturas:
    - Si el usuario autenticado es un superusuario global (`is_superuser` o tipo_usuario='Superusuario'),
      tiene visibilidad sobre todos los registros del sistema.
    - Para el resto de usuarios, inyecta automáticamente `.filter(empresa_id=self.request.user.empresa_id)`.
    """

    def get_tenant_id(self):
        """Retorna de forma segura el ID de la empresa asociada al usuario de la petición."""
        user = getattr(self.request, 'user', None)
        return getattr(user, 'empresa_id', None)

    def is_global_admin(self):
        """Verifica si el usuario autenticado tiene privilegios de administración global."""
        user = getattr(self.request, 'user', None)
        if not user:
            return False
        return getattr(user, 'is_superuser', False) or getattr(user, 'tipo_usuario', '') == 'Superusuario'

    def filter_by_tenant(self, queryset):
        """Filtra explícitamente cualquier queryset secundario por el tenant actual."""
        if self.is_global_admin():
            return queryset
        tenant_id = self.get_tenant_id()
        if tenant_id is None:
            return queryset.none()
        return queryset.filter(empresa_id=tenant_id)

    def get_queryset(self):
        """Aplica el aislamiento de base de datos sobre el queryset de la vista.

        Firma estándar compatible con Django REST Framework.
        Sobreescribe automáticamente super().get_queryset() aplicando el filtro por tenant.
        """
        if hasattr(super(), 'get_queryset'):
            base_queryset = super().get_queryset()  # type: ignore
        else:
            base_queryset = getattr(self, 'queryset', None)
            if base_queryset is None:
                raise AttributeError("La vista debe definir el atributo 'queryset' o heredar de una clase que implemente 'get_queryset()'.")

        return self.filter_by_tenant(base_queryset)
