from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce

from galpones.models import Galpon
from galpones.serializers import GalponSerializer
from bitacora.utils import registrar_evento


class GalponListCreateView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		galpones = Galpon.objects.all().order_by('id')
		return Response(GalponSerializer(galpones, many=True).data, status=status.HTTP_200_OK)

	def post(self, request):
		serializer = GalponSerializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		galpon = serializer.save()
		registrar_evento(
			request,
			accion='crear',
			modulo='galpones',
			entidad='Galpon',
			entidad_id=galpon.id,
			detalle={'nombre': galpon.nombre},
			usuario=request.user,
		)
		return Response(GalponSerializer(galpon).data, status=status.HTTP_201_CREATED)


class GalponDetailView(APIView):
	permission_classes = [IsAuthenticated]

	def _get_galpon_or_404(self, galpon_id):
		try:
			return Galpon.objects.get(pk=galpon_id)
		except Galpon.DoesNotExist:
			return None

	def get(self, request, galpon_id):
		galpon = self._get_galpon_or_404(galpon_id)
		if not galpon:
			return Response({'detail': 'Galpón no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
		return Response(GalponSerializer(galpon).data, status=status.HTTP_200_OK)

	def put(self, request, galpon_id):
		galpon = self._get_galpon_or_404(galpon_id)
		if not galpon:
			return Response({'detail': 'Galpón no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

		serializer = GalponSerializer(galpon, data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		galpon = serializer.save()
		registrar_evento(
			request,
			accion='editar',
			modulo='galpones',
			entidad='Galpon',
			entidad_id=galpon.id,
			usuario=request.user,
		)
		return Response(GalponSerializer(galpon).data, status=status.HTTP_200_OK)

	def patch(self, request, galpon_id):
		galpon = self._get_galpon_or_404(galpon_id)
		if not galpon:
			return Response({'detail': 'Galpón no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

		serializer = GalponSerializer(galpon, data=request.data, partial=True)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		galpon = serializer.save()
		registrar_evento(
			request,
			accion='editar',
			modulo='galpones',
			entidad='Galpon',
			entidad_id=galpon.id,
			usuario=request.user,
		)
		return Response(GalponSerializer(galpon).data, status=status.HTTP_200_OK)

	def delete(self, request, galpon_id):
		galpon = self._get_galpon_or_404(galpon_id)
		if not galpon:
			return Response({'detail': 'Galpón no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

		registrar_evento(
			request,
			accion='eliminar',
			modulo='galpones',
			entidad='Galpon',
			entidad_id=galpon.id,
			detalle={'nombre': galpon.nombre},
			usuario=request.user,
		)
		galpon.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)


class GalponEstadoListView(APIView):
	"""Resumen de estado por galpón para dashboard.

	Endpoint:
	  - GET /galpones/estado/
	"""

	permission_classes = [IsAuthenticated]

	def get(self, request):
		queryset = (
			Galpon.objects.all()
			.annotate(
				total_lotes=Count('lotes', distinct=True),
				aves_actuales=Coalesce(Sum('lotes__cantidad_actual'), 0),
				lotes_crianza=Count('lotes', filter=Q(lotes__estado='Crianza'), distinct=True),
				lotes_activo=Count('lotes', filter=Q(lotes__estado='activo'), distinct=True),
				lotes_finalizado=Count('lotes', filter=Q(lotes__estado='finalizado'), distinct=True),
			)
			.order_by('id')
		)

		data = []
		for g in queryset:
			capacidad = g.capacidad or 0
			aves_actuales = int(g.aves_actuales or 0)
			porcentaje_ocupacion = None
			if capacidad > 0:
				porcentaje_ocupacion = round((aves_actuales / capacidad) * 100, 2)

			data.append(
				{
					'galpon': GalponSerializer(g).data,
					'total_lotes': int(g.total_lotes or 0),
					'aves_actuales': aves_actuales,
					'porcentaje_ocupacion': porcentaje_ocupacion,
					'lotes_por_estado': {
						'Crianza': int(g.lotes_crianza or 0),
						'activo': int(g.lotes_activo or 0),
						'finalizado': int(g.lotes_finalizado or 0),
					},
				}
			)

		return Response(data, status=status.HTTP_200_OK)
