from rest_framework import serializers

from apps.insumos.models import ControlSanitario


class ControlSanitarioSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.ReadOnlyField(source='insumo.nombre')
    insumo_tipo = serializers.ReadOnlyField(source='insumo.tipo')
    insumo_unidad = serializers.ReadOnlyField(source='insumo.unidad_medida')

    class Meta:
        model = ControlSanitario
        fields = '__all__'
