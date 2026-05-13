"""Serializers de la app empresas.

PlanPublicoSerializer: expone solo los campos necesarios
para la landing page de pricing. No expone stripe_price_id
directamente al cliente para evitar manipulación.
"""

from rest_framework import serializers

from apps.empresas.models import Empresa, Plan, Suscripcion


class PlanPublicoSerializer(serializers.ModelSerializer):
    """Serializer para listar planes en la landing page (público)."""

    class Meta:
        model = Plan
        fields = [
            'id',
            'nombre',
            'precio_mensual',
            'max_galpones',
            'max_usuarios',
        ]


class EmpresaSerializer(serializers.ModelSerializer):
    """Serializer básico de empresa (uso interno / admin)."""

    plan_nombre = serializers.CharField(source='plan.nombre', read_only=True)

    class Meta:
        model = Empresa
        fields = [
            'id',
            'nombre',
            'email_contacto',
            'plan',
            'plan_nombre',
            'estado',
            'fecha_creacion',
        ]
        read_only_fields = ['id', 'plan_nombre', 'fecha_creacion']


class SuscripcionSerializer(serializers.ModelSerializer):
    """Serializer de suscripción (uso interno / admin)."""

    class Meta:
        model = Suscripcion
        fields = [
            'id',
            'empresa',
            'estado',
            'stripe_customer_id',
            'fecha_inicio',
            'fecha_proximo_cobro',
        ]
        read_only_fields = fields
