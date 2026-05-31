from django.db import transaction
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.bitacora.utils import registrar_evento
from apps.core.mixins import TenantSafeView
from apps.insumos.models import MovimientoAlmacen, Insumo, ControlSanitario
from apps.sanitario.serializers import (
    ControlSanitarioSerializer,
    RegistroEnfermedadSerializer,
)


class AplicacionesSanitariasView(APIView):
    """Registro y consulta de aplicaciones/tratamientos sanitarios."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Solo tratamientos, nunca enfermedades
        qs = ControlSanitario.objects.select_related('lote', 'insumo').filter(
            tipo_registro='tratamiento'
        )

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

        with transaction.atomic():
            control = serializer.save(tipo_registro='tratamiento')

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

        return Response(
            ControlSanitarioSerializer(control).data,
            status=status.HTTP_201_CREATED,
        )


class HistorialClinicoLotesView(APIView):
    """Historial clínico por lote (cronológico)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        lote_id = request.query_params.get('lote')
        if not lote_id:
            return Response(
                {'lote': 'Este parámetro es requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = (
            ControlSanitario.objects
            .select_related('lote', 'insumo')
            .filter(lote_id=lote_id)
            .order_by('fecha_aplicacion', 'id')
        )
        return Response(ControlSanitarioSerializer(qs, many=True).data)


class RegistroEnfermedadesView(TenantSafeView):
    """CU15 / HU3-01-03: Registrar enfermedades por lote."""

    permission_classes = [IsAuthenticated]
    queryset = ControlSanitario.objects.filter(tipo_registro='enfermedad')

    def get(self, request):
        # Solo enfermedades
        qs = self.get_queryset().select_related('lote', 'usuario')

        lote_id = request.query_params.get('lote')
        estado = request.query_params.get('estado')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')

        if lote_id:
            qs = qs.filter(lote_id=lote_id)
        if estado:
            qs = qs.filter(estado_enfermedad=estado)
        if fecha_inicio:
            d = parse_date(fecha_inicio)
            if d:
                qs = qs.filter(fecha_registro__date__gte=d)
        if fecha_fin:
            d = parse_date(fecha_fin)
            if d:
                qs = qs.filter(fecha_registro__date__lte=d)

        return Response(RegistroEnfermedadSerializer(qs, many=True).data)

    def post(self, request):
        serializer = RegistroEnfermedadSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

        usuario = request.user
        empresa_id = getattr(usuario, 'empresa_id', None)

        with transaction.atomic():
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT setval(
                        pg_get_serial_sequence('control_sanitario', 'id'),
                        (SELECT COALESCE(MAX(id), 0) FROM control_sanitario)
                    )
                """)

            registro = serializer.save(
                usuario=usuario,
                empresa_id=empresa_id,
            )
            registrar_evento(
                request,
                accion='crear',
                modulo='sanitario',
                entidad='ControlSanitario',
                entidad_id=registro.id,
                entidad_nombre=(
                    f"Enfermedad '{registro.enfermedad_sintoma}' "
                    f"- Lote {registro.lote_id}"
                ),
                detalle=request.data,
                usuario=usuario,
            )

        return Response(
            {
                'detail': 'Registro sanitario guardado exitosamente',
                'data': RegistroEnfermedadSerializer(registro).data,
            },
            status=status.HTTP_201_CREATED,
        )


class DetalleEnfermedadView(TenantSafeView):
    """GET y PATCH de un registro de enfermedad específico."""

    permission_classes = [IsAuthenticated]
    queryset = ControlSanitario.objects.filter(tipo_registro='enfermedad')

    def _get_object(self, pk):
        try:
            return self.get_queryset().get(pk=pk)
        except ControlSanitario.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response(
                {'detail': 'Registro no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(RegistroEnfermedadSerializer(obj).data)

    def patch(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response(
                {'detail': 'Registro no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = RegistroEnfermedadSerializer(
            obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            registro = serializer.save()
            registrar_evento(
                request,
                accion='editar',
                modulo='sanitario',
                entidad='ControlSanitario',
                entidad_id=registro.id,
                entidad_nombre=(
                    f"Actualización enfermedad '{registro.enfermedad_sintoma}' "
                    f"- Lote {registro.lote_id}"
                ),
                detalle=request.data,
                usuario=request.user,
            )

        return Response(RegistroEnfermedadSerializer(registro).data)