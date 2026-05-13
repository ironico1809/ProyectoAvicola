from django.db import models
from django.utils import timezone


class Alimentacion(models.Model):
    id_alimentacion = models.AutoField(primary_key=True)
    lote = models.ForeignKey(
        'lotes.Lote',
        on_delete=models.PROTECT,
        db_column='id_lote',
        related_name='alimentaciones',
    )
    insumo = models.ForeignKey(
        'insumos.Insumo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alimentaciones'
    )
    fecha = models.DateField(default=timezone.localdate)
    cantidad_kg = models.DecimalField(max_digits=6, decimal_places=2)
    tipo_alimento = models.CharField(max_length=100, blank=True, null=True)
    observacion = models.TextField(blank=True, null=True)

    # ── SaaS: tenant ──────────────────────────────────────────────────────────
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        default=1,
        db_column='empresa_id',
        related_name='alimentaciones',
    )

    class Meta:
        db_table = 'alimentacion'
        ordering = ['-fecha', '-id_alimentacion']

    def __str__(self):
        return f"Alimentación {self.id_alimentacion} - Lote {self.lote_id}"
