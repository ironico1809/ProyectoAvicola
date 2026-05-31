from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.lotes.views import (
    LoteDetailView,
    LoteListCreateView,
    LotesResumenEstadoView,
    ControlCalidadViewSet
)

router = DefaultRouter()
router.register(r'control-calidad', ControlCalidadViewSet, basename='control-calidad')

urlpatterns = [
    # CRUD
    path('', LoteListCreateView.as_view(), name='lotes_list_create'),
    # Resumen
    path(
        'resumen/estados/',
        LotesResumenEstadoView.as_view(),
        name='lotes_resumen_estados'),
    path('<int:id_lote>/', LoteDetailView.as_view(), name='lotes_detail'),
    # Router urls
    path('', include(router.urls)),
]

