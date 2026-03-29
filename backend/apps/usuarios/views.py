from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.usuarios.models import Usuario
from apps.usuarios.serializers import LoginSerializer

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['nom_usuario']
            password = serializer.validated_data['password']
            try:
                usuario = Usuario.objects.get(nom_usuario=username)
                if usuario.check_password(password):
                    return Response({'mensaje': 'Login correcto'}, status=status.HTTP_200_OK)
                else:
                    return Response({'error': 'Contraseña incorrecta'}, status=status.HTTP_400_BAD_REQUEST)
            except Usuario.DoesNotExist:
                return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)