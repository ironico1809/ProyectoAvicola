from django.db import models
from django.utils import timezone


class Lote(models.Model):
    id_lote = models.AutoField(primary_key=True)
    galpon = models.ForeignKey(
        'galpones.Galpon',
        on_delete=models.PROTECT,
        db_column='id_galpon',
        related_name='lotes',
    )
    raza_tipo = models.CharField(max_length=50, blank=True, null=True)
    fecha_ingreso = models.DateField(default=timezone.localdate)
    fecha_salida_estimada = models.DateField(blank=True, null=True)
    cantidad_inicial = models.IntegerField()
    cantidad_actual = models.IntegerField()
    peso_inicial = models.DecimalField(
        max_digits=10, decimal_places=2, blank=True, null=True)
    estado = models.CharField(max_length=20, default='Crianza')

    # ── SaaS: tenant ──────────────────────────────────────────────────────────
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        default=1,
        db_column='empresa_id',
        related_name='lotes',
    )

    class Meta:
        db_table = 'lote'

    def __str__(self):
        return f"Lote {self.id_lote} - {self.galpon_id}"


class ControlCalidad(models.Model):
    id = models.BigAutoField(primary_key=True)
    id_lote = models.ForeignKey(
        'lotes.Lote',
        on_delete=models.CASCADE,
        db_column='id_lote',
        related_name='controles_calidad',
    )
    usuario_id = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='controles_calidad',
    )
    empresa_id = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        db_column='empresa_id',
        related_name='controles_calidad',
    )
    peso_registrado = models.DecimalField(max_digits=10, decimal_places=4)
    edad_dias = models.IntegerField()
    peso_estandar = models.DecimalField(max_digits=10, decimal_places=4)
    porcentaje_diferencia = models.DecimalField(max_digits=10, decimal_places=4)
    estado_desarrollo = models.CharField(max_length=50)
    observacion = models.TextField(blank=True, null=True)
    fecha_registro = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'control_calidad'

    def __str__(self):
        return f"Control Lote {self.id_lote_id} - {self.fecha_registro}"


class CurvaCrecimientoEstandar(models.Model):
    id = models.BigAutoField(primary_key=True)
    raza = models.CharField(max_length=100)
    edad_dias = models.IntegerField()
    peso_estandar = models.DecimalField(max_digits=10, decimal_places=4)
    unidad_medida = models.CharField(max_length=20)

    class Meta:
        db_table = 'curva_crecimiento_estandar'

    def __str__(self):
        return f"Curva {self.raza} - Día {self.edad_dias}"

