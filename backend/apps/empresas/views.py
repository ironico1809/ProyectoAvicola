"""Vistas de la app empresas.

PlanesListView        : endpoint público que lista los planes activos.
SuperAdminMetricasView: métricas globales para el SuperAdmin.
SuperAdminClienteView : alta de nueva empresa + primer administrador.
SuperAdminInfraView   : métricas simuladas de infraestructura y seguridad.
SuperAdminBitacoraView: bitácora global filtrable por empresa.
SuperAdminConfigIAView: lectura/escritura del diccionario de estados IA.
"""

import random
from datetime import datetime, timedelta, timezone as dt_tz

from django.contrib.auth.hashers import make_password
from django.db import connection
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.empresas.models import Empresa, Plan
from apps.empresas.serializers import PlanPublicoSerializer

# ── Diccionario de estados IA (en memoria; persiste mientras corre el proceso) ──
# En producción esto iría en BD o en un modelo ConfigGlobal.
_CONFIG_IA = {
    "frio_max": 24.0,   # temperatura < frio_max  → FRIO
    "calor_min": 34.0,  # temperatura > calor_min → CALOR
    # entre frio_max y calor_min → NORMAL
}

def _solo_superadmin(request):
    """Devuelve True si el usuario es Superusuario, False si no."""
    return getattr(request.user, 'tipo_usuario', '') == 'Superusuario'


