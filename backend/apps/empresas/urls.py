"""URLs de la app empresas."""

from django.urls import path

from apps.empresas.views import (
    PlanesListView,
    SuperAdminMetricasView,
    SuperAdminClienteView,
    SuperAdminInfraView,
    SuperAdminBitacoraView,
    SuperAdminConfigIAView,
)

urlpatterns = [
    # Público
    path('planes/', PlanesListView.as_view(), name='planes_list'),

    # SuperAdmin — métricas globales
    path('superadmin/metricas/', SuperAdminMetricasView.as_view(), name='superadmin_metricas'),

    # SuperAdmin — alta de nuevo cliente
    path('superadmin/clientes/', SuperAdminClienteView.as_view(), name='superadmin_clientes'),

    # SuperAdmin — infraestructura y seguridad
    path('superadmin/infraestructura/', SuperAdminInfraView.as_view(), name='superadmin_infra'),

    # SuperAdmin — bitácora global
    path('superadmin/bitacora/', SuperAdminBitacoraView.as_view(), name='superadmin_bitacora'),

    # SuperAdmin — configuración IA
    path('superadmin/config-ia/', SuperAdminConfigIAView.as_view(), name='superadmin_config_ia'),
]
