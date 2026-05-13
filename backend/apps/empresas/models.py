"""Modelos del core SaaS: Plan, Empresa y Suscripcion.

Estos tres modelos son el eje del sistema multi-tenant:
- Plan       → qué producto se vende (Básico / Premium).
- Empresa    → cada cliente que compra (tenant).
- Suscripcion → el vínculo activo entre Empresa y Stripe.
"""

from django.db import models


class Plan(models.Model):
    """Plan de suscripción disponible en la landing page.

    Campos:
    - nombre           : etiqueta visible ("Plan Básico", "Plan Premium").
    - precio_mensual   : precio en USD mostrado en la UI.
    - stripe_price_id  : ID del Price en Stripe (price_XXXX). Se usa al
                         crear la Checkout Session.
    - max_galpones     : límite de galpones. NULL = ilimitado.
    - max_usuarios     : límite de usuarios por empresa.
    - activo           : si aparece en la landing.
    """

    nombre = models.CharField(max_length=100)
    precio_mensual = models.DecimalField(max_digits=8, decimal_places=2)
    stripe_price_id = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text='ID del Price en Stripe (price_XXXX). Requerido para Checkout.',
    )
    max_galpones = models.IntegerField(
        null=True,
        blank=True,
        help_text='Límite de galpones. Null = ilimitado.',
    )
    max_usuarios = models.IntegerField(
        default=5,
        help_text='Límite de usuarios por empresa.',
    )
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'plan'
        ordering = ['precio_mensual']

    def __str__(self):
        return f'{self.nombre} (${self.precio_mensual}/mes)'


class Empresa(models.Model):
    """Tenant del sistema. Cada empresa tiene sus propios datos aislados.

    Al activarse una suscripción via Stripe, el webhook crea
    automáticamente una instancia de Empresa.

    Estados:
    - trial      : período gratuito de prueba.
    - activa     : suscripción pagada y vigente.
    - suspendida : pago fallido o suscripción cancelada.
    """

    ESTADO_CHOICES = [
        ('trial', 'Trial'),
        ('activa', 'Activa'),
        ('suspendida', 'Suspendida'),
    ]

    nombre = models.CharField(max_length=200)
    email_contacto = models.EmailField(max_length=255, unique=True)
    plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='empresas',
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default='activa',
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'empresa'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f'{self.nombre} [{self.estado}]'


class Suscripcion(models.Model):
    """Vínculo entre Empresa y Stripe.

    Se crea cuando el webhook `checkout.session.completed` confirma el pago.
    Se actualiza con los eventos posteriores de Stripe
    (renovación, cancelación, pago fallido).

    Campos Stripe:
    - stripe_customer_id       : ID del Customer en Stripe (cus_XXXX).
    - stripe_subscription_id   : ID de la Subscription (sub_XXXX).
    - estado                   : espejo del estado en Stripe.
    - fecha_proximo_cobro      : próxima fecha de facturación.
    """

    ESTADO_STRIPE_CHOICES = [
        ('active', 'Activa'),
        ('past_due', 'Pago vencido'),
        ('canceled', 'Cancelada'),
        ('trialing', 'En prueba'),
        ('incomplete', 'Incompleta'),
    ]

    empresa = models.OneToOneField(
        Empresa,
        on_delete=models.CASCADE,
        related_name='suscripcion',
    )
    stripe_customer_id = models.CharField(max_length=200, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=200, blank=True, null=True)
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_STRIPE_CHOICES,
        default='active',
    )
    fecha_inicio = models.DateTimeField(null=True, blank=True)
    fecha_proximo_cobro = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'suscripcion'

    def __str__(self):
        return f'Suscripción de {self.empresa.nombre} [{self.estado}]'
