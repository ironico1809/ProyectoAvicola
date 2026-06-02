from rest_framework import viewsets
from apps.core.mixins import TenantSafeView
from .models import RegistroMortalidad
from .serializers import RegistroMortalidadSerializer
from apps.bitacora.models import BitacoraEvento
from apps.sanitario.services import generar_alerta_por_mortandad

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