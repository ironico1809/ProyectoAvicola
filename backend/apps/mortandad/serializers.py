from rest_framework import serializers
from .models import RegistroMortalidad, PrediccionMortalidad

class RegistroMortalidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroMortalidad
        fields = '__all__'

    def validate(self, attrs):
        lote = attrs.get('lote')
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            if not (getattr(user, 'is_superuser', False) or getattr(user, 'tipo_usuario', '') == 'Superusuario'):
                tenant_id = getattr(user, 'empresa_id', None)
                if tenant_id and lote and lote.empresa_id != tenant_id:
                    raise serializers.ValidationError({'lote': 'El lote seleccionado no pertenece a su empresa.'})
        return attrs

class PrediccionMortalidadSerializer(serializers.ModelSerializer):
    lote_codigo = serializers.CharField(source='lote.id_lote', read_only=True)
    galpon_nombre = serializers.CharField(source='lote.galpon.nombre', read_only=True)

    class Meta:
        model = PrediccionMortalidad
        fields = '__all__'