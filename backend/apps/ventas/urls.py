from django.urls import path
from apps.ventas.views import (
    ClienteListCreateView,
    ClienteDetailView,
    VentaLoteListCreateView,
    VentaLoteDetailView,
)

urlpatterns = [
    # Ventas de lotes
    path('', VentaLoteListCreateView.as_view(), name='ventas_list_create'),
    path('<int:id_venta>/', VentaLoteDetailView.as_view(), name='ventas_detail'),

    # Clientes
    path('clientes/', ClienteListCreateView.as_view(), name='clientes_list_create'),
    path('clientes/<int:id_cliente>/', ClienteDetailView.as_view(), name='clientes_detail'),
]
