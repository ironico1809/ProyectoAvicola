from rest_framework import serializers

class LoginSerializer(serializers.Serializer):
    nom_usuario = serializers.CharField()
    password = serializers.CharField()

    from rest_framework import serializers
from apps.usuarios.models import Usuario

class RegistroUsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['nom_usuario', 'email', 'password', 'tipo_usuario', 'estado']

    def create(self, validated_data):
        password = validated_data.pop('password')
        usuario = Usuario(**validated_data)
        usuario.set_password(password)
        return usuario