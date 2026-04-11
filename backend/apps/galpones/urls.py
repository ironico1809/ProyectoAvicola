from django.urls import path

from apps.galpones.views import GalponDetailView, GalponEstadoListView, GalponListCreateView

urlpatterns = [
    path('', GalponListCreateView.as_view(), name='galpones_list_create'),
    path('estado/', GalponEstadoListView.as_view(), name='galpones_estado'),
    path('<int:galpon_id>/', GalponDetailView.as_view(), name='galpones_detail'),
]
