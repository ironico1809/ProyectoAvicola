from django.db import models
from apps.lotes.models import Lote

class RegistroMortalidad(models.Model):
    # Respetando tu UML:
    id_muerte = models.AutoField(primary_key=True)
    lote = models.ForeignKey(
        Lote,
        on_delete=models.CASCADE,
        db_column='id_lote',
        related_name='registros_mortalidad'
    )
    cantidad = models.IntegerField()
    causa = models.CharField(max_length=255, blank=True, null=True)
    fecha_hora = models.DateTimeField(auto_now_add=True)

    # ── SaaS: tenant ──────────────────────────────────────────────────────────
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        default=1,
        db_column='empresa_id',
        related_name='registros_mortalidad',
    )

    class Meta:
        # El nombre exacto de la tabla en tu base de datos
        db_table = 'registro_mortalidad'

    def save(self, *args, **kwargs):
        # Detectamos si es la primera vez que se guarda este registro
        es_nuevo = self.pk is None 
        
        # Primero, guardamos el registro en la base de datos
        super().save(*args, **kwargs)
        
        # Luego, descontamos las bajas de la cantidad actual del lote
        if es_nuevo:
            self.lote.cantidad_actual -= self.cantidad
            self.lote.save()

    def __str__(self):
        return f"{self.cantidad} bajas en Lote {self.lote.id_lote}"


class PrediccionMortalidad(models.Model):
    id_prediccion = models.AutoField(primary_key=True)
    lote = models.ForeignKey(
        Lote,
        on_delete=models.CASCADE,
        db_column='id_lote',
        related_name='predicciones_mortalidad'
    )
    fecha_hora = models.DateTimeField(auto_now_add=True)
    riesgo_porcentaje = models.DecimalField(max_digits=5, decimal_places=2)  # p.ej. 85.50
    nivel_riesgo = models.CharField(max_length=20)  # 'Bajo', 'Medio', 'Alto'

    # Parámetros de entrada de la IA en ese momento
    temperatura_promedio = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    humedad_promedio = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    desviacion_alimento = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    edad_dias = models.IntegerField(null=True, blank=True)
    bajas_recientes = models.IntegerField(default=0)
    alerta_sanitaria = models.BooleanField(default=False)

    # Explicación estructurada y recomendaciones correctivas sugeridas
    factores_clave = models.JSONField(default=list, blank=True)
    recomendaciones = models.JSONField(default=list, blank=True)

    # ── SaaS: tenant ──────────────────────────────────────────────────────────
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        default=1,
        db_column='empresa_id',
        related_name='predicciones_mortalidad',
    )

    class Meta:
        db_table = 'prediccion_mortalidad'
        ordering = ['-fecha_hora', '-id_prediccion']

    def __str__(self):
        return f"Predicción Lote {self.lote_id} - {self.riesgo_porcentaje}% ({self.nivel_riesgo})"