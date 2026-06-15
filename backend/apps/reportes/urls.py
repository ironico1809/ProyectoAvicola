from django.urls import path

from apps.reportes.views import DashboardResumenView, DashboardMonitoreoView, ReporteGenerarView

urlpatterns = [
    path('generar/', ReporteGenerarView.as_view(), name='reporte_generar'),
    path('dashboard/', DashboardResumenView.as_view(), name='reporte_dashboard'),
    path('monitoreo/', DashboardMonitoreoView.as_view(), name='reporte_monitoreo'),
]
