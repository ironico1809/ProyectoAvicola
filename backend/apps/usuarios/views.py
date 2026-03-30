from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from apps.usuarios.models import Usuario
from apps.usuarios.serializers import LoginSerializer

def get_tokens_for_user(usuario):
    refresh = RefreshToken.for_user(usuario)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['nom_usuario']
            password = serializer.validated_data['password']
            try:
                usuario = Usuario.objects.get(nom_usuario=username)
                if not usuario.check_password(password):
                    return Response({'error': 'Contraseña incorrecta'}, status=status.HTTP_400_BAD_REQUEST)
                tokens = get_tokens_for_user(usuario)
                return Response({
                    'access': tokens['access'],
                    'refresh': tokens['refresh'],
                    'usuario': {
                        'id': usuario.id,
                        'nom_usuario': usuario.nom_usuario,
                        'tipo_usuario': usuario.tipo_usuario,
                    }
                }, status=status.HTTP_200_OK)
            except Usuario.DoesNotExist:
                return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)