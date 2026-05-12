from django.db import models
from django.db.models.functions import Now


class Proveedor(models.Model):
    nombre = models.CharField(max_length=200)
    contacto = models.CharField(max_length=100, blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'proveedores'
        verbose_name_plural = 'proveedores'

    def __str__(self):
        return self.nombre


class Insumo(models.Model):
    TIPO_CHOICES = [
        ('Alimento', 'Alimento'),
        ('Medicamento', 'Medicamento'),
        ('Vacuna', 'Vacuna'),
        ('Suministro', 'Suministro'),
    ]

    id_insumo = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=200)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    unidad_medida = models.CharField(max_length=20)
    stock_actual = models.DecimalField(
        max_digits=10, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(
        max_digits=10, decimal_places=2, default=0)

    class Meta:
        db_table = 'insumos'

    def __str__(self):
        return f"{self.nombre} ({self.tipo})"

    @property
    def bajo_stock(self):
        return float(self.stock_actual) <= float(self.stock_minimo)


class MovimientoAlmacen(models.Model):
    TIPO_MOV_CHOICES = [
        ('Entrada', 'Entrada'),
        ('Salida', 'Salida'),
    ]

    insumo = models.ForeignKey(
        Insumo,
        on_delete=models.CASCADE,
        related_name='movimientos')
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos')
    tipo_movimiento = models.CharField(max_length=10, choices=TIPO_MOV_CHOICES)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    motivo = models.CharField(max_length=200)
    fecha_hora = models.DateTimeField(auto_now_add=True, db_default=Now())
    observacion = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'movimientos_almacen'
        ordering = ['-fecha_hora']

    def __str__(self):
        return f"{self.tipo_movimiento}: {self.cantidad} {self.insumo.nombre}"


class ControlSanitario(models.Model):
    """RF-10: Registro de tratamientos sanitarios aplicados a lotes."""
    TIPO_CHOICES = [
        ('Vacuna', 'Vacuna'),
        ('Medicamento', 'Medicamento'),
        ('Vitamina', 'Vitamina'),
        ('Antibiotico', 'Antibiótico'),
        ('Otro', 'Otro'),
    ]

    lote = models.ForeignKey(
        'lotes.Lote',
        on_delete=models.PROTECT,
        db_column='id_lote',
        related_name='controles_sanitarios'
    )
    insumo = models.ForeignKey(
        Insumo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='controles_sanitarios'
    )
    tipo_tratamiento = models.CharField(
        max_length=20, choices=TIPO_CHOICES, default='Vacuna')
    dosis = models.DecimalField(max_digits=10, decimal_places=2)
    unidad_dosis = models.CharField(max_length=20, default='ml')
    fecha_aplicacion = models.DateField()
    responsable = models.CharField(max_length=200, blank=True, null=True)
    observacion = models.TextField(blank=True, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, db_default=Now())

    class Meta:
        db_table = 'control_sanitario'
        ordering = ['-fecha_aplicacion']

    def __str__(self):
        return f"Tratamiento Lote {self.lote_id} - {self.insumo}"
