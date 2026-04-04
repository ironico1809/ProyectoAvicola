
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.usuarios.models import Usuario
from apps.usuarios.serializers import (
    LoginSerializer,
    RegistroUsuarioSerializer,
    UsuarioSerializer,
    UsuarioUpdateSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['nom_usuario']
            password = serializer.validated_data['password']
            try:
                usuario = Usuario.objects.get(nom_usuario=username)
                if usuario.check_password(password):
                    # Crear token JWT
                    refresh = RefreshToken.for_user(usuario)
                    return Response({
                        'refresh': str(refresh),
                        'access': str(refresh.access_token),
                        'usuario': UsuarioSerializer(usuario).data,
                        'mensaje': 'Login correcto'
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({'error': 'Contraseña incorrecta'}, status=status.HTTP_400_BAD_REQUEST)
            except Usuario.DoesNotExist:
                return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegistroUsuarioView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistroUsuarioSerializer(data=request.data)
        if serializer.is_valid():
            usuario = serializer.save()
            return Response(
                {
                    'mensaje': 'Usuario creado correctamente',
                    'usuario': UsuarioSerializer(usuario).data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UsuarioMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UsuarioSerializer(request.user).data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UsuarioUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            usuario = serializer.save()
            return Response(UsuarioSerializer(usuario).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """Con JWT, el logout real se hace borrando el token en el cliente.

    Este endpoint existe para CU02 y opcionalmente puede invalidar un refresh token
    si en el futuro se habilita blacklist.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                # Requiere tener instalado 'rest_framework_simplejwt.token_blacklist'
                token.blacklist()
            except Exception:
                # Si no hay blacklist o token inválido, igual respondemos ok
                pass

        return Response({'mensaje': 'Logout correcto'}, status=status.HTTP_200_OK)

        