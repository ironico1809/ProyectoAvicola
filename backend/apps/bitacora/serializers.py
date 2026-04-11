"""Serializers de la app `bitacora`.

Los serializers convierten instancias del modelo a JSON (respuesta) y validan datos
de entrada si se agregaran endpoints de escritura.
"""

from rest_framework import serializers

from apps.bitacora.models import BitacoraEvento


class BitacoraEventoSerializer(serializers.ModelSerializer):
    """Serializa un `BitacoraEvento`.

    - Entrada: instancia de `BitacoraEvento` (o queryset con `many=True`).
    - Salida: dict/JSON con campos del evento (id, timestamps, actor, acción, contexto, etc.).
    """
    class Meta:
        model = BitacoraEvento
        fields = [
            'id',
            'created_at',
            'usuario',
            'nom_usuario',
            'accion',
            'modulo',
            'entidad',
            'entidad_id',
            'detalle',
            'metodo',
            'path',
            'ip',
            'user_agent',
        ]
