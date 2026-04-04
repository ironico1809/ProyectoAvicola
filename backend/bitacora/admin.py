from django.contrib import admin

from bitacora.models import BitacoraEvento


@admin.register(BitacoraEvento)
class BitacoraEventoAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'modulo', 'accion', 'nom_usuario', 'entidad', 'entidad_id', 'ip')
    search_fields = ('nom_usuario', 'modulo', 'accion', 'entidad', 'entidad_id', 'ip')
    list_filter = ('modulo', 'accion', 'created_at')
