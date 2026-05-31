from django.db import transaction
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.mixins import TenantSafeView
from apps.bitacora.utils import registrar_evento
from apps.insumos.models import MovimientoAlmacen, Insumo, ControlSanitario
from apps.sanitario.serializers import ControlSanitarioSerializer


class AplicacionesSanitariasView(TenantSafeView):
    """Registro y consulta de aplicaciones/tratamientos sanitarios."""

    permission_classes = [IsAuthenticated]
    queryset = ControlSanitario.objects.all()

    def get(self, request):
        qs = self.get_queryset().select_related('lote', 'insumo')

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

        user = getattr(request, 'user', None)
        empresa_id = getattr(user, 'empresa_id', None)

        with transaction.atomic():
            control = serializer.save(empresa_id=empresa_id)

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
                    observacion=control.observacion or '',
                    empresa_id=empresa_id
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


class HistorialClinicoLotesView(TenantSafeView):
    """Historial clínico por lote (cronológico)."""

    permission_classes = [IsAuthenticated]
    queryset = ControlSanitario.objects.all()

    def get(self, request):
        lote_id = request.query_params.get('lote')
        if not lote_id:
            return Response({'lote': 'Este parámetro es requerido.'},
                            status=status.HTTP_400_BAD_REQUEST)

        qs = self.get_queryset().select_related(
            'lote',
            'insumo').filter(
            lote_id=lote_id).order_by(
            'fecha_aplicacion',
            'id')
        return Response(ControlSanitarioSerializer(qs, many=True).data)


class AplicacionSanitariaDetailView(TenantSafeView):
    """Obtener, editar o eliminar una aplicación sanitaria específica."""

    permission_classes = [IsAuthenticated]
    queryset = ControlSanitario.objects.all()

    def get_object(self, pk):
        try:
            return self.get_queryset().get(pk=pk)
        except ControlSanitario.DoesNotExist:
            return None

    def delete(self, request, pk):
        control = self.get_object(pk)
        if not control:
            return Response(status=status.HTTP_404_NOT_FOUND)

        user = getattr(request, 'user', None)
        empresa_id = getattr(user, 'empresa_id', None)

        with transaction.atomic():
            # Restaurar stock si hay insumo y dosis
            if control.insumo and control.dosis:
                insumo = control.insumo
                insumo.stock_actual += control.dosis
                insumo.save()

                MovimientoAlmacen.objects.create(
                    insumo=insumo,
                    tipo_movimiento='Entrada',
                    cantidad=control.dosis,
                    motivo=f'Anulación Tratamiento - Lote {control.lote_id}',
                    observacion='Reversión por eliminación de registro sanitario',
                    empresa_id=empresa_id
                )

            registrar_evento(
                request,
                accion='eliminar',
                modulo='sanitario',
                entidad='ControlSanitario',
                entidad_id=control.id,
                entidad_nombre=f"Tratamiento Lote {control.lote_id}",
                usuario=request.user
            )
            control.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, pk):
        control = self.get_object(pk)
        if not control:
            return Response(status=status.HTTP_404_NOT_FOUND)

        dosis_anterior = control.dosis
        insumo_anterior_id = control.insumo_id

        serializer = ControlSanitarioSerializer(control, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Validaciones de edición
        lote = serializer.validated_data.get('lote', control.lote)
        if lote and lote.estado.lower() == 'finalizado' and 'lote' in request.data:
            return Response({'lote': ['No se pueden asignar tratamientos a un lote finalizado.']}, status=status.HTTP_400_BAD_REQUEST)

        insumo = serializer.validated_data.get('insumo', control.insumo)
        nueva_dosis = serializer.validated_data.get('dosis', control.dosis)
        
        # Validar stock si cambia el insumo o la dosis
        if insumo:
            if insumo.id_insumo == insumo_anterior_id:
                diferencia = nueva_dosis - dosis_anterior
                if diferencia > 0 and insumo.stock_actual < diferencia:
                    return Response({'dosis': [f'Stock insuficiente para el aumento. Disponible: {insumo.stock_actual} {insumo.unidad_medida}.']}, status=status.HTTP_400_BAD_REQUEST)
            else:
                if insumo.stock_actual < nueva_dosis:
                    return Response({'dosis': [f'Stock insuficiente del nuevo insumo. Disponible: {insumo.stock_actual} {insumo.unidad_medida}.']}, status=status.HTTP_400_BAD_REQUEST)

        user = getattr(request, 'user', None)
        empresa_id = getattr(user, 'empresa_id', None)

        with transaction.atomic():
            # Revertir stock del insumo anterior si hubo cambio
            if control.insumo:
                insumo_ant = control.insumo
                if insumo_ant.id_insumo != (insumo.id_insumo if insumo else None):
                    insumo_ant.stock_actual += dosis_anterior
                    insumo_ant.save()
                    MovimientoAlmacen.objects.create(
                        insumo=insumo_ant, tipo_movimiento='Entrada', cantidad=dosis_anterior,
                        motivo=f'Anulación Tratamiento (Cambio Insumo) - Lote {control.lote_id}',
                        empresa_id=empresa_id
                    )
                else:
                    diferencia = nueva_dosis - dosis_anterior
                    if diferencia != 0:
                        insumo_ant.stock_actual -= diferencia
                        insumo_ant.save()
                        tipo_mov = 'Salida' if diferencia > 0 else 'Entrada'
                        MovimientoAlmacen.objects.create(
                            insumo=insumo_ant, tipo_movimiento=tipo_mov, cantidad=abs(diferencia),
                            motivo=f'Ajuste Tratamiento - Lote {control.lote_id}',
                            empresa_id=empresa_id
                        )
            
            # Si el insumo es nuevo o se cambió
            if insumo and insumo.id_insumo != insumo_anterior_id:
                insumo.stock_actual -= nueva_dosis
                insumo.save()
                MovimientoAlmacen.objects.create(
                    insumo=insumo, tipo_movimiento='Salida', cantidad=nueva_dosis,
                    motivo=f'Tratamiento Sanitario (Nuevo Insumo) - Lote {control.lote_id}',
                    empresa_id=empresa_id
                )

            updated_control = serializer.save(empresa_id=empresa_id)

            registrar_evento(
                request, accion='editar', modulo='sanitario', entidad='ControlSanitario',
                entidad_id=updated_control.id, entidad_nombre=f"Tratamiento Lote {updated_control.lote_id}", usuario=request.user
            )

        return Response(ControlSanitarioSerializer(updated_control).data)

    def put(self, request, pk):
        return self.patch(request, pk)
