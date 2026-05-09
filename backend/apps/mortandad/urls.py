from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegistroMortalidadViewSet

router = DefaultRouter()
router.register(r'', RegistroMortalidadViewSet, basename='mortandad')

urlpatterns = [
    path('', include(router.urls)),
]