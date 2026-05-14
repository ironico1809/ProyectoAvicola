"""URLs de la app `mantenimiento`."""

from django.urls import path

from apps.mantenimiento.views import (
    BackupConfigView,
    BackupListView,
    BackupManualView,
    DescargarBackupView,
    EstadoMantenimientoView,
    RestoreView,
)

urlpatterns = [
    # Endpoint público — sin autenticación, para polling del frontend
    path("estado/", EstadoMantenimientoView.as_view(), name="estado_mantenimiento"),
    # Endpoints protegidos (IsSuperAdmin)
    path("config/", BackupConfigView.as_view(), name="backup_config"),
    path("backups/", BackupListView.as_view(), name="backup_list"),
    path("backup-manual/", BackupManualView.as_view(), name="backup_manual"),
    path("restore/", RestoreView.as_view(), name="backup_restore"),
    path("descargar/<int:backup_id>/", DescargarBackupView.as_view(), name="backup_descargar"),
]
