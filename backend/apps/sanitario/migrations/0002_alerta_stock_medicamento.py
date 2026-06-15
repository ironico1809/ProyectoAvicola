# Generated manually for CU17 web completion

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sanitario', '0001_initial'),
        ('insumos', '0006_alter_controlsanitario_dosis_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='alertasanitaria',
            name='insumo',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='alertas_sanitarias',
                to='insumos.insumo'
            ),
        ),
        migrations.AlterField(
            model_name='alertasanitaria',
            name='lote',
            field=models.ForeignKey(
                blank=True,
                db_column='id_lote',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='alertas_sanitarias',
                to='lotes.lote'
            ),
        ),
        migrations.AlterField(
            model_name='alertasanitaria',
            name='tipo_alerta',
            field=models.CharField(
                choices=[
                    ('Afectacion', 'Afectación por enfermedad'),
                    ('Mortandad', 'Incremento de mortandad'),
                    ('StockMedicamento', 'Bajo stock de medicamento crítico')
                ],
                max_length=30
            ),
        ),
    ]
