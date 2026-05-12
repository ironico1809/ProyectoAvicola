import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('insumos', '0001_initial'),
        ('lotes', '0001_initial'),
    ]

    operations = [
        # Actualizar choices del campo tipo en Insumo para incluir 'Suministro'
        migrations.AlterField(
            model_name='insumo',
            name='tipo',
            field=models.CharField(
                choices=[
                    ('Alimento', 'Alimento'),
                    ('Medicamento', 'Medicamento'),
                    ('Vacuna', 'Vacuna'),
                    ('Suministro', 'Suministro'),
                ],
                max_length=20
            ),
        ),
        # Crear tabla ControlSanitario (RF-10)
        migrations.CreateModel(
            name='ControlSanitario',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo_tratamiento', models.CharField(
                    choices=[
                        ('Vacuna', 'Vacuna'),
                        ('Medicamento', 'Medicamento'),
                        ('Vitamina', 'Vitamina'),
                        ('Antibiotico', 'Antibiótico'),
                        ('Otro', 'Otro'),
                    ],
                    default='Vacuna',
                    max_length=20
                )),
                ('dosis', models.DecimalField(decimal_places=2, max_digits=10)),
                ('unidad_dosis', models.CharField(default='ml', max_length=20)),
                ('fecha_aplicacion', models.DateField()),
                ('responsable', models.CharField(
                    blank=True, max_length=200, null=True)),
                ('observacion', models.TextField(blank=True, null=True)),
                ('fecha_registro', models.DateTimeField(auto_now_add=True)),
                ('lote', models.ForeignKey(
                    db_column='id_lote',
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='controles_sanitarios',
                    to='lotes.lote'
                )),
                ('insumo', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='controles_sanitarios',
                    to='insumos.insumo'
                )),
            ],
            options={
                'db_table': 'control_sanitario',
                'ordering': ['-fecha_aplicacion'],
            },
        ),
    ]
