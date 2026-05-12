from rest_framework import viewsets
from .models import RegistroMortalidad
from .serializers import RegistroMortalidadSerializer
from apps.bitacora.models import BitacoraEvento

class RegistroMortalidadViewSet(viewsets.ModelViewSet):
    serializer_class = RegistroMortalidadSerializer

    def get_queryset(self):
        queryset = RegistroMortalidad.objects.all().order_by('-fecha_hora', '-id_muerte')
        
        lote_id = self.request.query_params.get('lote')
        fecha_inicio = self.request.query_params.get('fecha_inicio')
        fecha_fin = self.request.query_params.get('fecha_fin')

        if lote_id:
            queryset = queryset.filter(lote_id=lote_id)
        if fecha_inicio:
            queryset = queryset.filter(fecha_hora__date__gte=fecha_inicio)
        if fecha_fin:
            queryset = queryset.filter(fecha_hora__date__lte=fecha_fin)

        return queryset

    def perform_create(self, serializer):
        registro = serializer.save()

        # 1. CAPTURAR LA IP REAL DEL USUARIO
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_cliente = x_forwarded_for.split(',')[0]
        else:
            ip_cliente = self.request.META.get('REMOTE_ADDR')

        usuario_actual = self.request.user if getattr(self.request.user, 'is_authenticated', False) else None
        
        causa_texto = registro.causa if registro.causa else 'No especificada'
        
        # 2. AGREGAMOS LA IP A LA DESCRIPCIÓN (Ya que no hay columna IP en la BD)
        descripcion_evento = (
            f"Se registraron {registro.cantidad} bajas para el "
            f"Lote {registro.lote.id_lote}. Causa: {causa_texto}. [IP del registro: {ip_cliente}]"
        )
        
        # 3. GUARDAMOS EN LA BITÁCORA SIN ROMPER EL ESQUEMA SQL
        BitacoraEvento.objects.create(
            usuario=usuario_actual,
            accion="Registro de Mortandad",
            descripcion=descripcion_evento
        )