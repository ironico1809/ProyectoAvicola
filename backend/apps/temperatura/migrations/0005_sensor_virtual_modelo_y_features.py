from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('galpones', '0005_merge_20260514_0445'),
        ('empresas', '0001_initial'),
        ('temperatura', '0004_prediccion_temperatura'),
    ]

    operations = [
        migrations.AddField(
            model_name='temperaturagalpon',
            name='temperatura_externa',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Temperatura externa (p.ej. OpenWeather) usada como feature.',
                max_digits=5,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='temperaturagalpon',
            name='humedad_externa',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Humedad externa (p.ej. OpenWeather) usada como feature.',
                max_digits=5,
                null=True,
            ),
        ),
        migrations.CreateModel(
            name='ModeloSensorVirtualTemperatura',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('fecha_hora', models.DateTimeField(auto_now_add=True)),
                ('feature_names', models.JSONField(default=list)),
                ('coeficientes', models.JSONField(default=list)),
                ('r2', models.FloatField(default=0.0)),
                ('n_muestras', models.PositiveIntegerField(default=0)),
                ('ventana_horas', models.PositiveIntegerField(default=2160)),
                (
                    'empresa',
                    models.ForeignKey(
                        blank=True,
                        db_column='empresa_id',
                        default=1,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='modelos_sensor_virtual',
                        to='empresas.empresa',
                    ),
                ),
                (
                    'galpon',
                    models.ForeignKey(
                        blank=True,
                        db_column='galpon_id',
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='modelos_sensor_virtual',
                        to='galpones.galpon',
                    ),
                ),
            ],
            options={
                'db_table': 'modelo_sensor_virtual_temperatura',
                'ordering': ['-fecha_hora', '-id'],
            },
        ),
    ]
