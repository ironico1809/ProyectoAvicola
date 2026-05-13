from rest_framework import serializers

from apps.temperatura.models import TemperaturaGalpon
from apps.galpones.models import Galpon


class TemperaturaGalponSerializer(serializers.ModelSerializer):
    """
    Serializer para convertir los registros de temperatura a JSON.

    También permite registrar una temperatura manualmente desde el frontend.
    La fuente no se expone al frontend: es un detalle interno del sistema.
    """

    # Usamos id_galpon para mantener el mismo estilo del proyecto.
    id_galpon = serializers.PrimaryKeyRelatedField(
        source='galpon',
        queryset=Galpon.objects.all()
    )

    # Nombre del galpón, solo para mostrar en el frontend.
    galpon_nombre = serializers.CharField(
        source='galpon.nombre',
        read_only=True
    )

    # Nombre del usuario que registró (solo lectura, para historial).
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = TemperaturaGalpon
        fields = [
            'id',
            'id_galpon',
            'galpon_nombre',
            'temperatura',
            'estado',
            'usuario_nombre',
            'fecha_hora',
        ]
        read_only_fields = [
            'id',
            'galpon_nombre',
            'estado',
            'usuario_nombre',
            'fecha_hora',
        ]

    def get_usuario_nombre(self, obj):
        """
        Devuelve el nombre del usuario que registró la temperatura.
        Si fue simulado (sin usuario), devuelve None.
        """
        if obj.usuario:
            return obj.usuario.nom_usuario
        return None

    def validate_temperatura(self, value):
        """
        Valida que la temperatura tenga un rango lógico para un galpón avícola.

        Rango permitido: 0°C a 60°C.
        Valores fuera de este rango son errores de tipeo, no datos reales.
        """
        if value < 0:
            raise serializers.ValidationError(
                'La temperatura no puede ser menor a 0°C.'
            )
        if value > 60:
            raise serializers.ValidationError(
                'La temperatura no puede ser mayor a 60°C. Verifique el valor ingresado.'
            )
        return value
