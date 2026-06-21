"""Serializers de la app `galpones`.

Responsabilidad:
- Validar payloads de creación/edición de galpones.
- Serializar instancias de `Galpon` a JSON para respuestas de API.
"""

from rest_framework import serializers

from apps.galpones.models import Galpon


class GalponSerializer(serializers.ModelSerializer):
    """Serializador principal de Galpón.

    Entrada:
    - POST/PUT/PATCH: JSON con `nombre`, `capacidad`, `descripcion`, `estado`.

    Salida:
    - Respuestas API: JSON con `id` + campos del galpón.
    """
    poblacion_actual = serializers.SerializerMethodField()

    class Meta:
        model = Galpon
        fields = [
            'id', 'nombre', 'capacidad', 'descripcion', 'estado',
            'latitud', 'longitud', 'ubicacion_nombre', 'poblacion_actual',
        ]
        read_only_fields = ['id', 'poblacion_actual']

    def get_poblacion_actual(self, obj):
        # Sumar cantidad_actual de los lotes no finalizados asociados al galpón
        lotes_activos = obj.lotes.exclude(estado__in=['Vendido', 'Inactivo'])
        total = sum(lote.cantidad_actual for lote in lotes_activos)
        return total
