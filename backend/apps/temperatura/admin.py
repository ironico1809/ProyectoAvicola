from django.contrib import admin

from apps.temperatura.models import TemperaturaGalpon, PrediccionTemperatura


@admin.register(TemperaturaGalpon)
class TemperaturaGalponAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'galpon',
        'temperatura',
        'estado',
        'fuente',
        'fecha_hora',
    ]

    list_filter = [
        'estado',
        'fuente',
        'galpon',
    ]

    search_fields = [
        'galpon__nombre',
        'estado',
        'fuente',
    ]

    ordering = [
        '-fecha_hora',
        '-id',
    ]


@admin.register(PrediccionTemperatura)
class PrediccionTemperaturaAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'galpon',
        'temperatura_predicha',
        'estado_predicho',
        'confianza',
        'umbral_superado',
        'horizonte_horas',
        'ventana_horas',
        'fecha_hora',
    ]

    list_filter = [
        'estado_predicho',
        'umbral_superado',
        'galpon',
    ]

    search_fields = [
        'galpon__nombre',
        'estado_predicho',
        'mensaje',
    ]

    ordering = [
        '-fecha_hora',
        '-id',
    ]