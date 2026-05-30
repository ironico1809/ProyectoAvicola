from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db.models import QuerySet
from django.utils import timezone

from apps.temperatura.models import TemperaturaGalpon


@dataclass(frozen=True)
class PrediccionResultado:
    temperatura_predicha: Decimal
    confianza: float
    puntos: list[dict[str, Any]]


def _linear_regression(xs: list[float], ys: list[float]) -> tuple[float, float, float]:
    """Regresión lineal simple (mínimos cuadrados) sin dependencias externas.

    Retorna (pendiente, intercepto, r2).
    """

    if len(xs) != len(ys) or len(xs) < 2:
        raise ValueError("Datos insuficientes")

    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)

    var_x = sum((x - mean_x) ** 2 for x in xs)
    if var_x == 0:
        raise ValueError("Varianza X = 0")

    cov_xy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    slope = cov_xy / var_x
    intercept = mean_y - slope * mean_x

    # R^2
    y_hat = [slope * x + intercept for x in xs]
    ss_res = sum((y - yh) ** 2 for y, yh in zip(ys, y_hat))
    ss_tot = sum((y - mean_y) ** 2 for y in ys)
    if ss_tot == 0:
        r2 = 0.0
    else:
        r2 = 1 - (ss_res / ss_tot)

    # Normalizamos a 0..1 para UI (sin afirmar que sea una probabilidad)
    if r2 < 0:
        r2 = 0.0
    if r2 > 1:
        r2 = 1.0

    return slope, intercept, r2


def predecir_temperatura_galpon(
    *,
    galpon_id: int,
    horizonte_horas: int = 3,
    ventana_horas: int = 2160,
    min_registros: int = 8,
    empresa_id: int | None = None,
) -> PrediccionResultado | None:
    """Predice la temperatura para un galpón en las próximas `horizonte_horas`.

    - Usa las lecturas reales guardadas en `TemperaturaGalpon`.
    - Ajusta una regresión lineal (t -> temperatura).
    - Devuelve una serie de puntos futuros y una métrica de ajuste (0..1).

    Si no hay suficientes datos o el ajuste no es posible, retorna None.
    """

    if horizonte_horas < 1:
        horizonte_horas = 1

    now = timezone.now()
    since = now - timedelta(hours=ventana_horas)

    qs: QuerySet[TemperaturaGalpon] = TemperaturaGalpon.objects.filter(
        galpon_id=galpon_id,
        fecha_hora__gte=since,
    ).order_by('fecha_hora', 'id')

    if empresa_id is not None:
        qs = qs.filter(empresa_id=empresa_id)

    rows = list(qs[:1000])
    if len(rows) < min_registros:
        return None

    t0 = rows[0].fecha_hora
    xs = [float((r.fecha_hora - t0).total_seconds() / 3600.0) for r in rows]
    ys = [float(r.temperatura) for r in rows]

    try:
        slope, intercept, r2 = _linear_regression(xs, ys)
    except ValueError:
        return None

    last_x = xs[-1]
    last_time = rows[-1].fecha_hora

    puntos: list[dict[str, Any]] = []
    temp_final: float | None = None

    for h in range(1, horizonte_horas + 1):
        future_time = last_time + timedelta(hours=h)
        x_future = last_x + h
        y_future = slope * x_future + intercept
        temp_final = y_future
        puntos.append({
            'fecha_hora': future_time.isoformat(),
            'temperatura': round(float(y_future), 2),
            'h': h,
        })

    if temp_final is None:
        return None

    return PrediccionResultado(
        temperatura_predicha=Decimal(str(round(float(temp_final), 2))),
        confianza=float(r2),
        puntos=puntos,
    )
