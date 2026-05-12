from rest_framework import serializers


class ReporteGenerarSerializer(serializers.Serializer):
    """Valida el payload para el motor de reportes.

    Se mantiene flexible (muchos campos opcionales) para permitir reportes cruzados.
    """

    entidad = serializers.ChoiceField(
        choices=['alimentacion', 'lotes', 'bitacora', 'insumos', 'sanitario'])

    # filtros comunes
    fecha_inicio = serializers.DateField(required=False, allow_null=True)
    fecha_fin = serializers.DateField(required=False, allow_null=True)

    # filtros por IDs (acepta singular o lista)
    galpon_id = serializers.IntegerField(required=False, allow_null=True)
    galpon_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
    lote_id = serializers.IntegerField(required=False, allow_null=True)
    lote_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )

    # filtros específicos
    tipo_alimento = serializers.CharField(
        required=False, allow_blank=True, allow_null=True)
    estado_lote = serializers.CharField(
        required=False, allow_blank=True, allow_null=True)
    accion = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True)
    usuario_id = serializers.IntegerField(required=False, allow_null=True)

    agrupar_por = serializers.ChoiceField(
    	choices=['dia', 'mes', 'galpon', 'tipo_alimento', 'raza_tipo', 'lote', 'estado'], required=False, allow_null=True
    )
    # salida
    formato = serializers.ChoiceField(
        choices=['json', 'csv', 'excel'], required=False, default='json'
    )

    def validate(self, attrs):
        fecha_inicio = attrs.get('fecha_inicio')
        fecha_fin = attrs.get('fecha_fin')
        if fecha_inicio and fecha_fin and fecha_inicio > fecha_fin:
            raise serializers.ValidationError(
                {'detail': '`fecha_inicio` no puede ser mayor que `fecha_fin`.'}
            )

        # normaliza ids singulares
        if attrs.get('galpon_id') and not attrs.get('galpon_ids'):
            attrs['galpon_ids'] = [attrs['galpon_id']]
        if attrs.get('lote_id') and not attrs.get('lote_ids'):
            attrs['lote_ids'] = [attrs['lote_id']]

        return attrs
