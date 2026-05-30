from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.db.models import QuerySet
from django.utils import timezone

from apps.temperatura.models import ModeloSensorVirtualTemperatura, TemperaturaGalpon


@dataclass(frozen=True)
class EntrenamientoResultado:
    feature_names: list[str]
    coeficientes: list[float]
    r2: float
    n_muestras: int


def _features_for(
    *,
    ts,
    temp_externa: float,
    humedad_externa: float,
    temp_prev: float,
) -> tuple[list[str], list[float]]:
    """Construye features numéricas para el sensor virtual."""

    hour = ts.hour + (ts.minute / 60.0)
    angle = 2.0 * math.pi * (hour / 24.0)

    names = [
        'bias',
        'temp_externa',
        'humedad_externa',
        'sin_hora',
        'cos_hora',
        'temp_prev',
    ]

    values = [
        1.0,
        float(temp_externa),
        float(humedad_externa),
        math.sin(angle),
        math.cos(angle),
        float(temp_prev),
    ]

    return names, values


def _solve_linear_system(a: list[list[float]], b: list[float]) -> list[float]:
    """Resuelve A x = b con Gauss-Jordan (matriz pequeña)."""

    n = len(a)
    # Matriz aumentada
    m = [row[:] + [b_i] for row, b_i in zip(a, b)]

    for col in range(n):
        # Pivot
        pivot = col
        for r in range(col, n):
            if abs(m[r][col]) > abs(m[pivot][col]):
                pivot = r
        if abs(m[pivot][col]) < 1e-12:
            raise ValueError('Sistema singular')
        if pivot != col:
            m[col], m[pivot] = m[pivot], m[col]

        # Normalizar fila
        div = m[col][col]
        for c in range(col, n + 1):
            m[col][c] /= div

        # Eliminar otras filas
        for r in range(n):
            if r == col:
                continue
            factor = m[r][col]
            if factor == 0:
                continue
            for c in range(col, n + 1):
                m[r][c] -= factor * m[col][c]

    return [m[i][n] for i in range(n)]


def _fit_linear_regression(x: list[list[float]], y: list[float], ridge: float = 1e-6) -> list[float]:
    """Ajuste por ecuación normal con regularización L2 muy pequeña."""

    n = len(x)
    if n < 2:
        raise ValueError('Datos insuficientes')

    p = len(x[0])

    # XtX y XtY
    xtx = [[0.0 for _ in range(p)] for _ in range(p)]
    xty = [0.0 for _ in range(p)]

    for i in range(n):
        xi = x[i]
        yi = y[i]
        for j in range(p):
            xty[j] += xi[j] * yi
            for k in range(p):
                xtx[j][k] += xi[j] * xi[k]

    # Ridge
    for d in range(p):
        xtx[d][d] += ridge

    return _solve_linear_system(xtx, xty)


def _r2_score(y_true: list[float], y_pred: list[float]) -> float:
    if not y_true:
        return 0.0
    mean_y = sum(y_true) / len(y_true)
    ss_tot = sum((v - mean_y) ** 2 for v in y_true)
    ss_res = sum((yt - yp) ** 2 for yt, yp in zip(y_true, y_pred))
    if ss_tot == 0:
        return 0.0
    r2 = 1.0 - (ss_res / ss_tot)
    if r2 < 0:
        r2 = 0.0
    if r2 > 1:
        r2 = 1.0
    return float(r2)


def entrenar_sensor_virtual(
    *,
    empresa_id: int | None,
    galpon_id: int | None = None,
    ventana_horas: int = 2160,
    min_muestras: int = 50,
) -> EntrenamientoResultado | None:
    """Entrena un modelo de sensor virtual a partir de TemperaturaGalpon.

    Requiere que existan campos `temperatura_externa` y `humedad_externa`.
    """

    now = timezone.now()
    since = now - timedelta(hours=ventana_horas)

    qs: QuerySet[TemperaturaGalpon] = TemperaturaGalpon.objects.filter(
        fecha_hora__gte=since,
        temperatura_externa__isnull=False,
        humedad_externa__isnull=False,
    ).order_by('fecha_hora', 'id')

    if empresa_id is not None:
        qs = qs.filter(empresa_id=empresa_id)
    if galpon_id is not None:
        qs = qs.filter(galpon_id=galpon_id)

    rows = list(qs[:20000])
    if len(rows) < min_muestras:
        return None

    x: list[list[float]] = []
    y: list[float] = []

    temp_prev = float(rows[0].temperatura)
    feature_names: list[str] | None = None

    for r in rows[1:]:
        names, vals = _features_for(
            ts=r.fecha_hora,
            temp_externa=float(r.temperatura_externa),
            humedad_externa=float(r.humedad_externa),
            temp_prev=temp_prev,
        )
        if feature_names is None:
            feature_names = names
        x.append(vals)
        y.append(float(r.temperatura))
        temp_prev = float(r.temperatura)

    if not feature_names or len(x) < min_muestras:
        return None

    coef = _fit_linear_regression(x, y)
    y_pred = [sum(c * v for c, v in zip(coef, xi)) for xi in x]
    r2 = _r2_score(y, y_pred)

    return EntrenamientoResultado(
        feature_names=feature_names,
        coeficientes=[float(c) for c in coef],
        r2=float(r2),
        n_muestras=len(y),
    )


def guardar_modelo_entrenado(
    *,
    empresa_id: int | None,
    galpon_id: int | None,
    ventana_horas: int,
    resultado: EntrenamientoResultado,
) -> ModeloSensorVirtualTemperatura:
    return ModeloSensorVirtualTemperatura.objects.create(
        empresa_id=empresa_id,
        galpon_id=galpon_id,
        ventana_horas=int(ventana_horas),
        feature_names=resultado.feature_names,
        coeficientes=resultado.coeficientes,
        r2=resultado.r2,
        n_muestras=resultado.n_muestras,
    )


def predecir_sensor_virtual(
    *,
    empresa_id: int | None,
    galpon_id: int,
    temp_externa: float,
    humedad_externa: float,
    temp_prev: float,
    ts=None,
) -> dict[str, Any] | None:
    """Predice temperatura interna usando el último modelo entrenado."""

    if ts is None:
        ts = timezone.now()

    model_qs = ModeloSensorVirtualTemperatura.objects.all().order_by('-fecha_hora', '-id')
    if empresa_id is not None:
        model_qs = model_qs.filter(empresa_id=empresa_id)

    # Preferimos modelo específico por galpón; si no existe, usamos el de empresa.
    model = model_qs.filter(galpon_id=galpon_id).first() or model_qs.filter(galpon__isnull=True).first()
    if not model:
        return None

    _, vals = _features_for(
        ts=ts,
        temp_externa=float(temp_externa),
        humedad_externa=float(humedad_externa),
        temp_prev=float(temp_prev),
    )

    coef = [float(c) for c in (model.coeficientes or [])]
    if len(coef) != len(vals):
        return None

    y_hat = sum(c * v for c, v in zip(coef, vals))

    return {
        'temperatura_estimada': round(float(y_hat), 2),
        'modelo_id': model.id,
        'r2': model.r2,
        'n_muestras': model.n_muestras,
        'ventana_horas': model.ventana_horas,
        'feature_names': model.feature_names,
    }
