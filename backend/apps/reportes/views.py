import csv
import io
from datetime import datetime

from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDay, TruncMonth
from django.http import HttpResponse

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.alimentacion.models import Alimentacion
from apps.bitacora.models import BitacoraEvento
from apps.lotes.models import Lote
from apps.reportes.serializers import ReporteGenerarSerializer


def _filename(base: str, ext: str) -> str:
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    return f"{base}_{ts}.{ext}"


def _rows_to_csv_bytes(rows: list[dict]) -> bytes:
    output = io.StringIO()
    if not rows:
        writer = csv.writer(output)
        writer.writerow(['sin_datos'])
        return output.getvalue().encode('utf-8')

    fieldnames = list(rows[0].keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r.get(k) for k in fieldnames})
    return output.getvalue().encode('utf-8')


def _rows_to_xlsx_bytes(rows: list[dict]) -> bytes:
    """Crea un XLSX en memoria con openpyxl."""
    try:
        from openpyxl import Workbook
    except Exception as e:  # pragma: no cover
        raise RuntimeError('openpyxl no está instalado') from e

    wb = Workbook()
    ws = wb.active
    ws.title = 'Reporte'

    if not rows:
        ws.append(['sin_datos'])
    else:
        headers = list(rows[0].keys())
        ws.append(headers)
        for r in rows:
            ws.append([r.get(h) for h in headers])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class ReporteGenerarView(APIView):
    """Motor de reportes dinámicos.

    Endpoint:
    - POST /reportes/generar/

    Entrada (JSON):
    - entidad: 'alimentacion' | 'lotes' | 'bitacora'
    - filtros: fecha_inicio, fecha_fin, galpon_ids, lote_ids, tipo_alimento, estado_lote, accion, usuario_id
    - agrupar_por: 'dia' | 'mes' | 'galpon' (opcional)
    - formato: 'json' | 'csv' | 'excel' (opcional)

    Salida:
    - JSON (default) con {rows, summary, series}
    - CSV/Excel como archivo descargable
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ReporteGenerarSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

        payload = serializer.validated_data
        entidad = payload['entidad']
        agrupar_por = payload.get('agrupar_por')
        formato = payload.get('formato', 'json')

        try:
            rows, summary, series = self._build_report(payload)
        except ValueError as e:
            return Response({'detail': str(e)},
                            status=status.HTTP_400_BAD_REQUEST)

        if formato == 'json':
            return Response(
                {
                    'entidad': entidad,
                    'agrupar_por': agrupar_por,
                    'rows': rows,
                    'summary': summary,
                    'series': series,
                },
                status=status.HTTP_200_OK,
            )

        # Exportación
        if formato == 'csv':
            content = _rows_to_csv_bytes(rows)
            resp = HttpResponse(
                content, content_type='text/csv; charset=utf-8')
            resp['Content-Disposition'] = f'attachment; filename="{
                _filename(
                    "reporte",
                    "csv")}"'
            return resp

        if formato == 'excel':
            try:
                content = _rows_to_xlsx_bytes(rows)
                resp = HttpResponse(
                    content,
                    content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                )
                resp['Content-Disposition'] = f'attachment; filename="{
                    _filename(
                        "reporte",
                        "xlsx")}"'
                return resp
            except RuntimeError:
                # Fallback: CSV compatible con Excel
                content = _rows_to_csv_bytes(rows)
                resp = HttpResponse(
                    content, content_type='application/vnd.ms-excel; charset=utf-8')
                resp['Content-Disposition'] = f'attachment; filename="{
                    _filename(
                        "reporte",
                        "csv")}"'
                return resp

        return Response({'detail': 'Formato no soportado.'},
                        status=status.HTTP_400_BAD_REQUEST)

    def _build_report(self, payload: dict):
        entidad = payload['entidad']
        fecha_inicio = payload.get('fecha_inicio')
        fecha_fin = payload.get('fecha_fin')
        galpon_ids = payload.get('galpon_ids') or []
        lote_ids = payload.get('lote_ids') or []
        agrupar_por = payload.get('agrupar_por')

        if entidad == 'alimentacion':
            return self._report_alimentacion(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                galpon_ids=galpon_ids,
                lote_ids=lote_ids,
                tipo_alimento=payload.get('tipo_alimento'),
                agrupar_por=agrupar_por,
            )

        if entidad == 'lotes':
            return self._report_lotes(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                galpon_ids=galpon_ids,
                estado_lote=payload.get('estado_lote'),
                agrupar_por=agrupar_por,
            )

        if entidad == 'bitacora':
            return self._report_bitacora(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                accion=payload.get('accion'),
                usuario_id=payload.get('usuario_id'),
                agrupar_por=agrupar_por,
            )

        raise ValueError('Entidad no soportada.')

    def _report_alimentacion(
            self,
            *,
            fecha_inicio,
            fecha_fin,
            galpon_ids: list[int],
            lote_ids: list[int],
            tipo_alimento,
            agrupar_por,
    ):
        qs = Alimentacion.objects.select_related('lote', 'lote__galpon').all()

        if fecha_inicio:
            qs = qs.filter(fecha__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(fecha__lte=fecha_fin)

        if galpon_ids:
            qs = qs.filter(lote__galpon_id__in=galpon_ids)
        if lote_ids:
            qs = qs.filter(lote_id__in=lote_ids)

        if tipo_alimento:
            tipo = str(tipo_alimento).strip()
            if tipo:
                qs = qs.filter(tipo_alimento__icontains=tipo)

        rows = []
        series = []

        if agrupar_por in {'dia', 'mes'}:
            trunc = TruncDay(
                'fecha') if agrupar_por == 'dia' else TruncMonth('fecha')
            agg = (
                qs.annotate(periodo=trunc)
                .values('periodo')
                .annotate(total_kg=Sum('cantidad_kg'), registros=Count('id_alimentacion'))
                .order_by('periodo')
            )
            rows = [
                {
                    'periodo': (r['periodo'].date().isoformat() if hasattr(r['periodo'], 'date') else str(r['periodo'])),
                    'total_kg': float(r['total_kg'] or 0),
                    'registros': int(r['registros'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por == 'galpon':
            agg = (
                qs.values('lote__galpon_id', 'lote__galpon__nombre')
                .annotate(total_kg=Sum('cantidad_kg'), registros=Count('id_alimentacion'))
                .order_by('lote__galpon__nombre')
            )
            rows = [
                {
                    'galpon_id': int(r['lote__galpon_id']),
                    'galpon': r['lote__galpon__nombre'],
                    'periodo': r['lote__galpon__nombre'],
                    'total_kg': float(r['total_kg'] or 0),
                    'registros': int(r['registros'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por == 'tipo_alimento':
            agg = (
                qs.values('tipo_alimento')
                .annotate(total_kg=Sum('cantidad_kg'), registros=Count('id_alimentacion'))
                .order_by('tipo_alimento')
            )
            rows = [
                {
                    'tipo_alimento': r['tipo_alimento'] or 'Sin especificar',
                    'periodo': r['tipo_alimento'] or 'Sin especificar',
                    'total_kg': float(r['total_kg'] or 0),
                    'registros': int(r['registros'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por == 'raza_tipo':
            agg = (
                qs.values('lote__raza_tipo')
                .annotate(total_kg=Sum('cantidad_kg'), registros=Count('id_alimentacion'))
                .order_by('lote__raza_tipo')
            )
            rows = [
                {
                    'raza_tipo': r['lote__raza_tipo'] or 'Sin especificar',
                    'periodo': r['lote__raza_tipo'] or 'Sin especificar',
                    'total_kg': float(r['total_kg'] or 0),
                    'registros': int(r['registros'] or 0),
                }
                for r in agg
            ]
            series = rows

        else:
            # datos crudos
            qs = qs.order_by('-fecha', '-id_alimentacion')
            rows = [
                {
                    'id_alimentacion': a.id_alimentacion,
                    'fecha': a.fecha.isoformat() if a.fecha else None,
                    'lote_id': a.lote_id,
                    'galpon_id': getattr(a.lote, 'galpon_id', None),
                    'galpon': getattr(getattr(a.lote, 'galpon', None), 'nombre', None),
                    'cantidad_kg': float(a.cantidad_kg or 0),
                    'tipo_alimento': a.tipo_alimento,
                    'observacion': a.observacion,
                }
                for a in qs[:2000]
            ]

        # summary + cálculos cruzados
        total_kg = qs.aggregate(total=Sum('cantidad_kg')).get('total') or 0
        summary = {'total_kg': float(total_kg)}

        # Conversión estimada por lote (respetando los mismos filtros que `qs`)
        lote_ids_en_datos = list(
            qs.values_list(
                'lote_id',
                flat=True).distinct())
        lote_qs = Lote.objects.filter(id_lote__in=lote_ids_en_datos)

        lote_stats = qs.values('lote_id').annotate(total_kg=Sum('cantidad_kg'))
        total_kg_por_lote = {int(r['lote_id']): float(
            r['total_kg'] or 0) for r in lote_stats}

        conversion_por_lote = []
        for l in lote_qs.select_related('galpon').order_by('id_lote'):
            kg = total_kg_por_lote.get(int(l.id_lote), 0.0)
            aves = int(l.cantidad_actual or 0)
            conversion = None
            if aves > 0:
                conversion = round(kg / aves, 6)
            mortalidad = None
            if l.cantidad_inicial and l.cantidad_inicial > 0:
                mortalidad = round(
                    ((l.cantidad_inicial - (l.cantidad_actual or 0)) / l.cantidad_inicial) * 100, 4)
            conversion_por_lote.append(
                {
                    'lote_id': int(l.id_lote),
                    'galpon_id': int(l.galpon_id),
                    'galpon': getattr(getattr(l, 'galpon', None), 'nombre', None),
                    'total_kg': round(kg, 4),
                    'aves_actuales': aves,
                    'conversion_estimada': conversion,
                    'mortalidad_pct': mortalidad,
                }
            )

        if conversion_por_lote:
            summary['conversion_por_lote'] = conversion_por_lote

        return rows, summary, series

    def _report_lotes(self, *, fecha_inicio, fecha_fin,
                      galpon_ids, estado_lote, agrupar_por):
        qs = Lote.objects.select_related('galpon').all()
        if galpon_ids:
            qs = qs.filter(galpon_id__in=galpon_ids)

        if estado_lote:
            estado = str(estado_lote).strip()
            if estado:
                qs = qs.filter(estado__iexact=estado)

        # rango de fechas sobre fecha_ingreso
        if fecha_inicio:
            qs = qs.filter(fecha_ingreso__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(fecha_ingreso__lte=fecha_fin)

        mortalidad_expr = ExpressionWrapper(
            (F('cantidad_inicial') - F('cantidad_actual')) *
            100.0 / F('cantidad_inicial'),
            output_field=DecimalField(max_digits=10, decimal_places=4),
        )

        rows = []
        series = []

        if agrupar_por in {'dia', 'mes'}:
            trunc = TruncDay('fecha_ingreso') if agrupar_por == 'dia' else TruncMonth(
                'fecha_ingreso')
            agg = (
                qs.annotate(periodo=trunc)
                .values('periodo')
                .annotate(
                    total_lotes=Count('id_lote'),
                    aves_actuales=Sum('cantidad_actual'),
                    mortalidad_promedio=Avg(mortalidad_expr),
                )
                .order_by('periodo')
            )
            rows = [
                {
                    'periodo': (r['periodo'].date().isoformat() if hasattr(r['periodo'], 'date') else str(r['periodo'])),
                    'total_lotes': int(r['total_lotes'] or 0),
                    'aves_actuales': int(r['aves_actuales'] or 0),
                    'mortalidad_promedio_pct': float(r['mortalidad_promedio'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por == 'galpon':
            agg = (
                qs.values('galpon_id', 'galpon__nombre', 'galpon__capacidad')
                .annotate(
                    total_lotes=Count('id_lote'),
                    aves_actuales=Sum('cantidad_actual'),
                    mortalidad_promedio=Avg(mortalidad_expr),
                )
                .order_by('galpon__nombre')
            )
            rows = []
            for r in agg:
                capacidad = int(r.get('galpon__capacidad') or 0)
                aves = int(r.get('aves_actuales') or 0)
                porcentaje = None
                if capacidad > 0:
                    porcentaje = round((aves / capacidad) * 100, 4)
                rows.append(
                    {
                        'galpon_id': int(r['galpon_id']),
                        'galpon': r['galpon__nombre'],
                        'periodo': r['galpon__nombre'],
                        'capacidad': capacidad,
                        'total_lotes': int(r['total_lotes'] or 0),
                        'aves_actuales': aves,
                        'porcentaje_ocupacion': porcentaje,
                        'mortalidad_promedio_pct': float(r['mortalidad_promedio'] or 0),
                    }
                )
            series = rows

        elif agrupar_por == 'raza_tipo':
            agg = (
                qs.values('raza_tipo')
                .annotate(
                    total_lotes=Count('id_lote'),
                    aves_actuales=Sum('cantidad_actual'),
                    mortalidad_promedio=Avg(mortalidad_expr),
                )
                .order_by('raza_tipo')
            )
            rows = [
                {
                    'raza_tipo': r['raza_tipo'] or 'Sin especificar',
                    'periodo': r['raza_tipo'] or 'Sin especificar',
                    'total_lotes': int(r['total_lotes'] or 0),
                    'aves_actuales': int(r['aves_actuales'] or 0),
                    'mortalidad_promedio_pct': float(r['mortalidad_promedio'] or 0),
                }
                for r in agg
            ]
            series = rows

        else:
            qs = qs.order_by('-id_lote')
            rows = []
            for l in qs[:2000]:
                mortalidad = None
                if l.cantidad_inicial and l.cantidad_inicial > 0:
                    mortalidad = round(
                        ((l.cantidad_inicial - (l.cantidad_actual or 0)) / l.cantidad_inicial) * 100, 4)
                rows.append(
                    {
                        'id_lote': int(l.id_lote),
                        'galpon_id': int(l.galpon_id),
                        'galpon': getattr(getattr(l, 'galpon', None), 'nombre', None),
                        'galpon_capacidad': int(getattr(getattr(l, 'galpon', None), 'capacidad', 0) or 0),
                        'fecha_ingreso': l.fecha_ingreso.isoformat() if l.fecha_ingreso else None,
                        'cantidad_inicial': int(l.cantidad_inicial or 0),
                        'cantidad_actual': int(l.cantidad_actual or 0),
                        'estado': l.estado,
                        'mortalidad_pct': mortalidad,
                    }
                )

        summary = qs.aggregate(
            total_lotes=Count('id_lote'),
            aves_actuales=Sum('cantidad_actual'),
            aves_iniciales=Sum('cantidad_inicial'),
        )
        summary = {
            'total_lotes': int(summary.get('total_lotes') or 0),
            'aves_actuales': int(summary.get('aves_actuales') or 0),
            'aves_iniciales': int(summary.get('aves_iniciales') or 0),
        }
        return rows, summary, series

    def _report_bitacora(self, *, fecha_inicio, fecha_fin,
                         accion, usuario_id, agrupar_por):
        qs = BitacoraEvento.objects.select_related('usuario').all()

        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if accion:
            act = str(accion).strip()
            if act:
                qs = qs.filter(accion__icontains=act)

        # Para bitácora usamos fecha_hora; convertimos date -> datetime
        # boundaries
        if fecha_inicio:
            qs = qs.filter(fecha_hora__date__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(fecha_hora__date__lte=fecha_fin)

        rows = []
        series = []

        if agrupar_por in {'dia', 'mes'}:
            trunc = TruncDay(
                'fecha_hora') if agrupar_por == 'dia' else TruncMonth('fecha_hora')
            agg = (
                qs.annotate(periodo=trunc)
                .values('periodo')
                .annotate(total_eventos=Count('id'), usuarios=Count('usuario_id', distinct=True))
                .order_by('periodo')
            )
            rows = [
                {
                    'periodo': (r['periodo'].date().isoformat() if hasattr(r['periodo'], 'date') else str(r['periodo'])),
                    'total_eventos': int(r['total_eventos'] or 0),
                    'usuarios_distintos': int(r['usuarios'] or 0),
                }
                for r in agg
            ]
            series = rows

        else:
            qs = qs.order_by('-fecha_hora', '-id')
            rows = [
                {
                    'id': int(e.id),
                    'fecha_hora': e.fecha_hora.isoformat() if e.fecha_hora else None,
                    'usuario_id': e.usuario_id,
                    'usuario': getattr(getattr(e, 'usuario', None), 'nom_usuario', None),
                    'accion': e.accion,
                    'descripcion': e.descripcion,
                }
                for e in qs[:2000]
            ]

        summary = qs.aggregate(
            total_eventos=Count('id'),
            usuarios=Count(
                'usuario_id',
                distinct=True))
        summary = {
            'total_eventos': int(summary.get('total_eventos') or 0),
            'usuarios_distintos': int(summary.get('usuarios') or 0),
        }
        return rows, summary, series
