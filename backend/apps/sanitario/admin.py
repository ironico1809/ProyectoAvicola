from django.contrib import admin

from apps.sanitario.models import AlertaSanitaria


@admin.register(AlertaSanitaria)
class AlertaSanitariaAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'lote',
        'tipo_alerta',
        'nivel',
        'estado',
        'porcentaje_detectado',
        'cantidad_detectada',
        'fecha_hora',
    )

    list_filter = (
        'tipo_alerta',
        'nivel',
        'estado',
        'fecha_hora',
    )

    search_fields = (
        'causa',
        'mensaje',
    )

    readonly_fields = (
        'fecha_hora',
    )