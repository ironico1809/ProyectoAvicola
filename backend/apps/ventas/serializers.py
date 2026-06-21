from rest_framework import serializers
from decimal import Decimal
from apps.ventas.models import Cliente, VentaLote
from apps.lotes.models import Lote


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = ['id_cliente', 'nombre', 'telefono', 'email']
        read_only_fields = ['id_cliente']


class VentaLoteSerializer(serializers.ModelSerializer):
    id_cliente = serializers.PrimaryKeyRelatedField(
        source='cliente', queryset=Cliente.objects.all()
    )
    id_lote = serializers.PrimaryKeyRelatedField(
        source='lote', queryset=Lote.objects.all()
    )
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)
    lote_raza = serializers.CharField(source='lote.raza_tipo', read_only=True)
    lote_galpon_nombre = serializers.CharField(source='lote.galpon.nombre', read_only=True)

    class Meta:
        model = VentaLote
        fields = [
            'id_venta',
            'id_cliente',
            'cliente_nombre',
            'id_lote',
            'lote_raza',
            'lote_galpon_nombre',
            'fecha_venta',
            'cantidad',
            'precio_unitario',
            'precio_total',
            'peso_total_vendido',
            'tipo_venta',
            'observacion',
        ]
        read_only_fields = ['id_venta', 'precio_total', 'fecha_venta']

    def validate(self, attrs):
        lote = attrs.get('lote')
        cliente = attrs.get('cliente')
        cantidad = attrs.get('cantidad')
        precio_unitario = attrs.get('precio_unitario')
        tipo_venta = attrs.get('tipo_venta', 'Por unidad')
        peso_total_vendido = attrs.get('peso_total_vendido')

        # Validar pertenencia del cliente y lote al tenant
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            # Ignorar validación de tenant si es superusuario
            if not (getattr(user, 'is_superuser', False) or getattr(user, 'tipo_usuario', '') == 'Superusuario'):
                tenant_id = getattr(user, 'empresa_id', None)
                if lote.empresa_id != tenant_id:
                    raise serializers.ValidationError({'id_lote': 'El lote seleccionado no pertenece a su empresa.'})
                if cliente.empresa_id != tenant_id:
                    raise serializers.ValidationError({'id_cliente': 'El cliente seleccionado no pertenece a su empresa.'})

        if cantidad <= 0:
            raise serializers.ValidationError({'cantidad': 'La cantidad debe ser mayor a 0.'})

        if precio_unitario <= 0:
            raise serializers.ValidationError({'precio_unitario': 'El precio unitario debe ser mayor a 0.'})

        # Validar disponibilidad del lote
        if lote.estado not in ['Listo para venta', 'Listo']:
            raise serializers.ValidationError({'id_lote': 'Solo se pueden comercializar lotes que estén en estado "Listo para venta".'})

        if lote.cantidad_actual <= 0:
            raise serializers.ValidationError({'id_lote': 'El lote seleccionado está vacío.'})

        if cantidad > lote.cantidad_actual:
            raise serializers.ValidationError({'cantidad': f'La cantidad a vender supera el stock disponible en el lote ({lote.cantidad_actual} aves).'})

        # Calcular precio total
        if tipo_venta == 'Por peso':
            if not peso_total_vendido or peso_total_vendido <= 0:
                raise serializers.ValidationError({'peso_total_vendido': 'Para ventas por peso, debe ingresar un peso total válido y mayor a 0.'})
            attrs['precio_total'] = Decimal(str(peso_total_vendido)) * Decimal(str(precio_unitario))
        else:
            attrs['precio_total'] = Decimal(str(cantidad)) * Decimal(str(precio_unitario))

        return attrs
