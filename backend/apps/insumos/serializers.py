from rest_framework import serializers
from apps.insumos.models import Insumo, Proveedor, MovimientoAlmacen


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = '__all__'


class InsumoSerializer(serializers.ModelSerializer):
    bajo_stock = serializers.ReadOnlyField()

    class Meta:
        model = Insumo
        fields = '__all__'


class MovimientoAlmacenSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.ReadOnlyField(source='insumo.nombre')
    insumo_unidad = serializers.ReadOnlyField(source='insumo.unidad_medida')
    proveedor_nombre = serializers.ReadOnlyField(source='proveedor.nombre')

    class Meta:
        model = MovimientoAlmacen
        fields = '__all__'
