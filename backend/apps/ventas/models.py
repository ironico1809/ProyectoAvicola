from django.db import models
from django.utils import timezone


class Cliente(models.Model):
    id_cliente = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=255)
    telefono = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    # ── SaaS: tenant al que pertenece este cliente ────────────────────────────
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        default=1,
        db_column='empresa_id',
        related_name='clientes',
    )

    class Meta:
        db_table = 'cliente'

    def __str__(self):
        return self.nombre


class VentaLote(models.Model):
    id_venta = models.AutoField(primary_key=True)
    cliente = models.ForeignKey(
        'ventas.Cliente',
        on_delete=models.PROTECT,
        db_column='id_cliente',
        related_name='ventas',
    )
    lote = models.ForeignKey(
        'lotes.Lote',
        on_delete=models.PROTECT,
        db_column='id_lote',
        related_name='ventas',
    )
    fecha_venta = models.DateTimeField(default=timezone.now)
    cantidad = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    precio_total = models.DecimalField(max_digits=12, decimal_places=2)
    peso_total_vendido = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    tipo_venta = models.CharField(max_length=20, default='Por unidad')  # 'Por unidad' o 'Por peso'
    observacion = models.TextField(blank=True, null=True)

    # ── SaaS: tenant al que pertenece esta venta ──────────────────────────────
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        default=1,
        db_column='empresa_id',
        related_name='ventas_lotes',
    )

    class Meta:
        db_table = 'venta_lote'
        ordering = ['-fecha_venta', '-id_venta']

    def __str__(self):
        return f"Venta {self.id_venta} - Lote {self.lote_id}"
