from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.insumos.views import (
    InsumoViewSet, ProveedorViewSet, MovimientoAlmacenView,
    AlertasStockView, StatsInventarioView
)
from apps.sanitario.views import AplicacionesSanitariasView

router = DefaultRouter()
router.register('catalogo', InsumoViewSet, basename='insumo')
router.register('proveedores', ProveedorViewSet, basename='proveedor')

urlpatterns = [
    path('', include(router.urls)),
    path(
        'movimientos/',
        MovimientoAlmacenView.as_view(),
        name='movimiento_list_create'),
    path('alertas/', AlertasStockView.as_view(), name='alertas_stock'),
    path('stats/', StatsInventarioView.as_view(), name='stats_inventario'),
    # Alias por compatibilidad (sanitario vive en /sanitario/)
    path(
        'control-sanitario/',
        AplicacionesSanitariasView.as_view(),
        name='control_sanitario'),
]
