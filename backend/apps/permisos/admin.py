from django.contrib import admin

from apps.permisos.models import Permiso


@admin.register(Permiso)
class PermisoAdmin(admin.ModelAdmin):
    list_display = ('id_permiso', 'nombre')
    search_fields = ('nombre',)
