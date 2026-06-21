from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.core.mixins import TenantSafeView
from .models import RegistroMortalidad, PrediccionMortalidad
from .serializers import RegistroMortalidadSerializer, PrediccionMortalidadSerializer
from apps.bitacora.models import BitacoraEvento
from apps.sanitario.services import generar_alerta_por_mortandad
from .prediccion_service import predecir_mortalidad_lote

class RegistroMortalidadViewSet(TenantSafeView, viewsets.ModelViewSet):
    serializer_class = RegistroMortalidadSerializer
    queryset = RegistroMortalidad.objects.all().order_by('-fecha_hora', '-id_muerte')

    def get_queryset(self):
        # Filtrado base seguro por tenant heredado de TenantSafeView
        queryset = super().get_queryset()
        
        lote_id = self.request.query_params.get('lote')  # type: ignore
        fecha_inicio = self.request.query_params.get('fecha_inicio')  # type: ignore
        fecha_fin = self.request.query_params.get('fecha_fin')  # type: ignore

        if lote_id:
            queryset = queryset.filter(lote_id=lote_id)
        if fecha_inicio:
            queryset = queryset.filter(fecha_hora__date__gte=fecha_inicio)
        if fecha_fin:
            queryset = queryset.filter(fecha_hora__date__lte=fecha_fin)

        return queryset

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        empresa_id = getattr(user, 'empresa_id', None)
        registro = serializer.save(empresa_id=empresa_id)

        # 1. CAPTURAR LA IP REAL DEL USUARIO
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_cliente = x_forwarded_for.split(',')[0]
        else:
            ip_cliente = self.request.META.get('REMOTE_ADDR')

        usuario_actual = self.request.user if getattr(self.request.user, 'is_authenticated', False) else None
        
        causa_texto = getattr(registro, 'causa', None) if getattr(registro, 'causa', None) else 'No especificada'
        
        # 2. AGREGAMOS LA IP A LA DESCRIPCIÓN (Ya que no hay columna IP en la BD)
        descripcion_evento = (
            f"Se registraron {getattr(registro, 'cantidad', 0)} bajas para el "
            f"Lote {getattr(getattr(registro, 'lote', None), 'id_lote', '')}. Causa: {causa_texto}. [IP del registro: {ip_cliente}]"
        )
        
        # 3. GUARDAMOS EN LA BITÁCORA SIN ROMPER EL ESQUEMA SQL
        BitacoraEvento.objects.create(
            usuario=usuario_actual,
            accion="Registro de Mortandad",
            descripcion=descripcion_evento
        )
        # CU17: si existe enfermedad activa y la mortandad sube más del 20%,
        # se genera una alerta sanitaria automáticamente.
        generar_alerta_por_mortandad(registro, usuario=usuario_actual)


