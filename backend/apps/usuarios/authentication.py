from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings

from apps.usuarios.models import Usuario


class UsuarioJWTAuthentication(JWTAuthentication):
    """Autenticación JWT para el modelo Usuario (no AUTH_USER_MODEL)."""

    def get_user(self, validated_token):
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError as exc:
            raise InvalidToken('Token sin identificador de usuario') from exc

        try:
            usuario = Usuario.objects.get(pk=user_id)
        except Usuario.DoesNotExist as exc:
            raise AuthenticationFailed('Usuario no encontrado', code='user_not_found') from exc

        return usuario
