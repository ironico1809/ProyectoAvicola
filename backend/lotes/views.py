from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce

from lotes.models import Lote
from lotes.serializers import LoteSerializer
from bitacora.utils import registrar_evento


class LoteListCreateView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		queryset = Lote.objects.all().order_by('-id_lote')

		id_galpon = request.query_params.get('id_galpon')
		if id_galpon:
			queryset = queryset.filter(galpon_id=id_galpon)

		return Response(LoteSerializer(queryset, many=True).data, status=status.HTTP_200_OK)

	def post(self, request):
		serializer = LoteSerializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		lote = serializer.save()
		registrar_evento(
			request,
			accion='crear',
			modulo='lotes',
			entidad='Lote',
			entidad_id=lote.id_lote,
			detalle={'id_galpon': lote.galpon_id, 'cantidad_inicial': lote.cantidad_inicial},
			usuario=request.user,
		)
		return Response(LoteSerializer(lote).data, status=status.HTTP_201_CREATED)


class LoteDetailView(APIView):
	permission_classes = [IsAuthenticated]

	def _get_lote_or_404(self, id_lote):
		try:
			return Lote.objects.get(pk=id_lote)
		except Lote.DoesNotExist:
			return None

	def get(self, request, id_lote):
		lote = self._get_lote_or_404(id_lote)
		if not lote:
			return Response({'detail': 'Lote no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
		return Response(LoteSerializer(lote).data, status=status.HTTP_200_OK)

	def put(self, request, id_lote):
		lote = self._get_lote_or_404(id_lote)
		if not lote:
			return Response({'detail': 'Lote no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

		serializer = LoteSerializer(lote, data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		lote = serializer.save()
		registrar_evento(
			request,
			accion='editar',
			modulo='lotes',
			entidad='Lote',
			entidad_id=lote.id_lote,
			usuario=request.user,
		)
		return Response(LoteSerializer(lote).data, status=status.HTTP_200_OK)

	def patch(self, request, id_lote):
		lote = self._get_lote_or_404(id_lote)
		if not lote:
			return Response({'detail': 'Lote no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

		serializer = LoteSerializer(lote, data=request.data, partial=True)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		lote = serializer.save()
		registrar_evento(
			request,
			accion='editar',
			modulo='lotes',
			entidad='Lote',
			entidad_id=lote.id_lote,
			usuario=request.user,
		)
		return Response(LoteSerializer(lote).data, status=status.HTTP_200_OK)

	def delete(self, request, id_lote):
		lote = self._get_lote_or_404(id_lote)
		if not lote:
			return Response({'detail': 'Lote no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

		registrar_evento(
			request,
			accion='eliminar',
			modulo='lotes',
			entidad='Lote',
			entidad_id=lote.id_lote,
			detalle={'id_galpon': lote.galpon_id},
			usuario=request.user,
		)
		lote.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)


class LotesResumenEstadoView(APIView):
	"""Resumen global de lotes agrupado por estado.

	Endpoint:
	  - GET /lotes/resumen/estados/
	"""

	permission_classes = [IsAuthenticated]

	def get(self, request):
		rows = (
			Lote.objects.values('estado')
			.annotate(
				total_lotes=Count('id_lote'),
				aves_actuales=Coalesce(Sum('cantidad_actual'), 0),
			)
			.order_by('estado')
		)

		return Response(list(rows), status=status.HTTP_200_OK)
