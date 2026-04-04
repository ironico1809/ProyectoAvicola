from django.urls import path

from bitacora.views import BitacoraListView

urlpatterns = [
    path('', BitacoraListView.as_view(), name='bitacora_list'),
]
