"""Modelos de la app `bitacora`.

La bitácora sirve como auditoría: guarda quién hizo qué, cuándo y desde dónde.
Estos registros se consultan luego desde el endpoint de bitácora o desde el admin.
"""

from django.db import models


class BitacoraEvento(models.Model):
    """Evento de auditoría.

    Campos principales (resumen):
    - `usuario` / `nom_usuario`: actor que ejecutó la acción (puede ser NULL).
    - `accion`: verbo (login, logout, crear, editar, eliminar, asignar_roles, etc.).
    - `modulo`: área del sistema (usuarios, roles, permisos, galpones, lotes, auth, ...).
    - `entidad` / `entidad_id`: objeto afectado (ej. "Lote" id 12).
    - `detalle`: información adicional serializada (JSON o string).
    - `metodo` / `path` / `ip` / `user_agent`: contexto HTTP del request.
    - `created_at`: fecha/hora de creación del evento.

    Devuelve (cuando se consulta por ORM): instancias de `BitacoraEvento`.
    """
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
