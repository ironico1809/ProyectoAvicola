from django.urls import path

from apps.reportes.views import DashboardResumenView, ReporteGenerarView

urlpatterns = [
    path('generar/', ReporteGenerarView.as_view(), name='reporte_generar'),
    path('dashboard/', DashboardResumenView.as_view(), name='reporte_dashboard'),
]
