import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.ventas.models import Cliente, VentaLote
from apps.lotes.models import Lote
from apps.empresas.models import Empresa

def run():
    # Aseguramos que la base está limpia para no duplicar si el script se corre 2 veces
    Cliente.objects.all().delete()
    VentaLote.objects.all().delete()

    empresa = Empresa.objects.get(id=1)

    c1 = Cliente.objects.create(nombre="Supermercados La Económica", telefono="78901234", email="compras@laeconomica.com", empresa=empresa)
    c2 = Cliente.objects.create(nombre="Restaurante El Pollon", telefono="71234567", email="contacto@elpollon.com", empresa=empresa)
    c3 = Cliente.objects.create(nombre="Distribuidora San Juan", telefono="70001111", email="dist.sanjuan@gmail.com", empresa=empresa)

    print("Clientes creados.")

    lote3 = Lote.objects.filter(id_lote=3).first()
    lote5 = Lote.objects.filter(id_lote=5).first()
    lote7 = Lote.objects.filter(id_lote=7).first()

    def crear_venta(cliente, lote, cantidad, precio_unitario, tipo_venta='Por unidad', peso_total=None):
        if not lote or lote.cantidad_actual < cantidad:
            print(f"Lote {lote.id_lote if lote else 'None'} insuficiente para vender {cantidad}.")
            return
            
        if tipo_venta == 'Por peso':
            precio_total = Decimal(str(peso_total)) * Decimal(str(precio_unitario))
        else:
            precio_total = Decimal(str(cantidad)) * Decimal(str(precio_unitario))

        VentaLote.objects.create(
            cliente=cliente,
            lote=lote,
            cantidad=cantidad,
            precio_unitario=precio_unitario,
            precio_total=precio_total,
            peso_total_vendido=peso_total,
            tipo_venta=tipo_venta,
            empresa=empresa
        )
        
        lote.cantidad_actual -= cantidad
        if lote.cantidad_actual <= 0:
            lote.cantidad_actual = 0
            lote.estado = 'Vendido'
        lote.save()
        print(f"Venta registrada: Cliente {cliente.nombre} | Lote {lote.id_lote} | Aves: {cantidad} | Total: Bs. {precio_total}")

    if lote3:
        crear_venta(c1, lote3, 20, 25.50, 'Por unidad')
    if lote5:
        crear_venta(c2, lote5, 100, 26.00, 'Por unidad')
        crear_venta(c3, lote5, 50, 15.00, 'Por peso', 120.5)
    if lote7:
        crear_venta(c1, lote7, 200, 24.50, 'Por unidad')

if __name__ == '__main__':
    run()
