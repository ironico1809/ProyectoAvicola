from django.contrib import admin

from apps.galpones.models import Galpon


@admin.register(Galpon)
class GalponAdmin(admin.ModelAdmin):
	list_display = ('id', 'nombre', 'capacidad', 'estado')
	search_fields = ('nombre',)

# Register your models here.
