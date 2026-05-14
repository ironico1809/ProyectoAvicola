"""Modelos de la app `galpones`.

Un galpón representa una unidad física donde se alojan lotes.
Se relaciona con lotes vía `related_name='lotes'` (definido en el modelo de lotes).
"""

from django.db import models


class Galpon(models.Model):
    """Entidad Galpón.

    Campos:
    - `nombre`: identificador humano del galpón (único).
    - `capacidad`: capacidad máxima (p.ej. número de aves).
    - `descripcion`: texto opcional.
    - `estado`: estado lógico (default 'activo').
    - `latitud`: coordenada geográfica latitud (opcional).
    - `longitud`: coordenada geográfica longitud (opcional).
    - `ubicacion_nombre`: nombre del lugar obtenido por reverse geocoding.

    Devuelve (ORM): instancias de `Galpon`.
    """
    id = models.BigAutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)
    capacidad = models.IntegerField()
    descripcion = models.TextField(blank=True, null=True)
    estado = models.CharField(max_length=20, default='activo')
    latitud = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitud = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    ubicacion_nombre = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'galpones'

    def __str__(self):
        return self.nombre
