"""URLs de la app pagos para la pasarela SaaS."""

from django.urls import path

from apps.pagos.views import (
    CrearSesionCheckoutView,
    PlanesListView,
    StripeWebhookView,
)

urlpatterns = [
    path('planes/', PlanesListView.as_view(), name='pagos_planes_list'),
    path('crear-sesion/', CrearSesionCheckoutView.as_view(), name='pagos_crear_sesion'),
    path('webhook/', StripeWebhookView.as_view(), name='pagos_webhook'),
]
