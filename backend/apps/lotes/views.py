"""Vistas (endpoints) de la app `lotes`.

Endpoints:
- `GET /lotes/` -> lista lotes (opcional filtro por `id_galpon`).
- `POST /lotes/` -> crea lote.
- `GET /lotes/<id>/` -> detalle.
- `PUT/PATCH /lotes/<id>/` -> actualización.
- `DELETE /lotes/<id>/` -> eliminación.
- `GET /lotes/resumen/estados/` -> agregación por estado.

Todas las rutas requieren autenticación (IsAuthenticated).
"""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce

from apps.core.mixins import TenantSafeView
from apps.lotes.models import Lote
from apps.lotes.serializers import LoteSerializer
from apps.bitacora.utils import registrar_evento


class LoteListCreateView(TenantSafeView):
    """Lista y crea lotes garantizando pertenencia al tenant."""
    permission_classes = [IsAuthenticated]
    queryset = Lote.objects.all()

    def get(self, request):
        queryset = self.get_queryset().order_by('-id_lote')

        id_galpon = request.query_params.get('id_galpon')
        if id_galpon:
            queryset = queryset.filter(galpon_id=id_galpon)

        return Response(LoteSerializer(queryset, many=True).data,
                        status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        empresa_id = getattr(user, 'empresa_id', None)
        return serializer.save(empresa_id=empresa_id)

    def post(self, request):
        serializer = LoteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

        lote = self.perform_create(serializer)
        galpon_nombre = None
        try:
            galpon_nombre = getattr(getattr(lote, 'galpon', None), 'nombre', None)
        except Exception:
            galpon_nombre = None
        entidad_nombre = (
            f"Lote {getattr(lote, 'id_lote', '')} - Galpón {galpon_nombre}" if galpon_nombre else f"Lote {getattr(lote, 'id_lote', '')}"
        )
        registrar_evento(
            request,
            accion='crear',
            modulo='lotes',
            entidad='Lote',
            entidad_id=getattr(lote, 'id_lote', None),
            entidad_nombre=entidad_nombre,
            detalle={'id_galpon': getattr(lote, 'galpon_id', None),
                     'cantidad_inicial': getattr(lote, 'cantidad_inicial', None)},
            usuario=request.user,
        )
        return Response(LoteSerializer(lote).data,
                        status=status.HTTP_201_CREATED)


class LoteDetailView(TenantSafeView):
    """CRUD sobre un lote específico por id aislado por tenant."""
    permission_classes = [IsAuthenticated]
    queryset = Lote.objects.all()

    def _get_lote_or_404(self, id_lote):
        try:
            return self.get_queryset().get(pk=id_lote)
        except Lote.DoesNotExist:
            return None

    def get(self, request, id_lote):
        lote = self._get_lote_or_404(id_lote)
        if not lote:
            return Response({'detail': 'Lote no encontrado.'},
                            status=status.HTTP_404_NOT_FOUND)
        return Response(LoteSerializer(lote).data, status=status.HTTP_200_OK)

    def put(self, request, id_lote):
        lote = self._get_lote_or_404(id_lote)
        if not lote:
            return Response({'detail': 'Lote no encontrado.'},
                            status=status.HTTP_404_NOT_FOUND)

        serializer = LoteSerializer(lote, data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

        empresa_id = getattr(lote, 'empresa_id', None)
        lote = serializer.save(empresa_id=empresa_id)
        galpon_nombre = None
        try:
            galpon_nombre = getattr(getattr(lote, 'galpon', None), 'nombre', None)
        except Exception:
            galpon_nombre = None
        entidad_nombre = (
            f"Lote {getattr(lote, 'id_lote', '')} - Galpón {galpon_nombre}" if galpon_nombre else f"Lote {getattr(lote, 'id_lote', '')}"
        )
        registrar_evento(
            request,
            accion='editar',
            modulo='lotes',
            entidad='Lote',
            entidad_id=getattr(lote, 'id_lote', None),
            entidad_nombre=entidad_nombre,
            usuario=request.user,
        )
        return Response(LoteSerializer(lote).data, status=status.HTTP_200_OK)

    def patch(self, request, id_lote):
        lote = self._get_lote_or_404(id_lote)
        if not lote:
            return Response({'detail': 'Lote no encontrado.'},
                            status=status.HTTP_404_NOT_FOUND)

        serializer = LoteSerializer(lote, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

        empresa_id = getattr(lote, 'empresa_id', None)
        lote = serializer.save(empresa_id=empresa_id)
        galpon_nombre = None
        try:
            galpon_nombre = getattr(getattr(lote, 'galpon', None), 'nombre', None)
        except Exception:
            galpon_nombre = None
        entidad_nombre = (
            f"Lote {getattr(lote, 'id_lote', '')} - Galpón {galpon_nombre}" if galpon_nombre else f"Lote {getattr(lote, 'id_lote', '')}"
        )
        registrar_evento(
            request,
            accion='editar',
            modulo='lotes',
            entidad='Lote',
            entidad_id=getattr(lote, 'id_lote', None),
            entidad_nombre=entidad_nombre,
            usuario=request.user,
        )
        return Response(LoteSerializer(lote).data, status=status.HTTP_200_OK)

    def delete(self, request, id_lote):
        lote = self._get_lote_or_404(id_lote)
        if not lote:
            return Response({'detail': 'Lote no encontrado.'},
                            status=status.HTTP_404_NOT_FOUND)

        galpon_nombre = None
        try:
            galpon_nombre = getattr(getattr(lote, 'galpon', None), 'nombre', None)
        except Exception:
            galpon_nombre = None
        entidad_nombre = (
            f"Lote {getattr(lote, 'id_lote', '')} - Galpón {galpon_nombre}" if galpon_nombre else f"Lote {getattr(lote, 'id_lote', '')}"
        )
        registrar_evento(
            request,
            accion='eliminar',
            modulo='lotes',
            entidad='Lote',
            entidad_id=getattr(lote, 'id_lote', None),
            entidad_nombre=entidad_nombre,
            detalle={'id_galpon': getattr(lote, 'galpon_id', None)},
            usuario=request.user,
        )
        lote.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LotesResumenEstadoView(TenantSafeView):
    """Resumen global de lotes agrupado por estado filtrado por tenant."""
    permission_classes = [IsAuthenticated]
    queryset = Lote.objects.all()

    def get(self, request):
        base_qs = self.get_queryset()
        rows = (
            base_qs.values('estado')
            .annotate(
                total_lotes=Count('id_lote'),
                aves_actuales=Coalesce(Sum('cantidad_actual'), 0),
            )
            .order_by('estado')
        )

        return Response(list(rows), status=status.HTTP_200_OK)
