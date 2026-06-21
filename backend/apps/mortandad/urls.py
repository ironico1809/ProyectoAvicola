from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegistroMortalidadViewSet,
    PrediccionMortalidadHistorialView,
    PrediccionMortalidadGenerarView,
    RecomendacionActualizarView,
    RecomendacionesPendientesView,
    RecomendacionesCentroView,
)

router = DefaultRouter()
router.register(r'', RegistroMortalidadViewSet, basename='mortandad')

urlpatterns = [
    path('prediccion/historial/', PrediccionMortalidadHistorialView.as_view(), name='prediccion-mortalidad-historial'),
    path('prediccion/generar/', PrediccionMortalidadGenerarView.as_view(), name='prediccion-mortalidad-generar'),
    path('prediccion/recomendaciones/pendientes/', RecomendacionesPendientesView.as_view(), name='prediccion-mortalidad-recomendaciones-pendientes'),
    path('prediccion/recomendaciones/centro/', RecomendacionesCentroView.as_view(), name='prediccion-mortalidad-recomendaciones-centro'),
    path('prediccion/<int:id_prediccion>/recomendacion/', RecomendacionActualizarView.as_view(), name='prediccion-mortalidad-recomendacion'),
    path('', include(router.urls)),
]