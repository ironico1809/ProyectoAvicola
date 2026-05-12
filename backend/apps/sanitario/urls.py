from django.urls import path

from apps.sanitario.views import AplicacionesSanitariasView, HistorialClinicoLotesView

urlpatterns = [
    path(
        'aplicaciones/',
        AplicacionesSanitariasView.as_view(),
        name='aplicaciones_sanitarias'),
    path(
        'historial/',
        HistorialClinicoLotesView.as_view(),
        name='historial_clinico_lotes'),
]
