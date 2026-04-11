from django.urls import path

from apps.lotes.views import LoteDetailView, LoteListCreateView, LotesResumenEstadoView

urlpatterns = [
    path('', LoteListCreateView.as_view(), name='lotes_list_create'),
    path('resumen/estados/', LotesResumenEstadoView.as_view(), name='lotes_resumen_estados'),
    path('<int:id_lote>/', LoteDetailView.as_view(), name='lotes_detail'),
]
