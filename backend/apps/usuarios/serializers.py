from django.contrib.auth.hashers import make_password
from rest_framework import serializers

from apps.usuarios.models import Usuario


class LoginSerializer(serializers.Serializer):
    nom_usuario = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'nom_usuario', 'email', 'tipo_usuario', 'estado']


class RegistroUsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Usuario
        fields = ['nom_usuario', 'email', 'password', 'tipo_usuario', 'estado']

    def create(self, validated_data):
        raw_password = validated_data.pop('password')
        usuario = Usuario.objects.create(
            **validated_data,
            password=make_password(raw_password),
        )
        return usuario


class UsuarioUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = Usuario
        fields = ['nom_usuario', 'email', 'password', 'tipo_usuario', 'estado']

    def update(self, instance, validated_data):
        raw_password = validated_data.pop('password', None)
        for field_name, value in validated_data.items():
            setattr(instance, field_name, value)
        if raw_password:
            instance.password = make_password(raw_password)
        instance.save()
        return instance