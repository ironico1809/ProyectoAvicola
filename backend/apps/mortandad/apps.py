from django.apps import AppConfig

class MortandadConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # Solo agregamos "apps." al inicio del nombre
    name = 'apps.mortandad'