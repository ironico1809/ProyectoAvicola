from rest_framework import serializers

from galpones.models import Galpon


class GalponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Galpon
        fields = ['id', 'nombre', 'capacidad', 'descripcion', 'estado']
        read_only_fields = ['id']
