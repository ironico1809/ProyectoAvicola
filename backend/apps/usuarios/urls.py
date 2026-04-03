from django.urls import path
from apps.usuarios.views import LoginView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('registro/',RegistroUsuarioView.as_view(), name='registro_usuario'),
]