from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('galpones', '0005_merge_20260514_0445'),
        ('empresas', '0001_initial'),
        ('temperatura', '0003_temperaturagalpon_empresa'),
    ]

    operations = [
        migrations.CreateModel(
            name='PrediccionTemperatura',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('fecha_hora', models.DateTimeField(auto_now_add=True)),
                ('horizonte_horas', models.PositiveSmallIntegerField(default=3)),
                ('ventana_horas', models.PositiveSmallIntegerField(default=24)),
                ('temperatura_predicha', models.DecimalField(decimal_places=2, max_digits=5)),
                ('estado_predicho', models.CharField(max_length=20)),
                ('confianza', models.FloatField(default=0.0)),
                ('puntos', models.JSONField(blank=True, default=list)),
                ('umbral_superado', models.BooleanField(default=False)),
                ('mensaje', models.TextField(blank=True, null=True)),
                (
                    'empresa',
                    models.ForeignKey(
                        blank=True,
                        db_column='empresa_id',
                        default=1,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='predicciones_temperatura',
                        to='empresas.empresa',
                    ),
                ),
                (
                    'galpon',
                    models.ForeignKey(
                        db_column='galpon_id',
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='predicciones_temperatura',
                        to='galpones.galpon',
                    ),
                ),
            ],
            options={
                'db_table': 'prediccion_temperatura',
                'ordering': ['-fecha_hora', '-id'],
            },
        ),
    ]
