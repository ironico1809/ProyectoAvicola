from rest_framework import serializers

from apps.bitacora.models import BitacoraEvento


class BitacoraEventoSerializer(serializers.ModelSerializer):
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
