from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum, Count, F
from django.utils.dateparse import parse_date

from apps.core.mixins import TenantSafeView
from apps.insumos.models import Insumo, Proveedor, MovimientoAlmacen
from apps.insumos.serializers import (
    InsumoSerializer, ProveedorSerializer,
    MovimientoAlmacenSerializer
)
from apps.bitacora.utils import registrar_evento


class InsumoViewSet(TenantSafeView, viewsets.ModelViewSet):
    queryset = Insumo.objects.all()
    serializer_class = InsumoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        tipo = self.request.query_params.get('tipo')  # type: ignore
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        empresa_id = getattr(user, 'empresa_id', None)
        insumo = serializer.save(empresa_id=empresa_id)
        registrar_evento(
            self.request,
            accion='crear',
            modulo='inventario',
            entidad='Insumo',
            entidad_id=getattr(insumo, 'id_insumo', None),
            entidad_nombre=getattr(insumo, 'nombre', None),
            detalle=self.request.data,  # type: ignore
            usuario=self.request.user
        )

    def perform_update(self, serializer):
        empresa_id = getattr(serializer.instance, 'empresa_id', None)
        insumo = serializer.save(empresa_id=empresa_id)
        registrar_evento(
            self.request,
            accion='editar',
            modulo='inventario',
            entidad='Insumo',
            entidad_id=getattr(insumo, 'id_insumo', None),
            entidad_nombre=getattr(insumo, 'nombre', None),
            detalle=self.request.data,  # type: ignore
            usuario=self.request.user
        )

    def perform_destroy(self, instance):
        registrar_evento(
            self.request,
            accion='eliminar',
            modulo='inventario',
            entidad='Insumo',
            entidad_id=getattr(instance, 'id_insumo', None),
            entidad_nombre=getattr(instance, 'nombre', None),
            detalle={},
            usuario=self.request.user
        )
        instance.delete()


class ProveedorViewSet(TenantSafeView, viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset()

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        empresa_id = getattr(user, 'empresa_id', None)
        proveedor = serializer.save(empresa_id=empresa_id)
        registrar_evento(
            self.request,
            accion='crear',
            modulo='inventario',
            entidad='Proveedor',
            entidad_id=getattr(proveedor, 'id', None),
            entidad_nombre=getattr(proveedor, 'nombre', None),
            detalle=self.request.data,  # type: ignore
            usuario=self.request.user
        )

    def perform_update(self, serializer):
        empresa_id = getattr(serializer.instance, 'empresa_id', None)
        proveedor = serializer.save(empresa_id=empresa_id)
        registrar_evento(
            self.request,
            accion='editar',
            modulo='inventario',
            entidad='Proveedor',
            entidad_id=getattr(proveedor, 'id', None),
            entidad_nombre=getattr(proveedor, 'nombre', None),
            detalle=self.request.data,  # type: ignore
            usuario=self.request.user
        )


class MovimientoAlmacenView(TenantSafeView):
    permission_classes = [IsAuthenticated]
    queryset = MovimientoAlmacen.objects.all()

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        empresa_id = getattr(user, 'empresa_id', None)
        return serializer.save(empresa_id=empresa_id)

    def get(self, request):
        base_qs = MovimientoAlmacen.objects.select_related('insumo', 'proveedor').all()
        # Mantenemos el select_related filtrando explícitamente por tenant
        qs = self.filter_by_tenant(base_qs)

        insumo_id = request.query_params.get('insumo')  # type: ignore
        tipo = request.query_params.get('tipo_movimiento')  # type: ignore
        fecha_inicio = request.query_params.get('fecha_inicio')  # type: ignore
        fecha_fin = request.query_params.get('fecha_fin')  # type: ignore
        motivo = request.query_params.get('motivo')  # type: ignore

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
            mov = self.perform_create(serializer)
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
                entidad_id=getattr(mov, 'id', None),
                entidad_nombre=f"{getattr(mov, 'tipo_movimiento', '')} de {getattr(getattr(mov, 'insumo', None), 'nombre', '')}",
                detalle=request.data,
                usuario=request.user
            )

        return Response(MovimientoAlmacenSerializer(
            mov).data, status=status.HTTP_201_CREATED)


class AlertasStockView(TenantSafeView):
    """RF-20: Alertas de bajo stock filtradas por tenant."""
    permission_classes = [IsAuthenticated]
    queryset = Insumo.objects.all()

    def get(self, request):
        base_qs = self.get_queryset()
        insumos_criticos = base_qs.filter(stock_actual__lte=F('stock_minimo'))
        return Response(InsumoSerializer(insumos_criticos, many=True).data)


class StatsInventarioView(TenantSafeView):
    """Estadísticas generales del inventario segmentadas por tenant."""
    permission_classes = [IsAuthenticated]
    queryset = Insumo.objects.all()

    def get(self, request):
        base_insumo = self.get_queryset()
        base_prov = self.filter_by_tenant(Proveedor.objects.all())
        base_mov = self.filter_by_tenant(MovimientoAlmacen.objects.all())

        total_insumos = base_insumo.count()
        bajo_stock = base_insumo.filter(stock_actual__lte=F('stock_minimo')).count()
        total_proveedores = base_prov.count()
        total_movimientos = base_mov.count()

        por_tipo = base_insumo.values('tipo').annotate(
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
