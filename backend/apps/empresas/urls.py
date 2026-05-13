"""URLs de la app empresas."""

from django.urls import path

from apps.empresas.views import PlanesListView

urlpatterns = [
    # GET /empresas/planes/ → lista de planes para la landing page
    path('planes/', PlanesListView.as_view(), name='planes_list'),
]
