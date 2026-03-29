from django.db import models
from django.contrib.auth.hashers import make_password, check_password

class Usuario(models.Model):
    nom_usuario = models.CharField(max_length=50, unique=True)
    email = models.EmailField(max_length=255)
    password = models.CharField(max_length=255)
    tipo_usuario = models.CharField(max_length=50, blank=True, null=True)
    estado = models.CharField(max_length=20, blank=True, null=True)

    # Método para encriptar y guardar la contraseña
    def set_password(self, raw_password):
        self.password = make_password(raw_password)
        self.save()

    # Método para verificar la contraseña
    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    class Meta:
        db_table = 'usuarios'

    def __str__(self):
        return self.nom_usuario