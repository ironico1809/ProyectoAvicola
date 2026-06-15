from django.db import transaction
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.mixins import TenantSafeView
from apps.bitacora.utils import registrar_evento
from apps.insumos.models import MovimientoAlmacen, Insumo, ControlSanitario
from apps.sanitario.models import AlertaSanitaria
from apps.sanitario.services import (
    generar_alertas_por_enfermedad,
    generar_alerta_por_stock_medicamento,
)
from apps.sanitario.serializers import (
    ControlSanitarioSerializer,
    RegistroEnfermedadSerializer,
    AlertaSanitariaSerializer,
)


class AplicacionesSanitariasView(TenantSafeView):
    """Registro y consulta de aplicaciones/tratamientos sanitarios."""

    permission_classes = [IsAuthenticated]  
    queryset = ControlSanitario.objects.all()

    def get(self, request):
        qs = self.get_queryset().select_related('lote', 'insumo').filter(
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
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        lote = serializer.validated_data.get('lote')
        if lote and lote.estado.lower() == 'finalizado':
            return Response(
                {'lote': ['No se pueden registrar tratamientos en un lote finalizado.']},
                status=status.HTTP_400_BAD_REQUEST
            )

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
            control = serializer.save(tipo_registro='tratamiento', empresa_id=empresa_id)
            alerta_stock = None

            if control.insumo:
                insumo = control.insumo
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

                alerta_stock = generar_alerta_por_stock_medicamento(
                    insumo=insumo,
                    usuario=request.user,
                    lote=control.lote,
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

            if alerta_stock:
                registrar_evento(
                    request,
                    accion='crear',
                    modulo='sanitario',
                    entidad='AlertaSanitaria',
                    entidad_id=alerta_stock.id,
                    entidad_nombre=f"Alerta stock crítico {alerta_stock.insumo_id}",
                    detalle={'tipo_alerta': alerta_stock.tipo_alerta, 'estado': alerta_stock.estado},
                    usuario=request.user,
                )

        return Response(ControlSanitarioSerializer(control).data, status=status.HTTP_201_CREATED)


class HistorialClinicoLotesView(TenantSafeView):
    """Historial clínico por lote (cronológico)."""

    permission_classes = [IsAuthenticated]
    queryset = ControlSanitario.objects.all()

    def get(self, request):
        lote_id = request.query_params.get('lote')
        if not lote_id:
            return Response(
                {'lote': 'Este parámetro es requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = self.get_queryset().select_related('lote', 'insumo').filter(
            lote_id=lote_id
        ).order_by('fecha_aplicacion', 'id')

        return Response(ControlSanitarioSerializer(qs, many=True).data)


class RegistroEnfermedadesView(TenantSafeView):
    """CU15 / HU3-01-03: Registrar enfermedades por lote."""

    permission_classes = [IsAuthenticated]
    queryset = ControlSanitario.objects.filter(tipo_registro='enfermedad')

    def get(self, request):
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
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

            registro = serializer.save(usuario=usuario, empresa_id=empresa_id)

            registrar_evento(
                request,
                accion='crear',
                modulo='sanitario',
                entidad='ControlSanitario',
                entidad_id=registro.id,
                entidad_nombre=(
                    f"Enfermedad '{registro.enfermedad_sintoma}' - Lote {registro.lote_id}"
                ),
                detalle=request.data,
                usuario=usuario,
            )

            alertas_generadas = generar_alertas_por_enfermedad(
                registro_enfermedad=registro,
                usuario=usuario,
            )

            for alerta in alertas_generadas:
                registrar_evento(
                    request,
                    accion='crear',
                    modulo='sanitario',
                    entidad='AlertaSanitaria',
                    entidad_id=alerta.id,
                    entidad_nombre=f"Alerta sanitaria Lote {alerta.lote_id}",
                    detalle={
                        'tipo_alerta': alerta.tipo_alerta,
                        'nivel': alerta.nivel,
                        'estado': alerta.estado,
                        'porcentaje_detectado': str(alerta.porcentaje_detectado),
                    },
                    usuario=usuario,
                )

        return Response(
            {
                'detail': 'Registro sanitario guardado exitosamente',
                'data': RegistroEnfermedadSerializer(registro).data,
                'alertas_generadas': AlertaSanitariaSerializer(alertas_generadas, many=True).data,
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
            return Response({'detail': 'Registro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(RegistroEnfermedadSerializer(obj).data)

    def patch(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Registro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RegistroEnfermedadSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            registro = serializer.save()
            registrar_evento(
                request,
                accion='editar',
                modulo='sanitario',
                entidad='ControlSanitario',
                entidad_id=registro.id,
                entidad_nombre=(
                    f"Actualización enfermedad '{registro.enfermedad_sintoma}' - Lote {registro.lote_id}"
                ),
                detalle=request.data,
                usuario=request.user,
            )

        return Response(RegistroEnfermedadSerializer(registro).data)


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

        dosis_anterior = control.dosis or 0
        insumo_anterior_id = control.insumo_id

        serializer = ControlSanitarioSerializer(control, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        lote = serializer.validated_data.get('lote', control.lote)
        if lote and lote.estado.lower() == 'finalizado' and 'lote' in request.data:
            return Response({'lote': ['No se pueden asignar tratamientos a un lote finalizado.']}, status=status.HTTP_400_BAD_REQUEST)

        insumo = serializer.validated_data.get('insumo', control.insumo)
        nueva_dosis = serializer.validated_data.get('dosis', control.dosis) or 0

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
        alerta_stock = None

        with transaction.atomic():
            if control.insumo:
                insumo_ant = control.insumo
                if insumo_ant.id_insumo != (insumo.id_insumo if insumo else None):
                    insumo_ant.stock_actual += dosis_anterior
                    insumo_ant.save()
                    MovimientoAlmacen.objects.create(
                        insumo=insumo_ant,
                        tipo_movimiento='Entrada',
                        cantidad=dosis_anterior,
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
                            insumo=insumo_ant,
                            tipo_movimiento=tipo_mov,
                            cantidad=abs(diferencia),
                            motivo=f'Ajuste Tratamiento - Lote {control.lote_id}',
                            empresa_id=empresa_id
                        )
                        alerta_stock = generar_alerta_por_stock_medicamento(
                            insumo=insumo_ant,
                            usuario=request.user,
                            lote=control.lote,
                        )

            if insumo and insumo.id_insumo != insumo_anterior_id:
                insumo.stock_actual -= nueva_dosis
                insumo.save()
                MovimientoAlmacen.objects.create(
                    insumo=insumo,
                    tipo_movimiento='Salida',
                    cantidad=nueva_dosis,
                    motivo=f'Tratamiento Sanitario (Nuevo Insumo) - Lote {control.lote_id}',
                    empresa_id=empresa_id
                )
                alerta_stock = generar_alerta_por_stock_medicamento(
                    insumo=insumo,
                    usuario=request.user,
                    lote=control.lote,
                )

            updated_control = serializer.save(empresa_id=empresa_id)

            registrar_evento(
                request,
                accion='editar',
                modulo='sanitario',
                entidad='ControlSanitario',
                entidad_id=updated_control.id,
                entidad_nombre=f"Tratamiento Lote {updated_control.lote_id}",
                usuario=request.user
            )

            if alerta_stock:
                registrar_evento(
                    request,
                    accion='crear',
                    modulo='sanitario',
                    entidad='AlertaSanitaria',
                    entidad_id=alerta_stock.id,
                    entidad_nombre=f"Alerta stock crítico {alerta_stock.insumo_id}",
                    detalle={'tipo_alerta': alerta_stock.tipo_alerta, 'estado': alerta_stock.estado},
                    usuario=request.user,
                )

        return Response(ControlSanitarioSerializer(updated_control).data)

    def put(self, request, pk):
        return self.patch(request, pk)


class AlertasSanitariasView(TenantSafeView):
    """CU17: Listar alertas generadas por riesgo sanitario."""

    permission_classes = [IsAuthenticated]
    queryset = AlertaSanitaria.objects.all()

    def get(self, request):
        qs = self.get_queryset().select_related(
            'lote',
            'registro_enfermedad',
            'insumo',
            'usuario'
        )

        lote_id = request.query_params.get('lote')
        estado = request.query_params.get('estado')
        nivel = request.query_params.get('nivel')
        tipo_alerta = request.query_params.get('tipo_alerta')

        if lote_id:
            qs = qs.filter(lote_id=lote_id)
        if estado:
            qs = qs.filter(estado=estado)
        if nivel:
            qs = qs.filter(nivel=nivel)
        if tipo_alerta:
            qs = qs.filter(tipo_alerta=tipo_alerta)

        return Response(AlertaSanitariaSerializer(qs, many=True).data)


class DetalleAlertaSanitariaView(TenantSafeView):
    """CU17: Consultar o cambiar estado de una alerta sanitaria."""

    permission_classes = [IsAuthenticated]
    queryset = AlertaSanitaria.objects.all()

    def get_object(self, pk):
        try:
            return self.get_queryset().get(pk=pk)
        except AlertaSanitaria.DoesNotExist:
            return None

    def get(self, request, pk):
        alerta = self.get_object(pk)
        if not alerta:
            return Response({'detail': 'Alerta sanitaria no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AlertaSanitariaSerializer(alerta).data)

    def patch(self, request, pk):
        alerta = self.get_object(pk)
        if not alerta:
            return Response({'detail': 'Alerta sanitaria no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        nuevo_estado = request.data.get('estado')
        estados_validos = ['Pendiente', 'Atendida', 'Resuelta']

        if nuevo_estado not in estados_validos:
            return Response(
                {'estado': [f"Estado inválido. Use: {', '.join(estados_validos)}."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        alerta.estado = nuevo_estado
        alerta.save(update_fields=['estado'])

        registrar_evento(
            request,
            accion='editar',
            modulo='sanitario',
            entidad='AlertaSanitaria',
            entidad_id=alerta.id,
            entidad_nombre=f"Alerta sanitaria {alerta.id}",
            detalle={'estado': nuevo_estado},
            usuario=request.user,
        )

        return Response(AlertaSanitariaSerializer(alerta).data)
