from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum, Count
from django.utils.dateparse import parse_date

from apps.insumos.models import Insumo, Proveedor, MovimientoAlmacen
from apps.insumos.serializers import (
    InsumoSerializer, ProveedorSerializer,
    MovimientoAlmacenSerializer
)
from apps.bitacora.utils import registrar_evento


class InsumoViewSet(viewsets.ModelViewSet):
    queryset = Insumo.objects.all()
    serializer_class = InsumoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Insumo.objects.all()
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    def perform_create(self, serializer):
        insumo = serializer.save()
        registrar_evento(
            self.request,
            accion='crear',
            modulo='inventario',
            entidad='Insumo',
            entidad_id=insumo.id_insumo,
            entidad_nombre=insumo.nombre,
            detalle=self.request.data,
            usuario=self.request.user
        )

    def perform_update(self, serializer):
        insumo = serializer.save()
        registrar_evento(
            self.request,
            accion='editar',
            modulo='inventario',
            entidad='Insumo',
            entidad_id=insumo.id_insumo,
            entidad_nombre=insumo.nombre,
            detalle=self.request.data,
            usuario=self.request.user
        )

    def perform_destroy(self, instance):
        registrar_evento(
            self.request,
            accion='eliminar',
            modulo='inventario',
            entidad='Insumo',
            entidad_id=instance.id_insumo,
            entidad_nombre=instance.nombre,
            detalle={},
            usuario=self.request.user
        )
        instance.delete()


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        proveedor = serializer.save()
        registrar_evento(
            self.request,
            accion='crear',
            modulo='inventario',
            entidad='Proveedor',
            entidad_id=proveedor.id,
            entidad_nombre=proveedor.nombre,
            detalle=self.request.data,
            usuario=self.request.user
        )

    def perform_update(self, serializer):
        proveedor = serializer.save()
        registrar_evento(
            self.request,
            accion='editar',
            modulo='inventario',
            entidad='Proveedor',
            entidad_id=proveedor.id,
            entidad_nombre=proveedor.nombre,
            detalle=self.request.data,
            usuario=self.request.user
        )


class MovimientoAlmacenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = MovimientoAlmacen.objects.select_related(
            'insumo', 'proveedor').all()

        # Filtros opcionales
        insumo_id = request.query_params.get('insumo')
        tipo = request.query_params.get('tipo_movimiento')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')
        motivo = request.query_params.get('motivo')

        if insumo_id:
            qs = qs.filter(insumo_id=insumo_id)
        if tipo:
            qs = qs.filter(tipo_movimiento=tipo)
        if motivo:
            qs = qs.filter(motivo__icontains=motivo)
        if fecha_inicio:
            d = parse_date(fecha_inicio)
            if d:
                qs = qs.filter(fecha_hora__date__gte=d)
        if fecha_fin:
            d = parse_date(fecha_fin)
            if d:
                qs = qs.filter(fecha_hora__date__lte=d)

        return Response(MovimientoAlmacenSerializer(qs, many=True).data)

    def post(self, request):
        serializer = MovimientoAlmacenSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            mov = serializer.save()
            # Actualizar stock
            insumo = mov.insumo
            if mov.tipo_movimiento == 'Entrada':
                insumo.stock_actual += mov.cantidad
            else:
                insumo.stock_actual -= mov.cantidad
            insumo.save()

            registrar_evento(
                request,
                accion='crear',
                modulo='inventario',
                entidad='MovimientoAlmacen',
                entidad_id=mov.id,
                entidad_nombre=f"{mov.tipo_movimiento} de {mov.insumo.nombre}",
                detalle=request.data,
                usuario=request.user
            )

        return Response(MovimientoAlmacenSerializer(
            mov).data, status=status.HTTP_201_CREATED)


class AlertasStockView(APIView):
    """RF-20: Alertas de bajo stock."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import F
        insumos_criticos = Insumo.objects.filter(
            stock_actual__lte=F('stock_minimo'))
        return Response(InsumoSerializer(insumos_criticos, many=True).data)


class StatsInventarioView(APIView):
    """Estadísticas generales del inventario."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import F
        total_insumos = Insumo.objects.count()
        bajo_stock = Insumo.objects.filter(
            stock_actual__lte=F('stock_minimo')).count()
        total_proveedores = Proveedor.objects.count()
        total_movimientos = MovimientoAlmacen.objects.count()

        # Conteo por tipo de insumo
        por_tipo = Insumo.objects.values('tipo').annotate(
            count=Count('id_insumo'),
            stock_total=Sum('stock_actual')
        )

        return Response({
            'total_insumos': total_insumos,
            'bajo_stock': bajo_stock,
            'total_proveedores': total_proveedores,
            'total_movimientos': total_movimientos,
            'por_tipo': list(por_tipo),
        })
