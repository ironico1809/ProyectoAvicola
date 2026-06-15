from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.mixins import TenantSafeView
from apps.ventas.models import Cliente, VentaLote
from apps.ventas.serializers import ClienteSerializer, VentaLoteSerializer
from apps.bitacora.utils import registrar_evento


class ClienteListCreateView(TenantSafeView):
    permission_classes = [IsAuthenticated]
    queryset = Cliente.objects.all()

    def get(self, request):
        queryset = self.get_queryset().order_by('-id_cliente')
        serializer = ClienteSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ClienteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        empresa_id = self.get_tenant_id()
        cliente = serializer.save(empresa_id=empresa_id)

        registrar_evento(
            request,
            accion='crear',
            modulo='ventas',
            entidad='Cliente',
            entidad_id=cliente.id_cliente,
            entidad_nombre=cliente.nombre,
            usuario=request.user
        )

        return Response(ClienteSerializer(cliente).data, status=status.HTTP_201_CREATED)


class ClienteDetailView(TenantSafeView):
    permission_classes = [IsAuthenticated]
    queryset = Cliente.objects.all()

    def _get_cliente_or_404(self, id_cliente):
        try:
            return self.get_queryset().get(pk=id_cliente)
        except Cliente.DoesNotExist:
            return None

    def get(self, request, id_cliente):
        cliente = self._get_cliente_or_404(id_cliente)
        if not cliente:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ClienteSerializer(cliente).data, status=status.HTTP_200_OK)

    def put(self, request, id_cliente):
        cliente = self._get_cliente_or_404(id_cliente)
        if not cliente:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ClienteSerializer(cliente, data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        empresa_id = self.get_tenant_id()
        cliente = serializer.save(empresa_id=empresa_id)

        registrar_evento(
            request,
            accion='editar',
            modulo='ventas',
            entidad='Cliente',
            entidad_id=cliente.id_cliente,
            entidad_nombre=cliente.nombre,
            usuario=request.user
        )

        return Response(ClienteSerializer(cliente).data, status=status.HTTP_200_OK)

    def delete(self, request, id_cliente):
        cliente = self._get_cliente_or_404(id_cliente)
        if not cliente:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        registrar_evento(
            request,
            accion='eliminar',
            modulo='ventas',
            entidad='Cliente',
            entidad_id=cliente.id_cliente,
            entidad_nombre=cliente.nombre,
            usuario=request.user
        )
        cliente.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VentaLoteListCreateView(TenantSafeView):
    permission_classes = [IsAuthenticated]
    queryset = VentaLote.objects.all()

    def get(self, request):
        queryset = self.get_queryset().order_by('-fecha_venta', '-id_venta')
        serializer = VentaLoteSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = VentaLoteSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        empresa_id = self.get_tenant_id()
        try:
            with transaction.atomic():
                venta = serializer.save(empresa_id=empresa_id)

                # Actualizar el lote correspondiente
                lote = venta.lote
                lote.cantidad_actual -= venta.cantidad
                if lote.cantidad_actual <= 0:
                    lote.cantidad_actual = 0
                    lote.estado = 'Vendido'
                lote.save()

                registrar_evento(
                    request,
                    accion='crear',
                    modulo='ventas',
                    entidad='VentaLote',
                    entidad_id=venta.id_venta,
                    entidad_nombre=f"Venta de lote #{lote.id_lote}",
                    detalle={
                        'cantidad': venta.cantidad,
                        'precio_total': float(venta.precio_total),
                        'cliente_id': venta.cliente_id
                    },
                    usuario=request.user
                )

                return Response(VentaLoteSerializer(venta).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class VentaLoteDetailView(TenantSafeView):
    permission_classes = [IsAuthenticated]
    queryset = VentaLote.objects.all()

    def _get_venta_or_404(self, id_venta):
        try:
            return self.get_queryset().get(pk=id_venta)
        except VentaLote.DoesNotExist:
            return None

    def get(self, request, id_venta):
        venta = self._get_venta_or_404(id_venta)
        if not venta:
            return Response({'detail': 'Venta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(VentaLoteSerializer(venta).data, status=status.HTTP_200_OK)
