from django.contrib import admin

from lotes.models import Lote


@admin.register(Lote)
class LoteAdmin(admin.ModelAdmin):
	list_display = ('id_lote', 'galpon', 'cantidad_inicial', 'cantidad_actual', 'estado', 'fecha_ingreso')
	search_fields = ('id_lote', 'galpon__nombre')
	list_filter = ('estado', 'fecha_ingreso')

# Register your models here.
