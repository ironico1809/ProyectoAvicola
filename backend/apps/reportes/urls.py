from django.urls import path

from apps.reportes.views import ReporteGenerarView

urlpatterns = [
    path('generar/', ReporteGenerarView.as_view(), name='reporte_generar'),
]
