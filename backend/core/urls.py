from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('usuarios/', include('apps.usuarios.urls')),
    path('permisos/', include('apps.permisos.urls')),
    path('temperatura/', include('apps.temperatura.urls')),
    path('galpones/', include('apps.galpones.urls')),
    path('lotes/', include('apps.lotes.urls')),
    path('alimentacion/', include('apps.alimentacion.urls')),
    path('mortandad/', include('apps.mortandad.urls')),
    path('bitacora/', include('apps.bitacora.urls')),
	path('reportes/', include('apps.reportes.urls')),
	path('insumos/', include('apps.insumos.urls')),
	path('sanitario/', include('apps.sanitario.urls')),
    # ── SaaS ──────────────────────────────────────────────────────────────────
    path('empresas/', include('apps.empresas.urls')),
    path('pagos/', include('apps.pagos.urls')),
    # ── Mantenimiento / Backup (SuperAdmin) ───────────────────────────────────
    path('mantenimiento/', include('apps.mantenimiento.urls')),
]

