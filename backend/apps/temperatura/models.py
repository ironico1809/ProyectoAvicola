from django.db import models


class TemperaturaGalpon(models.Model):
    """
    Modelo para guardar las temperaturas registradas por galpón.

    Este modelo representa el sensor virtual del sistema.
    Como no tenemos un sensor físico, el backend simulará temperaturas
    y las guardará en esta tabla.
    """

    id = models.BigAutoField(primary_key=True)

    # Relación con el galpón.
    # Cada temperatura pertenece a un galpón específico.
    galpon = models.ForeignKey(
        'galpones.Galpon',
        on_delete=models.CASCADE,
        related_name='temperaturas',
        db_column='galpon_id'
    )

    # Temperatura registrada en grados Celsius.
    temperatura = models.DecimalField(
        max_digits=5,
        decimal_places=2
    )

    # Estado calculado automáticamente:
    # FRIO, NORMAL o CALOR.
    estado = models.CharField(
        max_length=20
    )

    # Fuente del dato.
    # SIMULADO = generado por el sistema.
    # MANUAL = ingresado por un usuario.
    fuente = models.CharField(
        max_length=20,
        default='SIMULADO'
    )

    # Usuario que registró la temperatura manualmente.
    # Null para registros simulados.
    usuario = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='temperaturas_registradas',
        db_column='usuario_id'
    )

    # Fecha y hora exacta del registro.
    fecha_hora = models.DateTimeField(
        auto_now_add=True
    )

    # ── SaaS: tenant ──────────────────────────────────────────────────────────
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        default=1,
        db_column='empresa_id',
        related_name='temperaturas',
    )

    class Meta:
        db_table = 'temperatura_galpon'
        ordering = ['-fecha_hora', '-id']

    def __str__(self) -> str:
        # self.galpon (objeto instancia) en lugar de self.galpon_id (entero raw)
        # para que Pyright infiera correctamente el tipo Galpon con django-stubs.
        # str() garantiza que el retorno sea siempre str aunque nombre sea None.
        galpon_nombre: str = str(self.galpon.nombre) if self.galpon else 'Sin galpón' # type: ignore
        return f"{galpon_nombre} - {self.temperatura}°C - {self.estado}" 