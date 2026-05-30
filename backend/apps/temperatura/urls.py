from django.urls import path

from apps.temperatura.views import (
    TemperaturaTiempoRealView,
    TemperaturaManualCreateView,
    TemperaturaHistorialView,
    TemperaturaUltimaPorGalponView,
    TemperaturaAlertasView,
    ReverseGeocodingView,
    SimulacionIniciarView,
    ClimaActualView,
    ClimaManualOverrideView,
    PrediccionTemperaturaUltimaView,
    PrediccionTemperaturaUltimasView,
    PrediccionTemperaturaGenerarView,
)

urlpatterns = [
    # CU09: monitoreo en tiempo real (usa WeatherManager si hay base real)
    path('tiempo-real/', TemperaturaTiempoRealView.as_view(), name='temperatura_tiempo_real'),

    # CU08: registro manual de temperatura
    path('manual/', TemperaturaManualCreateView.as_view(), name='temperatura_manual'),

    # Historial de temperaturas
    path('historial/', TemperaturaHistorialView.as_view(), name='temperatura_historial'),

    # Última temperatura por galpón
    path('ultimas/', TemperaturaUltimaPorGalponView.as_view(), name='temperatura_ultimas'),

    # Alertas globales
    path('alertas/', TemperaturaAlertasView.as_view(), name='temperatura_alertas'),

    # Reverse Geocoding: lat/lon → nombre del lugar
    path('reverse-geocoding/', ReverseGeocodingView.as_view(), name='temperatura_reverse_geocoding'),

    # Iniciar monitoreo con base real de OpenWeather
    path('simulacion/iniciar/', SimulacionIniciarView.as_view(), name='temperatura_simulacion_iniciar'),

    # Clima actual del WeatherManager (sin guardar en BD)
    path('clima/actual/', ClimaActualView.as_view(), name='temperatura_clima_actual'),

    # Forzar valor manual en el WeatherManager (para pruebas de alerta)
    path('clima/manual/', ClimaManualOverrideView.as_view(), name='temperatura_clima_manual'),

    # CU27: predicción de temperatura (IA)
    path('prediccion/ultima/', PrediccionTemperaturaUltimaView.as_view(), name='temperatura_prediccion_ultima'),
    path('prediccion/ultimas/', PrediccionTemperaturaUltimasView.as_view(), name='temperatura_prediccion_ultimas'),
    path('prediccion/generar/', PrediccionTemperaturaGenerarView.as_view(), name='temperatura_prediccion_generar'),
]
