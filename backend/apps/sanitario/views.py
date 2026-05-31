from django.db import transaction
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.bitacora.utils import registrar_evento
from apps.insumos.models import MovimientoAlmacen, Insumo, ControlSanitario
from apps.sanitario.serializers import ControlSanitarioSerializer


class AplicacionesSanitariasView(APIView):
    """Registro y consulta de aplicaciones/tratamientos sanitarios."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ControlSanitario.objects.select_related('lote', 'insumo').all()

        lote_id = request.query_params.get('lote')
        insumo_id = request.query_params.get('insumo')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')

        if lote_id:
            qs = qs.filter(lote_id=lote_id)
        if insumo_id:
            qs = qs.filter(insumo_id=insumo_id)
        if fecha_inicio:
            d = parse_date(fecha_inicio)
            if d:
                qs = qs.filter(fecha_aplicacion__gte=d)
        if fecha_fin:
            d = parse_date(fecha_fin)
            if d:
                qs = qs.filter(fecha_aplicacion__lte=d)

        return Response(ControlSanitarioSerializer(qs, many=True).data)

    def post(self, request):
        serializer = ControlSanitarioSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

        # 1. Validar estado del Lote
        lote = serializer.validated_data.get('lote')
        if lote and lote.estado.lower() == 'finalizado':
            return Response(
                {'lote': ['No se pueden registrar tratamientos en un lote finalizado.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Validar stock del Insumo
        insumo = serializer.validated_data.get('insumo')
        dosis = serializer.validated_data.get('dosis')
        
        if insumo and dosis is not None:
            if insumo.stock_actual < dosis:
                return Response(
                    {'dosis': [f'Stock insuficiente del insumo. Disponible: {insumo.stock_actual} {insumo.unidad_medida}.']},
                    status=status.HTTP_400_BAD_REQUEST
                )

        with transaction.atomic():
            control = serializer.save()

            # Actualización automática de stock si hay insumo asociado
            if control.insumo:
                insumo: Insumo = control.insumo
                insumo.stock_actual -= control.dosis
                insumo.save()

                MovimientoAlmacen.objects.create(
                    insumo=insumo,
                    tipo_movimiento='Salida',
                    cantidad=control.dosis,
                    motivo=f'Tratamiento Sanitario - Lote {control.lote_id}',
                    observacion=control.observacion or ''
                )

            registrar_evento(
                request,
                accion='crear',
                modulo='sanitario',
                entidad='ControlSanitario',
                entidad_id=control.id,
                entidad_nombre=f"Tratamiento Lote {control.lote_id}",
                detalle=request.data,
                usuario=request.user
            )

        return Response(ControlSanitarioSerializer(
            control).data, status=status.HTTP_201_CREATED)


class HistorialClinicoLotesView(APIView):
    """Historial clínico por lote (cronológico)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        lote_id = request.query_params.get('lote')
        if not lote_id:
            return Response({'lote': 'Este parámetro es requerido.'},
                            status=status.HTTP_400_BAD_REQUEST)

        qs = ControlSanitario.objects.select_related(
            'lote',
            'insumo').filter(
            lote_id=lote_id).order_by(
            'fecha_aplicacion',
            'id')
        return Response(ControlSanitarioSerializer(qs, many=True).data)