class PlanesListView(APIView):
    """Lista los planes de suscripción activos.

    Endpoint: GET /empresas/planes/
    Acceso:   Público (sin token).
    Salida:   Array de planes ordenados por precio.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        planes = Plan.objects.filter(activo=True).order_by('precio_mensual')
        return Response(PlanPublicoSerializer(planes, many=True).data)


class SuperAdminMetricasView(APIView):
    """Métricas globales del sistema para el SuperAdmin.

    Endpoint: GET /empresas/superadmin/metricas/
    Acceso:   Solo Superusuario.

    Devuelve:
    - total_empresas, empresas_activas, empresas_suspendidas
    - total_usuarios
    - empresas con su plan, estado y suscripción
    - ingresos estimados (suma de precios de planes activos)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.usuarios.models import Usuario

        if getattr(request.user, 'tipo_usuario', '') != 'Superusuario':
            return Response(
                {'detail': 'Acceso restringido al SuperAdmin.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        empresas = Empresa.objects.select_related('plan', 'suscripcion').all()

        total_empresas = empresas.count()
        empresas_activas = empresas.filter(estado='activa').count()
        empresas_suspendidas = empresas.filter(estado='suspendida').count()
        empresas_trial = empresas.filter(estado='trial').count()
        total_usuarios = Usuario.objects.exclude(tipo_usuario='Superusuario').count()

        # Ingreso mensual estimado: suma de precios de planes de empresas activas
        ingreso_estimado = sum(
            float(e.plan.precio_mensual)
            for e in empresas.filter(estado='activa')
            if e.plan and e.plan.precio_mensual
        )

        lista_empresas = []
        for e in empresas.order_by('-fecha_creacion'):
            sus = getattr(e, 'suscripcion', None)
            lista_empresas.append({
                'id': e.id,
                'nombre': e.nombre,
                'email_contacto': e.email_contacto,
                'estado': e.estado,
                'plan': e.plan.nombre if e.plan else 'Sin plan',
                'precio_mensual': float(e.plan.precio_mensual) if e.plan else 0,
                'fecha_creacion': e.fecha_creacion,
                'suscripcion_estado': sus.estado if sus else None,
                'proximo_cobro': sus.fecha_proximo_cobro if sus else None,
                'usuarios_count': Usuario.objects.filter(empresa=e).count(),
            })

        return Response({
            'resumen': {
                'total_empresas': total_empresas,
                'empresas_activas': empresas_activas,
                'empresas_suspendidas': empresas_suspendidas,
                'empresas_trial': empresas_trial,
                'total_usuarios': total_usuarios,
                'ingreso_mensual_estimado': round(ingreso_estimado, 2),
            },
            'empresas': lista_empresas,
        }, status=status.HTTP_200_OK)


class SuperAdminClienteView(APIView):
    """Alta de nueva empresa + primer administrador.

    Endpoint: POST /empresas/superadmin/clientes/
    Acceso:   Solo Superusuario.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _solo_superadmin(request):
            return Response({'detail': 'Acceso restringido al SuperAdmin.'},
                            status=status.HTTP_403_FORBIDDEN)

        from apps.usuarios.models import Usuario, Rol

        nombre = request.data.get('nombre', '').strip()
        email_contacto = request.data.get('email_contacto', '').strip()
        plan_id = request.data.get('plan_id')
        estado = request.data.get('estado', 'trial')
        admin_usuario = request.data.get('admin_usuario', '').strip()
        admin_email = request.data.get('admin_email', '').strip()
        admin_password = request.data.get('admin_password', '').strip()

        errores = {}
        if not nombre:
            errores['nombre'] = 'Requerido.'
        if not email_contacto:
            errores['email_contacto'] = 'Requerido.'
        if not admin_usuario:
            errores['admin_usuario'] = 'Requerido.'
        if not admin_email:
            errores['admin_email'] = 'Requerido.'
        if not admin_password or len(admin_password) < 6:
            errores['admin_password'] = 'Mínimo 6 caracteres.'
        if Empresa.objects.filter(email_contacto=email_contacto).exists():
            errores['email_contacto'] = 'Ya existe una empresa con ese email.'
        if Usuario.objects.filter(nom_usuario=admin_usuario).exists():
            errores['admin_usuario'] = 'Ese nombre de usuario ya está en uso.'
        if errores:
            return Response(errores, status=status.HTTP_400_BAD_REQUEST)

        plan = Plan.objects.filter(pk=plan_id).first() if plan_id else None
        empresa = Empresa.objects.create(
            nombre=nombre,
            email_contacto=email_contacto,
            plan=plan,
            estado=estado,
        )

        admin = Usuario.objects.create(
            nom_usuario=admin_usuario,
            email=admin_email,
            password=make_password(admin_password),
            tipo_usuario='Administrador',
            estado='Activo',
            empresa=empresa,
        )

        try:
            rol_admin = Rol.objects.filter(nombre='Administrador').first()
            if rol_admin:
                with connection.cursor() as c:
                    c.execute(
                        'INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (%s, %s) ON CONFLICT DO NOTHING',
                        [admin.id, rol_admin.id_rol],
                    )
        except Exception:
            pass

        return Response({
            'mensaje': 'Empresa y administrador creados correctamente.',
            'empresa': {
                'id': empresa.id,
                'nombre': empresa.nombre,
                'email_contacto': empresa.email_contacto,
                'estado': empresa.estado,
                'plan': plan.nombre if plan else None,
            },
            'admin': {
                'id': admin.id,
                'nom_usuario': admin.nom_usuario,
                'email': admin.email,
            },
        }, status=status.HTTP_201_CREATED)


class SuperAdminInfraView(APIView):
    """Métricas de infraestructura y seguridad (simuladas lógicamente).

    Endpoint: GET /empresas/superadmin/infraestructura/
    Acceso:   Solo Superusuario.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _solo_superadmin(request):
            return Response({'detail': 'Acceso restringido al SuperAdmin.'},
                            status=status.HTTP_403_FORBIDDEN)

        from apps.bitacora.models import BitacoraEvento
        from apps.temperatura.models import TemperaturaGalpon
        import json

        # Métricas de servidor simuladas con seed por minuto (estables en el mismo minuto)
        seed = datetime.now(dt_tz.utc).minute
        random.seed(seed)
        cpu = round(random.uniform(18, 45), 1)
        ram_total = 8192
        ram_usado = round(random.uniform(2800, 5200))
        ram_pct = round((ram_usado / ram_total) * 100, 1)
        disco_total = 50
        disco_usado = round(random.uniform(12, 28), 1)
        disco_pct = round((disco_usado / disco_total) * 100, 1)
        random.seed()

        # Estado de la base de datos
        total_temp = TemperaturaGalpon.objects.count()
        hace_7_dias = timezone.now() - timedelta(days=7)
        temp_semana = TemperaturaGalpon.objects.filter(fecha_hora__gte=hace_7_dias).count()

        crecimiento_diario = []
        for i in range(6, -1, -1):
            dia = timezone.now() - timedelta(days=i)
            dia_inicio = dia.replace(hour=0, minute=0, second=0, microsecond=0)
            dia_fin = dia_inicio + timedelta(days=1)
            count = TemperaturaGalpon.objects.filter(
                fecha_hora__gte=dia_inicio,
                fecha_hora__lt=dia_fin,
            ).count()
            crecimiento_diario.append({
                'fecha': dia_inicio.strftime('%d/%m'),
                'registros': count,
            })

        # Logs de seguridad: eventos de login de la bitácora
        eventos_login = BitacoraEvento.objects.filter(
            accion__in=['login', 'login_fallido', 'logout']
        ).order_by('-fecha_hora')[:50]

        logs_seguridad = []
        for ev in eventos_login:
            try:
                desc = json.loads(ev.descripcion or '{}')
            except Exception:
                desc = {}
            http_info = desc.get('http', {}) or {}
            logs_seguridad.append({
                'id': ev.id,
                'fecha_hora': ev.fecha_hora,
                'accion': ev.accion,
                'usuario': ev.usuario.nom_usuario if ev.usuario else 'Anónimo',
                'ip': http_info.get('ip', '—'),
                'user_agent': (http_info.get('user_agent') or '—')[:80],
                'sospechoso': ev.accion == 'login_fallido',
            })

        hace_24h = timezone.now() - timedelta(hours=24)
        fallidos_24h = BitacoraEvento.objects.filter(
            accion='login_fallido',
            fecha_hora__gte=hace_24h,
        ).count()

        return Response({
            'servidor': {
                'cpu_pct': cpu,
                'ram_usado_mb': ram_usado,
                'ram_total_mb': ram_total,
                'ram_pct': ram_pct,
                'disco_usado_gb': disco_usado,
                'disco_total_gb': disco_total,
                'disco_pct': disco_pct,
                'uptime_dias': 47,
                'estado': 'operativo',
            },
            'base_datos': {
                'total_registros_temperatura': total_temp,
                'registros_ultima_semana': temp_semana,
                'crecimiento_diario': crecimiento_diario,
                'alerta_volumen': total_temp > 100000,
            },
            'seguridad': {
                'fallidos_24h': fallidos_24h,
                'logs': logs_seguridad,
            },
        }, status=status.HTTP_200_OK)


class SuperAdminBitacoraView(APIView):
    """Bitácora global filtrable por empresa.

    Endpoint: GET /empresas/superadmin/bitacora/?empresa_id=1&limit=100
    Acceso:   Solo Superusuario.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _solo_superadmin(request):
            return Response({'detail': 'Acceso restringido al SuperAdmin.'},
                            status=status.HTTP_403_FORBIDDEN)

        from apps.bitacora.models import BitacoraEvento
        import json

        empresa_id = request.query_params.get('empresa_id')
        limit = min(int(request.query_params.get('limit', 100)), 200)

        qs = BitacoraEvento.objects.select_related('usuario', 'empresa').order_by('-fecha_hora')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)

        qs = qs[:limit]

        resultado = []
        for ev in qs:
            try:
                desc = json.loads(ev.descripcion or '{}')
            except Exception:
                desc = {}
            resultado.append({
                'id': ev.id,
                'fecha_hora': ev.fecha_hora,
                'accion': ev.accion,
                'usuario': ev.usuario.nom_usuario if ev.usuario else 'Sistema',
                'empresa': ev.empresa.nombre if ev.empresa else '—',
                'empresa_id': ev.empresa_id,
                'modulo': desc.get('modulo', '—'),
                'entidad': desc.get('entidad', '—'),
                'detalle': desc.get('detalle'),
                'ip': (desc.get('http') or {}).get('ip', '—'),
            })

        return Response(resultado, status=status.HTTP_200_OK)


class SuperAdminConfigIAView(APIView):
    """Diccionario global de estados de temperatura (IA/ML).

    Endpoint:
      GET  /empresas/superadmin/config-ia/
      POST /empresas/superadmin/config-ia/
    Acceso: Solo Superusuario.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _solo_superadmin(request):
            return Response({'detail': 'Acceso restringido al SuperAdmin.'},
                            status=status.HTTP_403_FORBIDDEN)
        return Response({
            'frio_max': _CONFIG_IA['frio_max'],
            'calor_min': _CONFIG_IA['calor_min'],
            'descripcion': {
                'FRIO': f'Temperatura < {_CONFIG_IA["frio_max"]}°C',
                'NORMAL': f'{_CONFIG_IA["frio_max"]}°C a {_CONFIG_IA["calor_min"]}°C',
                'CALOR': f'Temperatura > {_CONFIG_IA["calor_min"]}°C',
            },
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if not _solo_superadmin(request):
            return Response({'detail': 'Acceso restringido al SuperAdmin.'},
                            status=status.HTTP_403_FORBIDDEN)

        errores = {}
        try:
            frio_max = float(request.data.get('frio_max'))
        except (TypeError, ValueError):
            errores['frio_max'] = 'Debe ser un número.'
            frio_max = None

        try:
            calor_min = float(request.data.get('calor_min'))
        except (TypeError, ValueError):
            errores['calor_min'] = 'Debe ser un número.'
            calor_min = None

        if not errores and frio_max >= calor_min:
            errores['frio_max'] = 'frio_max debe ser menor que calor_min.'

        if errores:
            return Response(errores, status=status.HTTP_400_BAD_REQUEST)

        _CONFIG_IA['frio_max'] = frio_max
        _CONFIG_IA['calor_min'] = calor_min

        return Response({
            'mensaje': 'Configuración actualizada correctamente.',
            'frio_max': _CONFIG_IA['frio_max'],
            'calor_min': _CONFIG_IA['calor_min'],
        }, status=status.HTTP_200_OK)
