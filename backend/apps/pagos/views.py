"""Vistas de la app pagos para la integración SaaS con Stripe.

Endpoints:
- GET /pagos/planes/       : Lista los planes activos disponibles.
- POST /pagos/crear-sesion/ : Crea una sesión de Checkout en Stripe.
- POST /pagos/webhook/      : Recibe eventos de Stripe (suscripción pagada).
"""

import json
import random
import string
import stripe
from django.conf import settings
from django.core.mail import send_mail
from django.db import connection, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.empresas.models import Empresa, Plan, Suscripcion
from apps.empresas.serializers import PlanPublicoSerializer
from apps.usuarios.models import Rol, Usuario


class PlanesListView(APIView):
    """Lista los planes de suscripción activos.

    Endpoint: GET /pagos/planes/
    Acceso:   Público (sin token).
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        planes = Plan.objects.filter(activo=True).order_by('precio_mensual') # type: ignore
        return Response(PlanPublicoSerializer(planes, many=True).data)


class CrearSesionCheckoutView(APIView):
    """Genera la URL de Stripe Checkout para iniciar la compra de un plan.

    Endpoint: POST /pagos/crear-sesion/
    Acceso:   Público.
    Payload esperado:
    - plan_id        : ID del Plan.
    - email          : Correo del cliente (será el usuario admin).
    - nombre_empresa : Nombre de la nueva empresa/granja.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        plan_id = request.data.get('plan_id')
        email = request.data.get('email')
        nombre_empresa = request.data.get('nombre_empresa')

        if not plan_id or not email or not nombre_empresa:
            return Response(
                {'detail': 'Faltan parámetros requeridos (plan_id, email, nombre_empresa).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            plan = Plan.objects.get(pk=plan_id, activo=True) # type: ignore
        except Plan.DoesNotExist: # type: ignore
            return Response(
                {'detail': 'El plan seleccionado no existe o no está activo.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not plan.stripe_price_id:
            return Response(
                {'detail': 'El plan no tiene configurado el ID de precio en Stripe.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY # type: ignore

        try:
            session = stripe.checkout.Session.create( # type: ignore
                payment_method_types=['card'],
                line_items=[
                    {
                        'price': plan.stripe_price_id,
                        'quantity': 1,
                    },
                ],
                mode='subscription',
                success_url=str(settings.STRIPE_SUCCESS_URL) + "?session_id={CHECKOUT_SESSION_ID}", # type: ignore
                cancel_url=str(settings.STRIPE_CANCEL_URL), # type: ignore
                customer_email=email,
                metadata={
                    'plan_id': str(plan.id),
                    'nombre_empresa': str(nombre_empresa),
                    'email_contacto': str(email),
                },
            )
            return Response({'url': session.url}) # type: ignore
        except Exception as e:
            return Response(
                {'detail': f'Error al comunicar con Stripe: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class StripeWebhookView(APIView):
    """Escucha eventos automáticos enviados por Stripe.

    Endpoint: POST /pagos/webhook/
    Acceso:   Público (se valida la firma criptográfica de Stripe).
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.body
        sig_header = request.headers.get('Stripe-Signature')
        endpoint_secret = settings.STRIPE_WEBHOOK_SECRET # type: ignore

        if not sig_header or not endpoint_secret:
            return Response(
                {'detail': 'Configuración de webhook incompleta o firma ausente.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY # type: ignore

        try:
            event = stripe.Webhook.construct_event( # type: ignore
                payload, sig_header, endpoint_secret
            )
        except ValueError:
            # Payload inválido
            return Response(status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.SignatureVerificationError: # type: ignore
            # Firma inválida
            return Response(status=status.HTTP_400_BAD_REQUEST)

        # Procesar el evento de completado exitosamente
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            self._procesar_suscripcion_exitosa(session)

        return Response(status=status.HTTP_200_OK)

    def _procesar_suscripcion_exitosa(self, session):
        # Acceso seguro a las propiedades del StripeObject usando getattr()
        metadata = getattr(session, 'metadata', {}) or {}
        
        # Soportamos tanto acceso por atributo como por diccionario para los metadatos
        plan_id = getattr(metadata, 'plan_id', None) or (metadata.get('plan_id') if hasattr(metadata, 'get') else None) # type: ignore
        nombre_empresa = getattr(metadata, 'nombre_empresa', None) or (metadata.get('nombre_empresa') if hasattr(metadata, 'get') else None) # type: ignore
        email_contacto = getattr(metadata, 'email_contacto', None) or (metadata.get('email_contacto') if hasattr(metadata, 'get') else None) # type: ignore

        if not plan_id or not nombre_empresa or not email_contacto:
            return

        customer_id = getattr(session, 'customer', None)
        subscription_id = getattr(session, 'subscription', None)

        try:
            plan = Plan.objects.get(pk=plan_id) # type: ignore
        except Plan.DoesNotExist: # type: ignore
            return

        # Evitar procesar duplicados si el webhook se reintenta
        if Empresa.objects.filter(email_contacto=email_contacto).exists(): # type: ignore
            return

        with transaction.atomic():
            # 1. Crear Empresa
            empresa = Empresa.objects.create( # type: ignore
                nombre=nombre_empresa,
                email_contacto=email_contacto,
                plan=plan,
                estado='activa',
            )

            # 2. Crear Suscripcion
            Suscripcion.objects.create( # type: ignore
                empresa=empresa,
                stripe_customer_id=customer_id,
                stripe_subscription_id=subscription_id,
                estado='active',
                fecha_inicio=timezone.now(),
            )

            # 3. Crear Usuario Administrador
            # Generar contraseña temporal segura de 12 caracteres
            caracteres = string.ascii_letters + string.digits + "!@#$%^&*"
            password_temporal = ''.join(random.choice(caracteres) for _ in range(12))

            # Asegurar que el nombre de usuario sea único
            base_username = email_contacto.split('@')[0]
            username = base_username
            contador = 1
            while Usuario.objects.filter(nom_usuario=username).exists(): # type: ignore
                username = f"{base_username}{contador}"
                contador += 1

            usuario = Usuario(
                nom_usuario=username,
                email=email_contacto,
                tipo_usuario='Administrador',
                estado='Activo',
                empresa=empresa,
                must_change_password=True,
            )
            usuario.set_password(password_temporal) # type: ignore

            # Asignar rol de Administrador si existe en la BD
            rol_admin = Rol.objects.filter(nombre__icontains='Admin').first() # type: ignore
            if rol_admin and usuario.id: # type: ignore
                with connection.cursor() as cursor:
                    cursor.execute( # type: ignore
                        'INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (%s, %s) ON CONFLICT DO NOTHING',
                        [usuario.id, rol_admin.id_rol], # type: ignore
                    )

        # 4. Enviar correo de bienvenida con credenciales
        asunto = f"Bienvenido a AviGranja SaaS - Acceso para {empresa.nombre}"
        mensaje = f"""Hola,

Tu suscripción al {plan.nombre} ha sido confirmada exitosamente.
Se ha creado tu entorno aislado de granja avícola.

Aquí tienes tus credenciales de acceso iniciales:
- Empresa: {empresa.nombre}
- Usuario / Email: {usuario.email}
- Contraseña temporal: {password_temporal}

URL de Acceso: https://app.avigranja.com/login

IMPORTANTE: Por seguridad, el sistema te pedirá cambiar esta contraseña obligatoriamente en tu primer inicio de sesión.

¡Gracias por confiar en AviGranja!
"""
        send_mail( # type: ignore
            asunto,
            mensaje,
            settings.DEFAULT_FROM_EMAIL, # type: ignore
            [email_contacto],
            fail_silently=True,
        )
