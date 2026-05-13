"""Admin de la app empresas.

Registra Plan, Empresa y Suscripcion para gestión
desde el panel Django Admin (/admin/).
"""

from django.contrib import admin # type: ignore

from apps.empresas.models import Empresa, Plan, Suscripcion


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'precio_mensual', 'max_galpones', 'max_usuarios', 'activo'] # type: ignore
    list_editable = ['activo'] # type: ignore
    search_fields = ['nombre'] # type: ignore


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    # 'plan' es una FK — no se usa directamente en list_display porque
    # los type-checkers la ven como un descriptor ForeignKey, no como un
    # campo escalar. Se reemplaza por un método callable (@admin.display).
    list_display = ['nombre', 'email_contacto', 'get_plan_nombre', 'estado', 'fecha_creacion'] # type: ignore
    list_filter = ['estado', 'plan'] # type: ignore
    search_fields = ['nombre', 'email_contacto'] # type: ignore

    @admin.display(description='Plan', ordering='plan__nombre')
    def get_plan_nombre(self, obj: Empresa) -> str:
        """Devuelve el nombre del plan o '—' si la empresa no tiene plan asignado."""
        return str(obj.plan.nombre) if obj.plan else '—'


@admin.register(Suscripcion)
class SuscripcionAdmin(admin.ModelAdmin):
    # 'empresa' es OneToOneField — usa get_empresa_nombre para consistencia.
    list_display = ['get_empresa_nombre', 'estado', 'stripe_customer_id', 'fecha_proximo_cobro'] # type: ignore
    list_filter = ['estado'] # type: ignore
    search_fields = ['empresa__nombre', 'stripe_customer_id', 'stripe_subscription_id'] # type: ignore

    @admin.display(description='Empresa', ordering='empresa__nombre')
    def get_empresa_nombre(self, obj: Suscripcion) -> str:
        """Devuelve el nombre de la empresa vinculada a la suscripción."""
        # obj.empresa (instancia, no _id) para que Pyright infiera el tipo correcto.
        return str(obj.empresa.nombre) if obj.empresa else '—'


