from django.db import transaction
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.mixins import TenantSafeView
from apps.alimentacion.models import Alimentacion
from apps.alimentacion.serializers import AlimentacionSerializer
from apps.bitacora.utils import registrar_evento

from apps.insumos.models import Insumo, MovimientoAlmacen


def _descontar_stock(insumo_id, cantidad, lote_id):
	insumo = Insumo.objects.select_for_update().get(pk=insumo_id)
	if insumo.stock_actual < cantidad:
		raise ValueError(
			f"Stock insuficiente para '{insumo.nombre}'. "
			f"Disponible: {insumo.stock_actual} {insumo.unidad_medida}, "
			f"Solicitado: {cantidad} {insumo.unidad_medida}."
		)
	insumo.stock_actual -= cantidad
	insumo.save()
	MovimientoAlmacen.objects.create(
		insumo=insumo,
		tipo_movimiento='Salida',
		cantidad=cantidad,
		motivo=f'Consumo alimentación - Lote {lote_id}',
	)


class AlimentacionBulkCreateView(TenantSafeView):
	"""Registro masivo de alimentación aislado por tenant."""
	permission_classes = [IsAuthenticated]

	def perform_create(self, serializer):
		user = getattr(self.request, 'user', None)
		empresa_id = getattr(user, 'empresa_id', None)
		return serializer.save(empresa_id=empresa_id)

	def post(self, request):
		registros = request.data.get('registros', [])
		if not isinstance(registros, list) or not registros:
			return Response({'detail': 'Se requiere una lista de registros.'},
							status=status.HTTP_400_BAD_REQUEST)

		creados = []
		try:
			with transaction.atomic():
				for data in registros:
					insumo_id = data.get('insumo_id')
					serializer = AlimentacionSerializer(data=data)
					if serializer.is_valid(raise_exception=True):
						obj = self.perform_create(serializer)
						creados.append(obj)

						if insumo_id:
							_descontar_stock(
								insumo_id, obj.cantidad_kg, obj.lote_id)

						registrar_evento(
							request,
							accion='crear',
							modulo='alimentacion',
							entidad='Alimentacion',
							entidad_id=obj.id_alimentacion,
							entidad_nombre=f"Alimentación Masiva - Lote {obj.lote_id}",
							detalle=data,
							usuario=request.user,
						)
		except Insumo.DoesNotExist:
			return Response({'detail': 'Insumo no encontrado.'},
							status=status.HTTP_404_NOT_FOUND)
		except ValueError as e:
			return Response({'detail': str(e)},
							status=status.HTTP_400_BAD_REQUEST)
		except Exception as e:
			return Response({'detail': str(e)},
							status=status.HTTP_400_BAD_REQUEST)

		return Response({'count': len(creados)},
						status=status.HTTP_201_CREATED)


