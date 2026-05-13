"""Vistas públicas de la app empresas.

PlanesListView: endpoint público que lista los planes activos.
Será consumido por la landing page de React (/pricing).
No requiere autenticación.
"""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.empresas.models import Plan
from apps.empresas.serializers import PlanPublicoSerializer


class PlanesListView(APIView):
    """Lista los planes de suscripción activos.

    Endpoint: GET /empresas/planes/
    Acceso:   Público (sin token).
    Salida:   Array de planes ordenados por precio.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        planes = Plan.objects.filter(activo=True).order_by('precio_mensual')
        return Response(PlanPublicoSerializer(planes, many=True).data)
