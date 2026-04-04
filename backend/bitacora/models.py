from django.db import models


class BitacoraEvento(models.Model):
    id = models.BigAutoField(primary_key=True)

    usuario = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eventos_bitacora',
        db_constraint=False,
    )
    nom_usuario = models.CharField(max_length=50, blank=True, null=True)

    accion = models.CharField(max_length=50)  # login, logout, crear, editar, eliminar, asignar, quitar, etc.
    modulo = models.CharField(max_length=50)  # usuarios, roles, permisos, galpones, lotes, auth

    entidad = models.CharField(max_length=50, blank=True, null=True)  # Usuario, Rol, Permiso, Galpon, Lote
    entidad_id = models.CharField(max_length=64, blank=True, null=True)

    detalle = models.TextField(blank=True, null=True)

    metodo = models.CharField(max_length=10, blank=True, null=True)
    path = models.TextField(blank=True, null=True)

    ip = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bitacora_eventos'
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f"{self.created_at} {self.modulo}:{self.accion} ({self.nom_usuario})"