class AlimentacionListCreateView(TenantSafeView):
	"""Listado y creación individual de alimentación blindada por tenant."""
	permission_classes = [IsAuthenticated]
	queryset = Alimentacion.objects.all()

	def _parse_query_date(self, value, field_name):
		if not value:
			return None, None
		parsed = parse_date(value)
		if parsed is None:
			return None, {field_name: 'Formato inválido. Use YYYY-MM-DD.'}
		return parsed, None

	def get(self, request):
		base_qs = Alimentacion.objects.select_related('lote', 'insumo').all()
		queryset = self.filter_by_tenant(base_qs).order_by('-fecha', '-id_alimentacion')

		id_lote = request.query_params.get('id_lote')  # type: ignore
		if id_lote:
			queryset = queryset.filter(lote_id=id_lote)

		insumo_id = request.query_params.get('insumo_id')  # type: ignore
		if insumo_id:
			queryset = queryset.filter(insumo_id=insumo_id)

		fecha_inicio_raw = request.query_params.get('fecha_inicio')  # type: ignore
		fecha_fin_raw = request.query_params.get('fecha_fin')  # type: ignore

		fecha_inicio, err = self._parse_query_date(
			fecha_inicio_raw, 'fecha_inicio')
		if err:
			return Response(err, status=status.HTTP_400_BAD_REQUEST)
		fecha_fin, err = self._parse_query_date(fecha_fin_raw, 'fecha_fin')
		if err:
			return Response(err, status=status.HTTP_400_BAD_REQUEST)

		if fecha_inicio and fecha_fin and fecha_inicio > fecha_fin:
			return Response(
				{'detail': '`fecha_inicio` no puede ser mayor que `fecha_fin`.'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		if fecha_inicio:
			queryset = queryset.filter(fecha__gte=fecha_inicio)
		if fecha_fin:
			queryset = queryset.filter(fecha__lte=fecha_fin)

		return Response(AlimentacionSerializer(
			queryset, many=True).data, status=status.HTTP_200_OK)

	def perform_create(self, serializer):
		user = getattr(self.request, 'user', None)
		empresa_id = getattr(user, 'empresa_id', None)
		return serializer.save(empresa_id=empresa_id)

	def post(self, request):
		insumo_id = request.data.get('insumo_id')
		serializer = AlimentacionSerializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors,
							status=status.HTTP_400_BAD_REQUEST)

		try:
			with transaction.atomic():
				alimentacion = self.perform_create(serializer)

				if insumo_id:
					_descontar_stock(
						insumo_id,
						alimentacion.cantidad_kg,
						alimentacion.lote_id)

				entidad_nombre = f"Alimentación {alimentacion.id_alimentacion} - Lote {alimentacion.lote_id}"
				registrar_evento(
					request,
					accion='crear',
					modulo='alimentacion',
					entidad='Alimentacion',
					entidad_id=alimentacion.id_alimentacion,
					entidad_nombre=entidad_nombre,
					detalle=request.data,
					usuario=request.user,
				)
		except Insumo.DoesNotExist:
			return Response({'detail': 'Insumo no encontrado.'},
							status=status.HTTP_404_NOT_FOUND)
		except ValueError as e:
			return Response({'detail': str(e)},
							status=status.HTTP_400_BAD_REQUEST)

		return Response(AlimentacionSerializer(
			alimentacion).data, status=status.HTTP_201_CREATED)


class AlimentacionDetailView(TenantSafeView):
	"""Obtener, actualizar o eliminar alimentación aislado por tenant."""
	permission_classes = [IsAuthenticated]
	queryset = Alimentacion.objects.all()

	def get_object(self, pk):
		try:
			return self.get_queryset().get(pk=pk)
		except Alimentacion.DoesNotExist:
			return None

	def get(self, request, pk):
		obj = self.get_object(pk)
		if not obj:
			return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
		return Response(AlimentacionSerializer(obj).data)

	def patch(self, request, pk):
		obj = self.get_object(pk)
		if not obj:
			return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
		
		serializer = AlimentacionSerializer(obj, data=request.data, partial=True)
		if serializer.is_valid():
			empresa_id = getattr(obj, 'empresa_id', None)
			obj = serializer.save(empresa_id=empresa_id)
			registrar_evento(
				request,
				accion='editar',
				modulo='alimentacion',
				entidad='Alimentacion',
				entidad_id=obj.id_alimentacion,
				entidad_nombre=f"Edición Alimentación {obj.id_alimentacion}",
				detalle=request.data,
				usuario=request.user,
			)
			return Response(AlimentacionSerializer(obj).data)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	def delete(self, request, pk):
		obj = self.get_object(pk)
		if not obj:
			return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
		
		id_ali = obj.id_alimentacion
		obj.delete()
		registrar_evento(
			request,
			accion='eliminar',
			modulo='alimentacion',
			entidad='Alimentacion',
			entidad_id=id_ali,
			entidad_nombre=f"Eliminación Alimentación {id_ali}",
			detalle={'id': id_ali},
			usuario=request.user,
		)
		return Response(status=status.HTTP_204_NO_CONTENT)
