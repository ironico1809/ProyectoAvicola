from rest_framework import serializers
from .models import RegistroMortalidad

class RegistroMortalidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroMortalidad
        fields = '__all__'