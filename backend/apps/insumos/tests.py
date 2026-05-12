from django.test import TestCase
from apps.insumos.models import Insumo, MovimientoAlmacen, Proveedor
from django.db import connection


class MovimientoAlmacenTest(TestCase):
    def setUp(self):
        self.insumo = Insumo.objects.create(
            nombre="Alimento Inicial",
            tipo="Alimento",
            unidad_medida="kg",
            stock_actual=100
        )
        self.proveedor = Proveedor.objects.create(nombre="Proveedor A")

    def test_create_movimiento_with_auto_now_and_db_default(self):
        # Test creation via ORM
        mov = MovimientoAlmacen.objects.create(
            insumo=self.insumo,
            tipo_movimiento='Entrada',
            cantidad=50,
            motivo='Prueba ORM',
            observacion='Una observación de prueba'
        )
        self.assertIsNotNone(mov.fecha_hora)
        self.assertEqual(mov.observacion, 'Una observación de prueba')

    def test_raw_sql_insert_omitting_fecha_hora(self):
        # Test if DB default works when omitting the column in raw SQL
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO movimientos_almacen (insumo_id, proveedor_id, tipo_movimiento, cantidad, motivo, observacion) "
                "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                [self.insumo.id_insumo, self.proveedor.id,
                    'Entrada', 100, 'Prueba SQL', 'SQL obs']
            )
            row = cursor.fetchone()
            mov_id = row[0]

        mov = MovimientoAlmacen.objects.get(id=mov_id)
        self.assertIsNotNone(mov.fecha_hora)
        self.assertEqual(mov.motivo, 'Prueba SQL')
