from django.db import models


class AlertaSanitaria(models.Model):
    """CU17: Alertas generadas por riesgo sanitario en un lote o insumo crítico."""

    TIPO_ALERTA_CHOICES = [
        ('Afectacion', 'Afectación por enfermedad'),
        ('Mortandad', 'Incremento de mortandad'),
        ('StockMedicamento', 'Bajo stock de medicamento crítico'),
    ]

    NIVEL_CHOICES = [
        ('Medio', 'Medio'),
        ('Alto', 'Alto'),
        ('Critico', 'Crítico'),
    ]

    ESTADO_CHOICES = [
        ('Pendiente', 'Pendiente'),
        ('Atendida', 'Atendida'),
        ('Resuelta', 'Resuelta'),
    ]

    lote = models.ForeignKey(
        'lotes.Lote',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='id_lote',
        related_name='alertas_sanitarias',
    )

    registro_enfermedad = models.ForeignKey(
        'insumos.ControlSanitario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alertas_sanitarias',
    )

    insumo = models.ForeignKey(
        'insumos.Insumo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alertas_sanitarias',
    )

    tipo_alerta = models.CharField(
        max_length=30,
        choices=TIPO_ALERTA_CHOICES
    )

    nivel = models.CharField(
        max_length=20,
        choices=NIVEL_CHOICES,
        default='Alto'
    )

    causa = models.CharField(max_length=255)
    mensaje = models.TextField()

    porcentaje_detectado = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True
    )

    cantidad_detectada = models.IntegerField(
        null=True,
        blank=True
    )

    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default='Pendiente'
    )

    fecha_hora = models.DateTimeField(auto_now_add=True)

    usuario = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='usuario_id',
        related_name='alertas_sanitarias',
    )

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        default=1,
        db_column='empresa_id',
        related_name='alertas_sanitarias',
    )

    class Meta:
        db_table = 'alerta_sanitaria'
        ordering = ['-fecha_hora']

    def __str__(self):
        referencia = f'Lote {self.lote_id}' if self.lote_id else f'Insumo {self.insumo_id}'
        return f'{self.tipo_alerta} - {referencia} - {self.estado}'