class PrediccionMortalidadHistorialView(TenantSafeView):
    """
    Obtiene el historial de predicciones de un lote.
    Filtro por tenant y lote.
    """
    permission_classes = [IsAuthenticated]
    queryset = PrediccionMortalidad.objects.all().order_by('-fecha_hora', '-id_prediccion')

    def get(self, request):
        lote_id = request.query_params.get('lote_id')
        if not lote_id:
            return Response(
                {"error": "Se requiere el parámetro lote_id."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Filtrar por tenant (heredado de TenantSafeView)
        queryset = self.get_queryset().filter(lote_id=lote_id)

        # Limitar a las últimas 30 predicciones para graficar la tendencia
        queryset = queryset[:30]

        # Invertir para que estén cronológicamente ordenadas de vieja a nueva
        serializer = PrediccionMortalidadSerializer(reversed(list(queryset)), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PrediccionMortalidadGenerarView(TenantSafeView):
    """
    Calcula y guarda una predicción en tiempo real.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        lote_id = request.data.get('lote_id')
        if not lote_id:
            return Response(
                {"error": "Se requiere lote_id en el cuerpo de la petición."},
                status=status.HTTP_400_BAD_REQUEST
            )

        empresa_id = self.get_tenant_id()

        prediccion = predecir_mortalidad_lote(lote_id, empresa_id=empresa_id)
        if not prediccion:
            return Response(
                {"error": "El lote no existe o no se pudieron calcular los datos."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PrediccionMortalidadSerializer(prediccion)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RecomendacionesPendientesView(TenantSafeView):
    """
    CU29: Obtiene las recomendaciones Pendiente de la última predicción
    de cada lote activo. Usado por Dashboard, Monitoreo, Alertas, etc.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.lotes.models import Lote

        empresa_id = self.get_tenant_id()

        lotes_activos = Lote.objects.filter(
            empresa_id=empresa_id,
            estado__in=["Crianza", "crecimiento", "engorde", "activo", "Listo"],
        )

        resultados = []
        for lote in lotes_activos:
            prediccion = PrediccionMortalidad.objects.filter(
                lote=lote, empresa_id=empresa_id
            ).order_by('-fecha_hora', '-id_prediccion').first()

            if prediccion:
                raw_recs = prediccion.recomendaciones or []
                recs_pendientes = []
                for i, r in enumerate(raw_recs):
                    if isinstance(r, dict):
                        if r.get("estado") == "Pendiente":
                            recs_pendientes.append(r)
                    elif isinstance(r, str):
                        # Formato antiguo: strings planas → tratadas como Pendiente
                        recs_pendientes.append({
                            "id": i + 1,
                            "texto": r,
                            "estado": "Pendiente",
                        })
                if recs_pendientes:
                    resultados.append({
                        "id_prediccion": prediccion.id_prediccion,
                        "lote_id": lote.id_lote,
                        "lote_codigo": str(lote.id_lote),
                        "galpon_nombre": getattr(lote.galpon, 'nombre', None) if lote.galpon else None,
                        "riesgo_porcentaje": float(prediccion.riesgo_porcentaje),
                        "nivel_riesgo": prediccion.nivel_riesgo,
                        "fecha_hora": prediccion.fecha_hora.isoformat(),
                        "recomendaciones": recs_pendientes,
                    })

        return Response(resultados, status=status.HTTP_200_OK)


class RecomendacionActualizarView(TenantSafeView):
    """
    CU29: Actualiza el estado de una recomendación de IA (Pendiente -> Aplicada/Ignorada).
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, id_prediccion):
        try:
            pred = self.filter_by_tenant(PrediccionMortalidad.objects.all()).get(pk=id_prediccion)
        except PrediccionMortalidad.DoesNotExist:
            return Response({"error": "Predicción no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        rec_id = request.data.get("recomendacion_id")
        nuevo_estado = request.data.get("estado")  # 'Aplicada' o 'Ignorada'

        if not rec_id or nuevo_estado not in ["Aplicada", "Ignorada"]:
            return Response(
                {"error": "Se requieren recomendacion_id y estado ('Aplicada' o 'Ignorada')."},
                status=status.HTTP_400_BAD_REQUEST
            )

        recs = list(pred.recomendaciones)
        actualizado = False
        for r in recs:
            if isinstance(r, dict) and str(r.get("id")) == str(rec_id):
                r["estado"] = nuevo_estado
                actualizado = True
                break

        if not actualizado:
            return Response({"error": "Recomendación no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        pred.recomendaciones = recs
        pred.save()

        return Response(PrediccionMortalidadSerializer(pred).data, status=status.HTTP_200_OK)


class RecomendacionesCentroView(TenantSafeView):
    """
    CU29 Avanzado: Obtiene todas las recomendaciones (históricas y pendientes) de los lotes.
    Incluye factores clave de riesgo para justificar cada sugerencia.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.lotes.models import Lote

        empresa_id = self.get_tenant_id()

        lotes_qs = Lote.objects.filter(
            empresa_id=empresa_id
        ).order_by('-id_lote')

        resultados = []
        for lote in lotes_qs:
            prediccion = PrediccionMortalidad.objects.filter(
                lote=lote, empresa_id=empresa_id
            ).order_by('-fecha_hora', '-id_prediccion').first()

            if prediccion:
                raw_recs = prediccion.recomendaciones or []
                recs_formateadas = []
                for i, r in enumerate(raw_recs):
                    if isinstance(r, dict):
                        recs_formateadas.append(r)
                    elif isinstance(r, str):
                        recs_formateadas.append({
                            "id": i + 1,
                            "texto": r,
                            "estado": "Pendiente",
                        })
                
                if recs_formateadas:
                    resultados.append({
                        "id_prediccion": prediccion.id_prediccion,
                        "lote_id": lote.id_lote,
                        "lote_codigo": str(lote.id_lote),
                        "galpon_nombre": getattr(lote.galpon, 'nombre', None) if lote.galpon else None,
                        "riesgo_porcentaje": float(prediccion.riesgo_porcentaje),
                        "nivel_riesgo": prediccion.nivel_riesgo,
                        "fecha_hora": prediccion.fecha_hora.isoformat(),
                        "factores_clave": prediccion.factores_clave or [],
                        "recomendaciones": recs_formateadas,
                    })

        return Response(resultados, status=status.HTTP_200_OK)