"""Modelos de la app `usuarios`.

Incluye:
- `Usuario`: modelo principal de autenticación del sistema.
- `Rol`: roles del sistema (tabla `rol`).

Importante:
- No se usa `django.contrib.auth.models.User`.
- Password se guarda hasheado (helpers `make_password`/`check_password`).
- `empresa`: FK al tenant (Empresa). Añadido en FASE 1 SaaS.
- `must_change_password`: si True, el frontend obliga a cambiar la clave
  en el primer login (usuarios creados automáticamente por el webhook de Stripe).
"""

from django.db import models
from django.contrib.auth.hashers import make_password, check_password


class Usuario(models.Model):
    """Usuario del sistema.

Campos principales:
- `nom_usuario`: username único.
- `email`: correo.
- `password`: hash de contraseña.
- `tipo_usuario`/`estado`: metadatos para lógica de negocio.

Notas:
- `set_password()` y `check_password()` encapsulan el hashing.
- `is_authenticated` se define para compatibilidad con DRF.
"""
    nom_usuario = models.CharField(max_length=50, unique=True)
    email = models.EmailField(max_length=255)
    password = models.CharField(max_length=255)
    tipo_usuario = models.CharField(max_length=50, blank=True, null=True)
    estado = models.CharField(max_length=20, blank=True, null=True)

    # ── SaaS: tenant al que pertenece este usuario ──────────────────────────
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        default=1,
        db_column='empresa_id',
        related_name='usuarios',
    )

    # ── SaaS: fuerza cambio de contraseña en el primer ingreso ───────────────
    # Se activa en True cuando el webhook de Stripe crea el usuario automáticamente.
    # El frontend redirige a /cambio-password si este campo es True.
    must_change_password = models.BooleanField(default=False)

    # Método para encriptar y guardar la contraseña
    def set_password(self, raw_password):
        """Hashea y persiste la contraseña.

        Entrada: `raw_password` (texto plano).
        Efecto: actualiza `self.password` con el hash y guarda en BD.
        """
        self.password = make_password(raw_password)
        self.save()

    # Método para verificar la contraseña

    def check_password(self, raw_password):
        """Valida contraseña contra el hash almacenado.

        Devuelve: `True` si coincide, `False` si no.
        """
        return check_password(raw_password, self.password)

    class Meta:
        db_table = 'usuarios'

    def __str__(self):
        return self.nom_usuario

    @property
    def is_authenticated(self):
        """
        Compatibilidad con Django REST Framework:
        Permite que DRF reconozca instancias de Usuario como autenticadas.
        """
        return True


class Rol(models.Model):
    """Rol del sistema.

    Basado en tu definición SQL:
      CREATE TABLE rol (
          id_rol SERIAL PRIMARY KEY,
          nombre VARCHAR(50) NOT NULL UNIQUE,
          descripcion TEXT
      );

    Importante:
      - Usamos `id_rol` como PK (nombre de columna como en tu SQL).
      - Más adelante puedes relacionar roles con usuarios y permisos.
    """

    id_rol = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'rol'

    def __str__(self):
        return self.nombre
