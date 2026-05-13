import csv
import io
from datetime import datetime

from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Max, Min, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.alimentacion.models import Alimentacion
from apps.bitacora.models import BitacoraEvento
from apps.insumos.models import ControlSanitario, Insumo, MovimientoAlmacen
from apps.lotes.models import Lote
from apps.mortandad.models import RegistroMortalidad
from apps.temperatura.models import TemperaturaGalpon
from apps.usuarios.models import Usuario
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

        if entidad == 'insumos':
            return self._report_insumos(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                agrupar_por=agrupar_por,
            )

        if entidad == 'sanitario':
            return self._report_sanitario(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                lote_ids=lote_ids,
                agrupar_por=agrupar_por,
            )

        if entidad == 'mortalidad':
            return self._report_mortalidad(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                galpon_ids=galpon_ids,
                lote_ids=lote_ids,
                agrupar_por=agrupar_por,
            )

        if entidad == 'usuarios':
            return self._report_usuarios(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                agrupar_por=agrupar_por,
            )

        if entidad == 'temperatura':
            return self._report_temperatura(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                galpon_ids=galpon_ids,
                agrupar_por=agrupar_por,
            )

        raise ValueError('Entidad no soportada.')

    def _report_temperatura(self, *, fecha_inicio, fecha_fin, galpon_ids, agrupar_por):
        """Reporte de temperaturas por galpón.

        Fuente: apps.temperatura.TemperaturaGalpon
        """
        qs = TemperaturaGalpon.objects.select_related('galpon').all()

        if fecha_inicio:
            qs = qs.filter(fecha_hora__date__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(fecha_hora__date__lte=fecha_fin)
        if galpon_ids:
            qs = qs.filter(galpon_id__in=galpon_ids)

        rows = []
        series = []

        if agrupar_por in {'dia', 'mes'}:
            trunc = TruncDay('fecha_hora') if agrupar_por == 'dia' else TruncMonth('fecha_hora')
            agg = (
                qs.annotate(periodo=trunc)
                .values('periodo')
                .annotate(
                    temperatura_promedio=Avg('temperatura'),
                    temperatura_min=Min('temperatura'),
                    temperatura_max=Max('temperatura'),
                    registros=Count('id'),
                    alertas=Count('id', filter=Q(estado__in=['FRIO', 'CALOR'])),
                )
                .order_by('periodo')
            )
            rows = [
                {
                    'periodo': (r['periodo'].date().isoformat() if hasattr(r['periodo'], 'date') else str(r['periodo'])),
                    'temperatura_promedio': float(r['temperatura_promedio'] or 0),
                    'temperatura_min': float(r['temperatura_min'] or 0),
                    'temperatura_max': float(r['temperatura_max'] or 0),
                    'registros': int(r['registros'] or 0),
                    'alertas': int(r['alertas'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por == 'galpon':
            agg = (
                qs.values('galpon_id', 'galpon__nombre')
                .annotate(
                    temperatura_promedio=Avg('temperatura'),
                    temperatura_min=Min('temperatura'),
                    temperatura_max=Max('temperatura'),
                    registros=Count('id'),
                    alertas=Count('id', filter=Q(estado__in=['FRIO', 'CALOR'])),
                )
                .order_by('galpon__nombre')
            )
            rows = [
                {
                    'galpon_id': int(r['galpon_id']),
                    'galpon': r['galpon__nombre'],
                    'periodo': r['galpon__nombre'],
                    'temperatura_promedio': float(r['temperatura_promedio'] or 0),
                    'temperatura_min': float(r['temperatura_min'] or 0),
                    'temperatura_max': float(r['temperatura_max'] or 0),
                    'registros': int(r['registros'] or 0),
                    'alertas': int(r['alertas'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por == 'estado':
            agg = (
                qs.values('estado')
                .annotate(
                    temperatura_promedio=Avg('temperatura'),
                    temperatura_min=Min('temperatura'),
                    temperatura_max=Max('temperatura'),
                    registros=Count('id'),
                )
                .order_by('estado')
            )
            rows = [
                {
                    'estado': r['estado'] or 'SIN_ESTADO',
                    'periodo': r['estado'] or 'SIN_ESTADO',
                    'temperatura_promedio': float(r['temperatura_promedio'] or 0),
                    'temperatura_min': float(r['temperatura_min'] or 0),
                    'temperatura_max': float(r['temperatura_max'] or 0),
                    'registros': int(r['registros'] or 0),
                }
                for r in agg
            ]
            series = rows

        else:
            qs = qs.order_by('-fecha_hora', '-id')
            rows = [
                {
                    'id': int(t.id),
                    'fecha_hora': t.fecha_hora.isoformat() if t.fecha_hora else None,
                    'galpon_id': int(getattr(t, 'galpon_id', 0) or 0) or None,
                    'galpon': getattr(getattr(t, 'galpon', None), 'nombre', None),
                    'temperatura_c': float(t.temperatura or 0),
                    'estado': t.estado,
                    'fuente': t.fuente,
                    'periodo': (t.fecha_hora.date().isoformat() if t.fecha_hora else None),
                }
                for t in qs[:2000]
            ]

        summary_agg = qs.aggregate(
            temperatura_promedio=Avg('temperatura'),
            temperatura_min=Min('temperatura'),
            temperatura_max=Max('temperatura'),
            registros=Count('id'),
            alertas=Count('id', filter=Q(estado__in=['FRIO', 'CALOR'])),
        )
        summary = {
            'temperatura_promedio': float(summary_agg.get('temperatura_promedio') or 0),
            'temperatura_min': float(summary_agg.get('temperatura_min') or 0),
            'temperatura_max': float(summary_agg.get('temperatura_max') or 0),
            'registros': int(summary_agg.get('registros') or 0),
            'alertas': int(summary_agg.get('alertas') or 0),
        }
        return rows, summary, series

    def _report_mortalidad(self, *, fecha_inicio, fecha_fin, galpon_ids, lote_ids, agrupar_por):
        """Reporte de bajas (mortalidad)."""
        qs = RegistroMortalidad.objects.select_related('lote', 'lote__galpon').all()
        if fecha_inicio:
            qs = qs.filter(fecha_hora__date__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(fecha_hora__date__lte=fecha_fin)
        if galpon_ids:
            qs = qs.filter(lote__galpon_id__in=galpon_ids)
        if lote_ids:
            qs = qs.filter(lote_id__in=lote_ids)

        rows = []
        series = []

        if agrupar_por in {'dia', 'mes'}:
            trunc = TruncDay('fecha_hora') if agrupar_por == 'dia' else TruncMonth('fecha_hora')
            agg = (
                qs.annotate(periodo=trunc)
                .values('periodo')
                .annotate(bajas=Sum('cantidad'), eventos=Count('id_muerte'))
                .order_by('periodo')
            )
            rows = [
                {
                    'periodo': (r['periodo'].date().isoformat() if hasattr(r['periodo'], 'date') else str(r['periodo'])),
                    'total_bajas': int(r['bajas'] or 0),
                    'eventos': int(r['eventos'] or 0),
                }
                for r in agg
            ]
            series = rows
        elif agrupar_por == 'lote':
            agg = (
                qs.values('lote_id')
                .annotate(bajas=Sum('cantidad'), eventos=Count('id_muerte'))
                .order_by('lote_id')
            )
            rows = [
                {
                    'lote_id': r['lote_id'],
                    'periodo': f"Lote {r['lote_id']}",
                    'total_bajas': int(r['bajas'] or 0),
                    'eventos': int(r['eventos'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por == 'galpon':
            agg = (
                qs.values('lote__galpon_id', 'lote__galpon__nombre')
                .annotate(bajas=Sum('cantidad'), eventos=Count('id_muerte'))
                .order_by('lote__galpon__nombre')
            )
            rows = [
                {
                    'galpon_id': int(r['lote__galpon_id']),
                    'galpon': r['lote__galpon__nombre'],
                    'periodo': r['lote__galpon__nombre'],
                    'total_bajas': int(r['bajas'] or 0),
                    'eventos': int(r['eventos'] or 0),
                }
                for r in agg
            ]
            series = rows
        else:
            qs = qs.order_by('-fecha_hora')
            rows = [
                {
                    'id': m.id_muerte,
                    'fecha': m.fecha_hora.isoformat(),
                    'lote_id': m.lote_id,
                    'galpon': getattr(getattr(m.lote, 'galpon', None), 'nombre', None),
                    'cantidad': m.cantidad,
                    'causa': m.causa,
                    'periodo': m.fecha_hora.date().isoformat(),
                }
                for m in qs[:2000]
            ]

        summary = qs.aggregate(total_bajas=Sum('cantidad'), total_eventos=Count('id_muerte'))
        summary = {
            'total_bajas': int(summary.get('total_bajas') or 0),
            'total_eventos': int(summary.get('total_eventos') or 0),
        }
        return rows, summary, series

    def _report_usuarios(self, *, fecha_inicio, fecha_fin, agrupar_por):
        """Reporte de personal / usuarios."""
        qs = Usuario.objects.all()
        # No hay campo fecha de creación en tu SQL actual, reportamos lista y estado
        rows = [
            {
                'id': u.id,
                'nom_usuario': u.nom_usuario,
                'email': u.email,
                'tipo': u.tipo_usuario,
                'estado': u.estado,
                'periodo': u.nom_usuario,
            }
            for u in qs
        ]
        
        agg = qs.values('estado').annotate(total=Count('id'))
        summary = {
            'total_usuarios': qs.count(),
            'por_estado': {r['estado'] or 'Sin estado': r['total'] for r in agg}
        }
        return rows, summary, []


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

        elif agrupar_por == 'lote':
            agg = (
                qs.values('lote_id', 'lote__galpon__nombre', 'lote__cantidad_inicial', 'lote__cantidad_actual')
                .annotate(total_kg=Sum('cantidad_kg'), registros=Count('id_alimentacion'))
                .order_by('lote_id')
            )
            rows = []
            for r in agg:
                aves_ini = r['lote__cantidad_inicial'] or 0
                aves_act = r['lote__cantidad_actual'] or 0
                kg = r['total_kg'] or 0
                mortalidad = round(((aves_ini - aves_act) / aves_ini) * 100, 4) if aves_ini > 0 else 0
                conversion = round(float(kg) / aves_act, 4) if aves_act > 0 else 0
                rows.append({
                    'lote_id': r['lote_id'],
                    'periodo': f"Lote {r['lote_id']}",
                    'galpon': r['lote__galpon__nombre'],
                    'total_kg': float(kg),
                    'mortalidad_pct': mortalidad,
                    'conversion_alimenticia': conversion,
                })
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

        elif agrupar_por == 'estado':
            agg = (
                qs.values('estado')
                .annotate(
                    total_lotes=Count('id_lote'),
                    aves_actuales=Sum('cantidad_actual'),
                    mortalidad_promedio=Avg(mortalidad_expr),
                )
                .order_by('estado')
            )
            rows = [
                {
                    'estado': r['estado'] or 'Sin especificar',
                    'periodo': r['estado'] or 'Sin especificar',
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

    # ── Inventario / Insumos ──────────────────────────────────────────────────
    def _report_insumos(self, *, fecha_inicio, fecha_fin, agrupar_por):
        """Reporte de movimientos de almacén y estado del catálogo de insumos."""
        mov_qs = MovimientoAlmacen.objects.select_related('insumo', 'proveedor').all()

        if fecha_inicio:
            mov_qs = mov_qs.filter(fecha_hora__date__gte=fecha_inicio)
        if fecha_fin:
            mov_qs = mov_qs.filter(fecha_hora__date__lte=fecha_fin)

        rows = []
        series = []

        if agrupar_por == 'tipo':
            agg = (
                mov_qs.values('insumo__tipo')
                .annotate(
                    total_entradas=Sum('cantidad', filter=Q(tipo_movimiento='Entrada')),
                    total_salidas=Sum('cantidad', filter=Q(tipo_movimiento='Salida')),
                    movimientos=Count('id'),
                )
                .order_by('insumo__tipo')
            )
            rows = [
                {
                    'tipo': r['insumo__tipo'] or 'Sin tipo',
                    'periodo': r['insumo__tipo'] or 'Sin tipo',
                    'total_entradas': float(r['total_entradas'] or 0),
                    'total_salidas': float(r['total_salidas'] or 0),
                    'movimientos': int(r['movimientos'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por in {'dia', 'mes'}:
            trunc = TruncDay('fecha_hora') if agrupar_por == 'dia' else TruncMonth('fecha_hora')
            agg = (
                mov_qs.annotate(periodo=trunc)
                .values('periodo')
                .annotate(
                    total_entradas=Sum('cantidad', filter=Q(tipo_movimiento='Entrada')),
                    total_salidas=Sum('cantidad', filter=Q(tipo_movimiento='Salida')),
                    movimientos=Count('id'),
                )
                .order_by('periodo')
            )
            rows = [
                {
                    'periodo': (r['periodo'].date().isoformat() if hasattr(r['periodo'], 'date') else str(r['periodo'])),
                    'total_entradas': float(r['total_entradas'] or 0),
                    'total_salidas': float(r['total_salidas'] or 0),
                    'movimientos': int(r['movimientos'] or 0),
                }
                for r in agg
            ]
            series = rows

        else:
            # Catálogo de insumos con estado de stock
            insumo_qs = Insumo.objects.all().order_by('tipo', 'nombre')
            rows = [
                {
                    'id_insumo': i.id_insumo,
                    'nombre': i.nombre,
                    'tipo': i.tipo,
                    'unidad_medida': i.unidad_medida,
                    'stock_actual': float(i.stock_actual),
                    'stock_minimo': float(i.stock_minimo),
                    'bajo_stock': i.bajo_stock,
                    'periodo': i.nombre,
                }
                for i in insumo_qs
            ]

        # summary
        cat = Insumo.objects.aggregate(
            total_insumos=Count('id_insumo'),
            bajo_stock_count=Count('id_insumo', filter=Q(stock_actual__lte=F('stock_minimo'))),
        )
        mov_summary = mov_qs.aggregate(
            total_entradas=Sum('cantidad', filter=Q(tipo_movimiento='Entrada')),
            total_salidas=Sum('cantidad', filter=Q(tipo_movimiento='Salida')),
        )
        summary = {
            'total_insumos': int(cat.get('total_insumos') or 0),
            'insumos_bajo_stock': int(cat.get('bajo_stock_count') or 0),
            'total_entradas': float(mov_summary.get('total_entradas') or 0),
            'total_salidas': float(mov_summary.get('total_salidas') or 0),
        }
        return rows, summary, series

    # ── Sanitario ─────────────────────────────────────────────────────────────
    def _report_sanitario(self, *, fecha_inicio, fecha_fin, lote_ids, agrupar_por):
        """Reporte de tratamientos sanitarios aplicados."""
        qs = ControlSanitario.objects.select_related('lote', 'insumo').all()

        if fecha_inicio:
            qs = qs.filter(fecha_aplicacion__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(fecha_aplicacion__lte=fecha_fin)
        if lote_ids:
            qs = qs.filter(lote_id__in=lote_ids)

        rows = []
        series = []

        if agrupar_por == 'tipo':
            agg = (
                qs.values('tipo_tratamiento')
                .annotate(aplicaciones=Count('id'), dosis_total=Sum('dosis'))
                .order_by('tipo_tratamiento')
            )
            rows = [
                {
                    'tipo_tratamiento': r['tipo_tratamiento'],
                    'periodo': r['tipo_tratamiento'],
                    'aplicaciones': int(r['aplicaciones'] or 0),
                    'dosis_total': float(r['dosis_total'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por in {'dia', 'mes'}:
            trunc = TruncDay('fecha_aplicacion') if agrupar_por == 'dia' else TruncMonth('fecha_aplicacion')
            agg = (
                qs.annotate(periodo=trunc)
                .values('periodo')
                .annotate(aplicaciones=Count('id'), dosis_total=Sum('dosis'))
                .order_by('periodo')
            )
            rows = [
                {
                    'periodo': (r['periodo'].date().isoformat() if hasattr(r['periodo'], 'date') else str(r['periodo'])),
                    'aplicaciones': int(r['aplicaciones'] or 0),
                    'dosis_total': float(r['dosis_total'] or 0),
                }
                for r in agg
            ]
            series = rows

        elif agrupar_por == 'lote':
            agg = (
                qs.values('lote_id')
                .annotate(aplicaciones=Count('id'), dosis_total=Sum('dosis'))
                .order_by('lote_id')
            )
            rows = [
                {
                    'lote_id': r['lote_id'],
                    'periodo': f"Lote {r['lote_id']}",
                    'aplicaciones': int(r['aplicaciones'] or 0),
                    'dosis_total': float(r['dosis_total'] or 0),
                }
                for r in agg
            ]
            series = rows

        else:
            qs = qs.order_by('-fecha_aplicacion')
            rows = [
                {
                    'id': c.id,
                    'fecha_aplicacion': c.fecha_aplicacion.isoformat() if c.fecha_aplicacion else None,
                    'lote_id': c.lote_id,
                    'insumo': c.insumo.nombre if c.insumo else None,
                    'tipo_tratamiento': c.tipo_tratamiento,
                    'dosis': float(c.dosis),
                    'unidad_dosis': c.unidad_dosis,
                    'responsable': c.responsable,
                    'periodo': c.fecha_aplicacion.isoformat() if c.fecha_aplicacion else None,
                }
                for c in qs[:2000]
            ]

        agg_s = qs.aggregate(
            total_aplicaciones=Count('id'),
            dosis_total=Sum('dosis'),
        )
        summary = {
            'total_aplicaciones': int(agg_s.get('total_aplicaciones') or 0),
            'dosis_total': float(agg_s.get('dosis_total') or 0),
        }
        return rows, summary, series


# ── Dashboard de KPIs ─────────────────────────────────────────────────────────
class DashboardResumenView(APIView):
    """Endpoint GET /reportes/dashboard/ — devuelve KPIs generales del sistema."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        hoy = timezone.localdate()
        primer_dia_mes = hoy.replace(day=1)

        # ── Lotes activos ──
        lotes_activos = Lote.objects.filter(
            estado__in=['Crianza', 'Crecimiento', 'Engorde', 'Activo']
        )
        total_aves = lotes_activos.aggregate(t=Sum('cantidad_actual'))['t'] or 0
        total_aves_ini = lotes_activos.aggregate(t=Sum('cantidad_inicial'))['t'] or 0
        mortalidad_pct = 0
        if total_aves_ini > 0:
            mortalidad_pct = round(((total_aves_ini - total_aves) / total_aves_ini) * 100, 2)

        # ── Alimentación del mes ──
        alim_mes = Alimentacion.objects.filter(fecha__gte=primer_dia_mes)
        consumo_mes_kg = float(alim_mes.aggregate(t=Sum('cantidad_kg'))['t'] or 0)

        # ── Conversión estimada ──
        conversion_estimada = None
        if total_aves > 0 and consumo_mes_kg > 0:
            conversion_estimada = round(consumo_mes_kg / total_aves, 4)

        # ── Insumos críticos ──
        insumos_criticos = list(
            Insumo.objects.filter(stock_actual__lte=F('stock_minimo'))
            .order_by('stock_actual')
            .values('id_insumo', 'nombre', 'tipo', 'stock_actual', 'stock_minimo', 'unidad_medida')[:10]
        )
        for i in insumos_criticos:
            i['stock_actual'] = float(i['stock_actual'])
            i['stock_minimo'] = float(i['stock_minimo'])

        # ── Tratamientos sanitarios del mes ──
        tratamientos_mes = ControlSanitario.objects.filter(
            fecha_aplicacion__gte=primer_dia_mes
        ).count()

        # ── Movimientos de inventario del mes ──
        entradas_mes = float(
            MovimientoAlmacen.objects.filter(
                fecha_hora__date__gte=primer_dia_mes,
                tipo_movimiento='Entrada'
            ).aggregate(t=Sum('cantidad'))['t'] or 0
        )
        salidas_mes = float(
            MovimientoAlmacen.objects.filter(
                fecha_hora__date__gte=primer_dia_mes,
                tipo_movimiento='Salida'
            ).aggregate(t=Sum('cantidad'))['t'] or 0
        )

        # ── Consumo últimos 7 días (serie para mini-chart) ──
        from datetime import timedelta
        hace_7 = hoy - timedelta(days=6)
        serie_7d = (
            Alimentacion.objects.filter(fecha__gte=hace_7)
            .annotate(periodo=TruncDay('fecha'))
            .values('periodo')
            .annotate(kg=Sum('cantidad_kg'))
            .order_by('periodo')
        )
        consumo_7d = [
            {'fecha': r['periodo'].isoformat(), 'kg': float(r['kg'] or 0)}
            for r in serie_7d
        ]

        return Response({
            'aves_activas': int(total_aves),
            'lotes_activos': lotes_activos.count(),
            'mortalidad_pct': mortalidad_pct,
            'consumo_mes_kg': consumo_mes_kg,
            'conversion_estimada': conversion_estimada,
            'insumos_criticos': insumos_criticos,
            'insumos_criticos_count': len(insumos_criticos),
            'tratamientos_mes': tratamientos_mes,
            'entradas_mes': entradas_mes,
            'salidas_mes': salidas_mes,
            'consumo_7d': consumo_7d,
        })
