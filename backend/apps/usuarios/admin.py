from django.contrib import admin

from apps.usuarios.models import Rol, Usuario


# Permite gestionar usuarios y permisos desde /admin mientras construyes el frontend.
@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
	list_display = ('id', 'nom_usuario', 'email', 'tipo_usuario', 'estado')
	search_fields = ('nom_usuario', 'email')


@admin.register(Rol)
class RolAdmin(admin.ModelAdmin):
	list_display = ('id_rol', 'nombre')
	search_fields = ('nombre',)


