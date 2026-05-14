"""Serializers de la app `mantenimiento`."""

from rest_framework import serializers

from apps.mantenimiento.models import BackupConfig, BackupLog


class BackupConfigSerializer(serializers.ModelSerializer):
    """Serializer de lectura/escritura para BackupConfig."""

    hora_automatica = serializers.TimeField(
        format="%H:%M",
        input_formats=["%H:%M", "%H:%M:%S"],
        allow_null=True,
        required=False,
    )

    class Meta:
        model = BackupConfig
        fields = ["id", "hora_automatica", "activo"]


class BackupLogSerializer(serializers.ModelSerializer):
    """Serializer de solo lectura para el historial de respaldos."""

    fecha_creacion = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)

    class Meta:
        model = BackupLog
        fields = ["id", "nombre_archivo", "fecha_creacion", "tamano", "tipo"]
        read_only_fields = fields


class BackupEstadoSerializer(serializers.ModelSerializer):
    """Serializer de solo lectura para el endpoint público de estado de mantenimiento.

    Devuelve la información que el frontend necesita para mostrar/ocultar
    la pantalla de bloqueo global.
    """

    en_mantenimiento = serializers.BooleanField(source="modo_mantenimiento", read_only=True)
    hasta = serializers.DateTimeField(
        source="mantenimiento_hasta",
        format="%Y-%m-%dT%H:%M:%SZ",
        allow_null=True,
        read_only=True,
    )
    segundos_restantes = serializers.SerializerMethodField()

    class Meta:
        model = BackupConfig
        fields = ["en_mantenimiento", "hasta", "segundos_restantes"]

    def get_segundos_restantes(self, obj) -> int:
        return obj.segundos_restantes
