from rest_framework import serializers

from apps.insumos.models import ControlSanitario
from apps.sanitario.models import AlertaSanitaria


class ControlSanitarioSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.ReadOnlyField(source='insumo.nombre')
    insumo_tipo = serializers.ReadOnlyField(source='insumo.tipo')
    insumo_unidad = serializers.ReadOnlyField(source='insumo.unidad_medida')

    class Meta:
        model = ControlSanitario
        fields = '__all__'

    def validate(self, attrs):
        lote = attrs.get('lote')
        insumo = attrs.get('insumo')
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            if not (getattr(user, 'is_superuser', False) or getattr(user, 'tipo_usuario', '') == 'Superusuario'):
                tenant_id = getattr(user, 'empresa_id', None)
                if tenant_id:
                    if lote and lote.empresa_id != tenant_id:
                        raise serializers.ValidationError({'lote': 'El lote seleccionado no pertenece a su empresa.'})
                    if insumo and insumo.empresa_id != tenant_id:
                        raise serializers.ValidationError({'insumo': 'El insumo seleccionado no pertenece a su empresa.'})
        return attrs


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
            raise serializers.ValidationError('Debe seleccionar un lote para continuar.')
        return value

    def validate_enfermedad_sintoma(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El campo de enfermedad es obligatorio.')
        return value.strip()

    def validate_cantidad_aves_afectadas(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('La cantidad de aves afectadas no puede ser negativa.')
        return value

    def validate_porcentaje_afectacion(self, value):
        if value is not None and not (0 <= float(value) <= 100):
            raise serializers.ValidationError('El porcentaje debe estar entre 0 y 100.')
        return value

    def validate(self, attrs):
        cantidad = attrs.get('cantidad_aves_afectadas')
        porcentaje = attrs.get('porcentaje_afectacion')
        if cantidad is None and porcentaje is None:
            raise serializers.ValidationError({
                'cantidad_aves_afectadas':
                    'Debe ingresar la cantidad de aves afectadas o el porcentaje de afectación.'
            })

        # Validar pertenencia del lote al tenant
        lote = attrs.get('lote')
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            if not (getattr(user, 'is_superuser', False) or getattr(user, 'tipo_usuario', '') == 'Superusuario'):
                tenant_id = getattr(user, 'empresa_id', None)
                if tenant_id and lote and lote.empresa_id != tenant_id:
                    raise serializers.ValidationError({'lote': 'El lote seleccionado no pertenece a su empresa.'})
        return attrs

    def create(self, validated_data):
        validated_data.setdefault('tipo_registro', 'enfermedad')
        validated_data.setdefault('tipo_tratamiento', 'Otro')
        validated_data.setdefault('dosis', None)
        validated_data.setdefault('unidad_dosis', '')
        validated_data.setdefault('estado_enfermedad', 'activo')
        return super().create(validated_data)


class AlertaSanitariaSerializer(serializers.ModelSerializer):
    lote_info = serializers.SerializerMethodField(read_only=True)
    enfermedad_info = serializers.SerializerMethodField(read_only=True)
    insumo_info = serializers.SerializerMethodField(read_only=True)
    usuario_nombre = serializers.ReadOnlyField(source='usuario.nom_usuario')

    class Meta:
        model = AlertaSanitaria
        fields = [
            'id',
            'lote',
            'lote_info',
            'registro_enfermedad',
            'enfermedad_info',
            'insumo',
            'insumo_info',
            'tipo_alerta',
            'nivel',
            'causa',
            'mensaje',
            'porcentaje_detectado',
            'cantidad_detectada',
            'estado',
            'fecha_hora',
            'usuario',
            'usuario_nombre',
            'empresa',
        ]

        read_only_fields = [
            'id',
            'lote',
            'lote_info',
            'registro_enfermedad',
            'enfermedad_info',
            'insumo',
            'insumo_info',
            'tipo_alerta',
            'nivel',
            'causa',
            'mensaje',
            'porcentaje_detectado',
            'cantidad_detectada',
            'fecha_hora',
            'usuario',
            'usuario_nombre',
            'empresa',
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

    def get_enfermedad_info(self, obj):
        enfermedad = obj.registro_enfermedad
        if not enfermedad:
            return None
        return {
            'id': enfermedad.id,
            'enfermedad_sintoma': enfermedad.enfermedad_sintoma,
            'estado_enfermedad': enfermedad.estado_enfermedad,
        }

    def get_insumo_info(self, obj):
        insumo = obj.insumo
        if not insumo:
            return None
        return {
            'id_insumo': insumo.id_insumo,
            'nombre': insumo.nombre,
            'tipo': insumo.tipo,
            'unidad_medida': insumo.unidad_medida,
            'stock_actual': str(insumo.stock_actual),
            'stock_minimo': str(insumo.stock_minimo),
        }
