from django.urls import path

from apps.alimentacion.views import AlimentacionListCreateView, AlimentacionBulkCreateView

urlpatterns = [
    path('', AlimentacionListCreateView.as_view(),
         name='alimentacion_list_create'),
    path(
        'bulk/',
        AlimentacionBulkCreateView.as_view(),
        name='alimentacion_bulk_create'),
]
