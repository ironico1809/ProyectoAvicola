from rest_framework import serializers

from apps.galpones.models import Galpon
from apps.lotes.models import Lote, ControlCalidad


class LoteSerializer(serializers.ModelSerializer):
    # Usamos id_galpon para que coincida con tu esquema SQL
    id_galpon = serializers.PrimaryKeyRelatedField(
        source='galpon', queryset=Galpon.objects.all())

    class Meta:
        model = Lote
        fields = [
            'id_lote',
            'id_galpon',
            'raza_tipo',
            'fecha_ingreso',
            'fecha_salida_estimada',
            'cantidad_inicial',
            'cantidad_actual',
            'peso_inicial',
            'estado',
        ]
        read_only_fields = ['id_lote']

    def validate(self, attrs):
        cantidad_inicial = attrs.get(
            'cantidad_inicial', getattr(
                self.instance, 'cantidad_inicial', None))
        cantidad_actual = attrs.get(
            'cantidad_actual', getattr(
                self.instance, 'cantidad_actual', None))

        if cantidad_inicial is not None and cantidad_inicial < 0:
            raise serializers.ValidationError(
                {'cantidad_inicial': 'Debe ser mayor o igual a 0.'})
        if cantidad_actual is not None and cantidad_actual < 0:
            raise serializers.ValidationError(
                {'cantidad_actual': 'Debe ser mayor o igual a 0.'})
        if cantidad_inicial is not None and cantidad_actual is not None and cantidad_actual > cantidad_inicial:
            raise serializers.ValidationError(
                {'cantidad_actual': 'No puede ser mayor que cantidad_inicial.'})

        return attrs


class ControlCalidadSerializer(serializers.ModelSerializer):
    id_lote = serializers.PrimaryKeyRelatedField(
        queryset=Lote.objects.all()
    )
    usuario_id = serializers.PrimaryKeyRelatedField(read_only=True)
    empresa_id = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ControlCalidad
        fields = [
            'id',
            'id_lote',
            'usuario_id',
            'empresa_id',
            'peso_registrado',
            'edad_dias',
            'peso_estandar',
            'porcentaje_diferencia',
            'estado_desarrollo',
            'observacion',
            'fecha_registro',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'usuario_id',
            'empresa_id',
            'edad_dias',
            'peso_estandar',
            'porcentaje_diferencia',
            'estado_desarrollo',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        from datetime import datetime, date
        from decimal import Decimal
        from django.utils import timezone
        from apps.lotes.models import CurvaCrecimientoEstandar

        lote = attrs.get('id_lote')
        peso_registrado = attrs.get('peso_registrado')
        fecha_registro = attrs.get('fecha_registro')

        if peso_registrado is None or peso_registrado <= 0:
            raise serializers.ValidationError({
                'peso_registrado': 'El peso registrado debe ser un número positivo.'
            })

        if not lote:
            raise serializers.ValidationError({
                'id_lote': 'El lote es requerido.'
            })

        fecha_ingreso = lote.fecha_ingreso

        if isinstance(fecha_registro, datetime):
            fecha_reg_date = fecha_registro.date()
        elif isinstance(fecha_registro, date):
            fecha_reg_date = fecha_registro
        else:
            fecha_reg_date = timezone.localdate()

        if fecha_reg_date < fecha_ingreso:
            raise serializers.ValidationError({
                'fecha_registro': 'La fecha de registro no puede ser anterior a la fecha de ingreso del lote.'
            })

        edad_dias = (fecha_reg_date - fecha_ingreso).days

        raza_tipo = lote.raza_tipo or ''
        curva = CurvaCrecimientoEstandar.objects.filter(
            raza__iexact=raza_tipo,
            edad_dias=edad_dias
        ).first()

        if curva:
            peso_estandar = Decimal(str(curva.peso_estandar))
        else:
            peso_estandar = Decimal('0.0')

        if peso_estandar > 0:
            porcentaje_diferencia = ((Decimal(str(peso_registrado)) - peso_estandar) / peso_estandar) * Decimal('100.0')
        else:
            porcentaje_diferencia = Decimal('0.0')

        # Asignar estado de desarrollo
        if peso_estandar == 0:
            estado_desarrollo = "Sin Referencia"
        elif porcentaje_diferencia < Decimal('-5.0'):
            estado_desarrollo = "Bajo Peso"
        elif porcentaje_diferencia > Decimal('5.0'):
            estado_desarrollo = "Sobrepeso"
        else:
            estado_desarrollo = "Normal"

        attrs['edad_dias'] = edad_dias
        attrs['peso_estandar'] = peso_estandar
        attrs['porcentaje_diferencia'] = porcentaje_diferencia
        attrs['estado_desarrollo'] = estado_desarrollo

        return attrs

