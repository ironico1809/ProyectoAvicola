from django.db import connection

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.usuarios.models import Rol, Usuario
from bitacora.utils import registrar_evento
from apps.usuarios.serializers import (
    LoginSerializer,
    RegistroUsuarioSerializer,
    RolSerializer,
    UsuarioRolesReplaceSerializer,
    UsuarioRolesSerializer,
    UsuarioSerializer,
    UsuarioUpdateSerializer,
)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data['nom_usuario']
        password = serializer.validated_data['password']

        try:
            usuario = Usuario.objects.get(nom_usuario=username)
        except Usuario.DoesNotExist:
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if not usuario.check_password(password):
            return Response({'error': 'Contraseña incorrecta'}, status=status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(usuario)

        registrar_evento(
            request,
            accion='login',
            modulo='auth',
            entidad='Usuario',
            entidad_id=usuario.id,
            usuario=usuario,
        )
        return Response(
            {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'usuario': UsuarioSerializer(usuario).data,
                'mensaje': 'Login correcto',
            },
            status=status.HTTP_200_OK,
        )


class RegistroUsuarioView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistroUsuarioSerializer(data=request.data)
        if serializer.is_valid():
            usuario = serializer.save()

            registrar_evento(
                request,
                accion='crear',
                modulo='usuarios',
                entidad='Usuario',
                entidad_id=usuario.id,
                detalle={'nom_usuario': usuario.nom_usuario},
                usuario=getattr(request, 'user', None) if getattr(getattr(request, 'user', None), 'is_authenticated', False) else None,
            )
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

            registrar_evento(
                request,
                accion='editar',
                modulo='usuarios',
                entidad='Usuario',
                entidad_id=usuario.id,
                usuario=request.user,
            )
            return Response(UsuarioSerializer(usuario).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """Con JWT, el logout real se hace borrando el token en el cliente."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        registrar_evento(
            request,
            accion='logout',
            modulo='auth',
            entidad='Usuario',
            entidad_id=getattr(request.user, 'id', None),
            usuario=request.user,
        )

        return Response({'mensaje': 'Logout correcto'}, status=status.HTTP_200_OK)


class UsuarioListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        usuarios = Usuario.objects.all().order_by('id')
        return Response(UsuarioSerializer(usuarios, many=True).data, status=status.HTTP_200_OK)


class UsuarioDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_usuario_or_404(self, usuario_id):
        try:
            return Usuario.objects.get(pk=usuario_id)
        except Usuario.DoesNotExist:
            return None

    def get(self, request, usuario_id):
        usuario = self._get_usuario_or_404(usuario_id)
        if not usuario:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(UsuarioSerializer(usuario).data, status=status.HTTP_200_OK)

    def patch(self, request, usuario_id):
        usuario = self._get_usuario_or_404(usuario_id)
        if not usuario:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UsuarioUpdateSerializer(usuario, data=request.data, partial=True)
        if serializer.is_valid():
            usuario_actualizado = serializer.save()

            registrar_evento(
                request,
                accion='editar',
                modulo='usuarios',
                entidad='Usuario',
                entidad_id=usuario_actualizado.id,
                usuario=request.user,
            )
            return Response(UsuarioSerializer(usuario_actualizado).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, usuario_id):
        usuario = self._get_usuario_or_404(usuario_id)
        if not usuario:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        registrar_evento(
            request,
            accion='eliminar',
            modulo='usuarios',
            entidad='Usuario',
            entidad_id=usuario.id,
            detalle={'nom_usuario': usuario.nom_usuario},
            usuario=request.user,
        )
        usuario.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RolListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = Rol.objects.all().order_by('id_rol')
        return Response(RolSerializer(roles, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = RolSerializer(data=request.data)
        if serializer.is_valid():
            rol = serializer.save()

            registrar_evento(
                request,
                accion='crear',
                modulo='roles',
                entidad='Rol',
                entidad_id=rol.id_rol,
                detalle={'nombre': rol.nombre},
                usuario=request.user,
            )
            return Response(RolSerializer(rol).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RolDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_rol_or_404(self, id_rol):
        try:
            return Rol.objects.get(pk=id_rol)
        except Rol.DoesNotExist:
            return None

    def get(self, request, id_rol):
        rol = self._get_rol_or_404(id_rol)
        if not rol:
            return Response({'detail': 'Rol no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(RolSerializer(rol).data, status=status.HTTP_200_OK)

    def patch(self, request, id_rol):
        rol = self._get_rol_or_404(id_rol)
        if not rol:
            return Response({'detail': 'Rol no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RolSerializer(rol, data=request.data, partial=True)
        if serializer.is_valid():
            rol = serializer.save()

            registrar_evento(
                request,
                accion='editar',
                modulo='roles',
                entidad='Rol',
                entidad_id=rol.id_rol,
                usuario=request.user,
            )
            return Response(RolSerializer(rol).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id_rol):
        rol = self._get_rol_or_404(id_rol)
        if not rol:
            return Response({'detail': 'Rol no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        registrar_evento(
            request,
            accion='eliminar',
            modulo='roles',
            entidad='Rol',
            entidad_id=rol.id_rol,
            detalle={'nombre': rol.nombre},
            usuario=request.user,
        )
        rol.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UsuarioRolesView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_usuario_or_404(self, usuario_id):
        try:
            return Usuario.objects.get(pk=usuario_id)
        except Usuario.DoesNotExist:
            return None

    def get(self, request, usuario_id):
        usuario = self._get_usuario_or_404(usuario_id)
        if not usuario:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT r.id_rol, r.nombre, r.descripcion
                FROM rol r
                INNER JOIN usuario_roles ur ON ur.rol_id = r.id_rol
                WHERE ur.usuario_id = %s
                ORDER BY r.id_rol
                """,
                [usuario.id],
            )
            rows = cursor.fetchall()

        data = [{'id_rol': r[0], 'nombre': r[1], 'descripcion': r[2]} for r in rows]
        return Response(data, status=status.HTTP_200_OK)

    def put(self, request, usuario_id):
        usuario = self._get_usuario_or_404(usuario_id)
        if not usuario:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UsuarioRolesReplaceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ids = list(dict.fromkeys(serializer.validated_data['roles']))
        roles = list(Rol.objects.filter(id_rol__in=ids))
        encontrados = {r.id_rol for r in roles}
        faltantes = [i for i in ids if i not in encontrados]
        if faltantes:
            return Response(
                {'detail': 'Roles no encontrados.', 'faltantes': faltantes},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with connection.cursor() as cursor:
            cursor.execute('DELETE FROM usuario_roles WHERE usuario_id = %s', [usuario.id])
            for rol in roles:
                cursor.execute(
                    'INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (%s, %s)',
                    [usuario.id, rol.id_rol],
                )

        registrar_evento(
            request,
            accion='asignar_roles',
            modulo='usuarios',
            entidad='Usuario',
            entidad_id=usuario.id,
            detalle={'modo': 'replace', 'roles': ids},
            usuario=request.user,
        )

        roles_actuales = Rol.objects.filter(id_rol__in=ids).order_by('id_rol')
        return Response(RolSerializer(roles_actuales, many=True).data, status=status.HTTP_200_OK)

    def patch(self, request, usuario_id):
        usuario = self._get_usuario_or_404(usuario_id)
        if not usuario:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UsuarioRolesSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        add_ids = list(dict.fromkeys(serializer.validated_data.get('add', [])))
        remove_ids = list(dict.fromkeys(serializer.validated_data.get('remove', [])))

        add_roles = list(Rol.objects.filter(id_rol__in=add_ids))
        remove_roles = list(Rol.objects.filter(id_rol__in=remove_ids))

        add_encontrados = {r.id_rol for r in add_roles}
        remove_encontrados = {r.id_rol for r in remove_roles}
        faltantes = {
            'add': [i for i in add_ids if i not in add_encontrados],
            'remove': [i for i in remove_ids if i not in remove_encontrados],
        }
        if faltantes['add'] or faltantes['remove']:
            return Response(
                {'detail': 'Hay roles no encontrados.', 'faltantes': faltantes},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with connection.cursor() as cursor:
            for rol in add_roles:
                cursor.execute(
                    'INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (%s, %s) ON CONFLICT DO NOTHING',
                    [usuario.id, rol.id_rol],
                )

            if remove_ids:
                cursor.execute(
                    'DELETE FROM usuario_roles WHERE usuario_id = %s AND rol_id = ANY(%s)',
                    [usuario.id, remove_ids],
                )

            cursor.execute('SELECT rol_id FROM usuario_roles WHERE usuario_id = %s', [usuario.id])
            ids_actuales = [r[0] for r in cursor.fetchall()]

        registrar_evento(
            request,
            accion='asignar_roles',
            modulo='usuarios',
            entidad='Usuario',
            entidad_id=usuario.id,
            detalle={'modo': 'patch', 'add': add_ids, 'remove': remove_ids},
            usuario=request.user,
        )

        roles_actuales = Rol.objects.filter(id_rol__in=ids_actuales).order_by('id_rol')
        return Response(RolSerializer(roles_actuales, many=True).data, status=status.HTTP_200_OK)
