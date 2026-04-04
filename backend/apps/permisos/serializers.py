from rest_framework import serializers

from apps.permisos.models import Permiso


class PermisoSerializer(serializers.ModelSerializer):
    """Serializer para exponer permisos al frontend."""

    class Meta:
        model = Permiso
        fields = ['id_permiso', 'nombre', 'descripcion']
        read_only_fields = ['id_permiso']


class RolPermisosSerializer(serializers.Serializer):
    """Entrada para agregar/quitar permisos a un rol por id_permiso."""

    add = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)
    remove = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)

    def validate(self, attrs):
        if 'add' not in attrs and 'remove' not in attrs:
            raise serializers.ValidationError('Debes enviar "add" y/o "remove".')
        return attrs


class RolPermisosReplaceSerializer(serializers.Serializer):
    """Entrada para reemplazar TODOS los permisos de un rol."""

    permisos = serializers.ListField(child=serializers.IntegerField(), required=True, allow_empty=True)
