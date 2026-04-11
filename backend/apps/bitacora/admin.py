"""Admin de la app `bitacora`.

Configura cómo se ven y se filtran los eventos en el panel /admin.
"""

from django.contrib import admin

from apps.bitacora.models import BitacoraEvento


@admin.register(BitacoraEvento)
class BitacoraEventoAdmin(admin.ModelAdmin):
    """Presentación de eventos de bitácora en Django Admin."""
    list_display = ('id', 'created_at', 'modulo', 'accion', 'nom_usuario', 'entidad', 'entidad_id', 'ip')
    search_fields = ('nom_usuario', 'modulo', 'accion', 'entidad', 'entidad_id', 'ip')
    list_filter = ('modulo', 'accion', 'created_at')
