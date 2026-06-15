import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.empresas.models import Empresa
from apps.usuarios.models import Usuario
from apps.galpones.models import Galpon
from apps.lotes.models import Lote
from apps.ventas.models import Cliente, VentaLote

print("=== EMPRESAS ===")
for e in Empresa.objects.all()[:5]:
    print(f"ID: {e.id}, Nombre: {e.nombre}")

print("\n=== USUARIOS ===")
for u in Usuario.objects.all()[:5]:
    print(f"ID: {u.id}, Email: {u.email}, Empresa: {u.empresa_id}")

print("\n=== GALPONES ===")
for g in Galpon.objects.all()[:5]:
    print(f"ID: {g.id}, Nombre: {g.nombre}, Capacidad: {g.capacidad}, Empresa: {g.empresa_id}")

print("\n=== LOTES ===")
for l in Lote.objects.all()[:5]:
    print(f"ID: {l.id_lote}, Galpon: {l.galpon_id}, Estado: {l.estado}, Cant. Actual: {l.cantidad_actual}, Empresa: {l.empresa_id}")

print("\n=== CLIENTES ===")
for c in Cliente.objects.all()[:5]:
    print(f"ID: {c.id_cliente}, Nombre: {c.nombre}, Empresa: {c.empresa_id}")

print("\n=== VENTAS ===")
for v in VentaLote.objects.all()[:5]:
    print(f"ID: {v.id_venta}, Cliente: {v.cliente_id}, Lote: {v.lote_id}, Cantidad: {v.cantidad}, Total: {v.precio_total}, Empresa: {v.empresa_id}")
