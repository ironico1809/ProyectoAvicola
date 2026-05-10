"""Vistas (endpoints) de la app `bitacora`.

Expone el endpoint de consulta alineado al esquema solicitado.
"""

from django.utils.dateparse import parse_datetime

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from apps.bitacora.models import BitacoraEvento
from apps.bitacora.serializers import BitacoraEventoSerializer


class BitacoraPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500


class BitacoraListView(APIView):
    """Lista eventos de bitácora con paginación y optimización N+1."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Optimizamos con select_related para traer el nombre del usuario en una sola consulta
        qs = BitacoraEvento.objects.select_related('usuario').all().order_by('-fecha_hora', '-id')

        usuario_id = request.query_params.get('usuario_id')
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)

        accion = request.query_params.get('accion')
        if accion:
            qs = qs.filter(accion=accion)

        desde = request.query_params.get('desde')
        if desde:
            dt = parse_datetime(desde)
            if dt:
                qs = qs.filter(fecha_hora__gte=dt)

        hasta = request.query_params.get('hasta')
        if hasta:
            dt = parse_datetime(hasta)
            if dt:
                qs = qs.filter(fecha_hora__lte=dt)

        paginator = BitacoraPagination()
        page = paginator.paginate_queryset(qs, request)
        
        if page is not None:
            serializer = BitacoraEventoSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = BitacoraEventoSerializer(qs, many=True)
        return Response(serializer.data)
