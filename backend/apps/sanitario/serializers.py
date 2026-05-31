from rest_framework import serializers

from apps.insumos.models import ControlSanitario


class ControlSanitarioSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.ReadOnlyField(source='insumo.nombre')
    insumo_tipo = serializers.ReadOnlyField(source='insumo.tipo')
    insumo_unidad = serializers.ReadOnlyField(source='insumo.unidad_medida')

    class Meta:
        model = ControlSanitario
        fields = '__all__'

class RegistroEnfermedadSerializer(serializers.ModelSerializer):
    lote_info = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ControlSanitario
        fields = [
            'id',
            'lote',
            'lote_info',
            'enfermedad_sintoma',
            'cantidad_aves_afectadas',
            'porcentaje_afectacion',
            'estado_enfermedad',
            'observacion',
            'fecha_registro',
            'usuario',
            'empresa',
            'tipo_registro',
            'tipo_tratamiento',
            'dosis',
            'unidad_dosis',
        ]
        read_only_fields = [
            'id', 'fecha_registro', 'tipo_registro',
            'tipo_tratamiento', 'dosis', 'unidad_dosis',
            'estado_enfermedad', 'usuario', 'empresa',
        ]

    def get_lote_info(self, obj):
        lote = obj.lote
        if not lote:
            return None
        return {
            'id_lote': lote.id_lote,
            'estado': lote.estado,
            'raza_tipo': lote.raza_tipo,
            'cantidad_actual': lote.cantidad_actual,
        }

    def validate_lote(self, value):
        if not value:
            raise serializers.ValidationError(
                'Debe seleccionar un lote para continuar.')
        return value

    def validate_enfermedad_sintoma(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError(
                'El campo de enfermedad es obligatorio.')
        return value.strip()

    def validate_cantidad_aves_afectadas(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                'La cantidad de aves afectadas no puede ser negativa.')
        return value

    def validate_porcentaje_afectacion(self, value):
        if value is not None and not (0 <= float(value) <= 100):
            raise serializers.ValidationError(
                'El porcentaje debe estar entre 0 y 100.')
        return value

    def validate(self, attrs):
        cantidad = attrs.get('cantidad_aves_afectadas')
        porcentaje = attrs.get('porcentaje_afectacion')
        if cantidad is None and porcentaje is None:
            raise serializers.ValidationError({
                'cantidad_aves_afectadas':
                    'Debe ingresar la cantidad de aves afectadas '
                    'o el porcentaje de afectación.'
            })
        return attrs

    def create(self, validated_data):
        validated_data.setdefault('tipo_registro', 'enfermedad')
        validated_data.setdefault('tipo_tratamiento', 'Otro')
        validated_data.setdefault('dosis', None)
        validated_data.setdefault('unidad_dosis', '')
        validated_data.setdefault('estado_enfermedad', 'activo')
        return super().create(validated_data)
