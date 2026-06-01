from django.urls import path

from apps.sanitario.views import (
    AplicacionesSanitariasView,
    HistorialClinicoLotesView,
    RegistroEnfermedadesView,
    DetalleEnfermedadView,
    AplicacionSanitariaDetailView,
)

urlpatterns = [
    # ── Existentes (sin cambios) ──────────────────────────────────────────
    path(
        'aplicaciones/',
        AplicacionesSanitariasView.as_view(),
        name='aplicaciones_sanitarias',
    ),
    path(
        'historial/',
        HistorialClinicoLotesView.as_view(),
        name='historial_clinico_lotes',
    ),

    # ── CU15 / HU3-01-03 ─────────────────────────────────────────────────
    path(
        'enfermedades/',
        RegistroEnfermedadesView.as_view(),
        name='registro_enfermedades',
    ),
    path(
        'enfermedades/<int:pk>/',
        DetalleEnfermedadView.as_view(),
        name='detalle_enfermedad',
    ),
    path(
        'aplicaciones/<int:pk>/',
        AplicacionSanitariaDetailView.as_view(),
        name='aplicacion_sanitaria_detail'),
]
