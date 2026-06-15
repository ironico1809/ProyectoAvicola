import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('insumos', '0004_controlsanitario_empresa_insumo_empresa_and_more'),
        ('usuarios', '0001_initial'),
    ]

    operations = [

        migrations.AddField(
            model_name='controlsanitario',
            name='tipo_registro',
            field=models.CharField(
                choices=[
                    ('enfermedad', 'Registro de Enfermedad'),
                    ('tratamiento', 'Aplicación de Tratamiento'),
                ],
                default='tratamiento',
                max_length=20,
            ),
        ),

        migrations.AddField(
            model_name='controlsanitario',
            name='enfermedad_sintoma',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),

        migrations.AddField(
            model_name='controlsanitario',
            name='cantidad_aves_afectadas',
            field=models.IntegerField(blank=True, null=True),
        ),

        migrations.AddField(
            model_name='controlsanitario',
            name='porcentaje_afectacion',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=5, null=True),
        ),

        migrations.AddField(
            model_name='controlsanitario',
            name='estado_enfermedad',
            field=models.CharField(
                blank=True,
                choices=[
                    ('activo', 'Activo'),
                    ('en_tratamiento', 'En Tratamiento'),
                    ('resuelto', 'Resuelto'),
                ],
                default='activo',
                max_length=20,
            ),
        ),

        migrations.AddField(
            model_name='controlsanitario',
            name='usuario',
            field=models.ForeignKey(
                blank=True,
                db_column='usuario_id',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='controles_sanitarios',
                to='usuarios.usuario',
            ),
        ),
    ]