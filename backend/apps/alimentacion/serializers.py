from rest_framework import serializers

from apps.alimentacion.models import Alimentacion
from apps.lotes.models import Lote


class AlimentacionSerializer(serializers.ModelSerializer):
    # Usamos id_lote para que coincida con tu esquema SQL
    id_lote = serializers.PrimaryKeyRelatedField(
        source='lote', queryset=Lote.objects.all())
    insumo_id = serializers.IntegerField(required=False, allow_null=True)
    insumo_nombre = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Alimentacion
        fields = [
            'id_alimentacion',
            'id_lote',
            'insumo_id',
            'insumo_nombre',
            'fecha',
            'cantidad_kg',
            'tipo_alimento',
            'observacion',
        ]
        read_only_fields = ['id_alimentacion', 'insumo_nombre']

    def get_insumo_nombre(self, obj):
        if obj.insumo:
            return obj.insumo.nombre
        return None

    def validate_cantidad_kg(self, value):
        if value is None:
            return value
        if value <= 0:
            raise serializers.ValidationError('Debe ser mayor que 0.')
        return value

    def validate(self, attrs):
        lote = attrs.get('lote')
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            if not (getattr(user, 'is_superuser', False) or getattr(user, 'tipo_usuario', '') == 'Superusuario'):
                tenant_id = getattr(user, 'empresa_id', None)
                if tenant_id and lote and lote.empresa_id != tenant_id:
                    raise serializers.ValidationError({'id_lote': 'El lote seleccionado no pertenece a su empresa.'})
        return attrs
