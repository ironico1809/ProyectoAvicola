from django.contrib import admin

from apps.temperatura.models import (
    TemperaturaGalpon,
    PrediccionTemperatura,
    ModeloSensorVirtualTemperatura,
)


@admin.register(TemperaturaGalpon)
class TemperaturaGalponAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'galpon',
        'temperatura',
        'temperatura_externa',
        'humedad_externa',
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


@admin.register(ModeloSensorVirtualTemperatura)
class ModeloSensorVirtualTemperaturaAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'empresa',
        'galpon',
        'r2',
        'n_muestras',
        'ventana_horas',
        'fecha_hora',
    ]

    list_filter = [
        'empresa',
        'galpon',
    ]

    ordering = [
        '-fecha_hora',
        '-id',
    ]