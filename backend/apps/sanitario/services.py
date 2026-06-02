from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from apps.insumos.models import ControlSanitario, Insumo
from apps.mortandad.models import RegistroMortalidad
from apps.sanitario.models import AlertaSanitaria


UMBRAL_AFECTACION = Decimal('5.00')
UMBRAL_INCREMENTO_MORTANDAD = Decimal('20.00')
VENTANA_POST_DIAGNOSTICO_HORAS = 24
TIPOS_INSUMO_CRITICO = ('Medicamento', 'Vacuna')


def _redondear(valor):
    return Decimal(valor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calcular_porcentaje_afectacion(registro_enfermedad):
    """
    Calcula el porcentaje de aves afectadas.
    Si el usuario ya mandó porcentaje, usa ese.
    Si mandó cantidad, calcula:
    cantidad afectada / cantidad actual del lote * 100
    """

    if registro_enfermedad.porcentaje_afectacion is not None:
        return _redondear(registro_enfermedad.porcentaje_afectacion)

    cantidad_afectadas = registro_enfermedad.cantidad_aves_afectadas or 0
    lote = registro_enfermedad.lote
    total_aves = lote.cantidad_actual or lote.cantidad_inicial or 0

    if total_aves <= 0:
        return Decimal('0.00')

    porcentaje = (Decimal(cantidad_afectadas) * Decimal('100')) / Decimal(total_aves)
    return _redondear(porcentaje)


def generar_alertas_por_enfermedad(registro_enfermedad, usuario=None):
    """
    CU17:
    Genera alerta sanitaria si el registro de enfermedad supera el 5%
    de aves afectadas del lote.
    """

    alertas_generadas = []
    porcentaje = calcular_porcentaje_afectacion(registro_enfermedad)

    if registro_enfermedad.porcentaje_afectacion is None:
        registro_enfermedad.porcentaje_afectacion = porcentaje
        registro_enfermedad.save(update_fields=['porcentaje_afectacion'])

    if porcentaje > UMBRAL_AFECTACION:
        alerta_existente = AlertaSanitaria.objects.filter(
            lote=registro_enfermedad.lote,
            registro_enfermedad=registro_enfermedad,
            tipo_alerta='Afectacion',
        ).exclude(estado='Resuelta').exists()

        if not alerta_existente:
            nivel = 'Critico' if porcentaje >= Decimal('15.00') else 'Alto'

            alerta = AlertaSanitaria.objects.create(
                lote=registro_enfermedad.lote,
                registro_enfermedad=registro_enfermedad,
                tipo_alerta='Afectacion',
                nivel=nivel,
                causa='Porcentaje de aves afectadas supera el umbral sanitario permitido.',
                mensaje=(
                    f"Alerta Sanitaria: el lote {registro_enfermedad.lote_id} presenta "
                    f"{porcentaje}% de aves afectadas por "
                    f"{registro_enfermedad.enfermedad_sintoma}. "
                    "Revisar urgentemente y aplicar tratamiento oportuno."
                ),
                porcentaje_detectado=porcentaje,
                cantidad_detectada=registro_enfermedad.cantidad_aves_afectadas,
                usuario=usuario,
                empresa_id=registro_enfermedad.empresa_id,
            )
            alertas_generadas.append(alerta)

    return alertas_generadas


def generar_alerta_por_mortandad(registro_mortalidad, usuario=None):
    """
    CU17:
    Genera alerta si existe una enfermedad activa registrada en las 24 horas
    anteriores y la mortandad actual aumenta más del 20% frente al promedio
    de registros anteriores.
    """

    fecha_mortandad = registro_mortalidad.fecha_hora
    inicio_ventana = fecha_mortandad - timedelta(hours=VENTANA_POST_DIAGNOSTICO_HORAS)

    enfermedad_activa = ControlSanitario.objects.filter(
        lote=registro_mortalidad.lote,
        tipo_registro='enfermedad',
        fecha_registro__gte=inicio_ventana,
        fecha_registro__lte=fecha_mortandad,
    ).exclude(
        estado_enfermedad='resuelto'
    ).order_by('-fecha_registro').first()

    if not enfermedad_activa:
        return None

    registros_anteriores = list(
        RegistroMortalidad.objects.filter(
            lote=registro_mortalidad.lote,
            fecha_hora__lt=registro_mortalidad.fecha_hora,
        ).exclude(
            pk=registro_mortalidad.pk
        ).order_by('-fecha_hora')[:7]
    )

    if not registros_anteriores:
        return None

    promedio_anterior = sum(r.cantidad for r in registros_anteriores) / len(registros_anteriores)

    if promedio_anterior <= 0:
        return None

    incremento = (
        (Decimal(registro_mortalidad.cantidad) - Decimal(str(promedio_anterior)))
        / Decimal(str(promedio_anterior))
    ) * Decimal('100')
    incremento = _redondear(incremento)

    # CP02: 5 -> 6 equivale a 20% exacto, no genera alerta.
    if incremento <= UMBRAL_INCREMENTO_MORTANDAD:
        return None

    alerta_existente = AlertaSanitaria.objects.filter(
        lote=registro_mortalidad.lote,
        registro_enfermedad=enfermedad_activa,
        tipo_alerta='Mortandad',
    ).exclude(estado='Resuelta').exists()

    if alerta_existente:
        return None

    return AlertaSanitaria.objects.create(
        lote=registro_mortalidad.lote,
        registro_enfermedad=enfermedad_activa,
        tipo_alerta='Mortandad',
        nivel='Critico',
        causa='Incremento de mortandad dentro de las 24 horas posteriores al diagnóstico.',
        mensaje=(
            f"Alerta de Mortandad Anormal en Lote {registro_mortalidad.lote_id} "
            f"post-diagnóstico. Se registraron {registro_mortalidad.cantidad} bajas, "
            f"con un incremento de {incremento}% frente al promedio anterior. "
            "Revisar tratamiento y condiciones del lote."
        ),
        porcentaje_detectado=incremento,
        cantidad_detectada=registro_mortalidad.cantidad,
        usuario=usuario,
        empresa_id=registro_mortalidad.empresa_id,
    )


def generar_alerta_por_stock_medicamento(insumo: Insumo, usuario=None, lote=None):
    """
    CU17:
    Genera una alerta sanitaria cuando un medicamento o vacuna queda en
    stock crítico, es decir, stock_actual <= stock_minimo.
    """

    if not insumo:
        return None

    if insumo.tipo not in TIPOS_INSUMO_CRITICO:
        return None

    stock_actual = Decimal(insumo.stock_actual or 0)
    stock_minimo = Decimal(insumo.stock_minimo or 0)

    if stock_actual > stock_minimo:
        return None

    alerta_existente = AlertaSanitaria.objects.filter(
        tipo_alerta='StockMedicamento',
        insumo=insumo,
    ).exclude(estado='Resuelta').first()

    if alerta_existente:
        return None

    return AlertaSanitaria.objects.create(
        lote=lote,
        insumo=insumo,
        tipo_alerta='StockMedicamento',
        nivel='Alto',
        causa='Bajo stock de medicamento crítico.',
        mensaje=(
            f"Alerta Sanitaria: el insumo crítico '{insumo.nombre}' "
            f"tiene stock actual de {stock_actual} {insumo.unidad_medida}, "
            f"igual o menor al stock mínimo permitido de {stock_minimo} {insumo.unidad_medida}. "
            "Se recomienda reabastecer inmediatamente."
        ),
        porcentaje_detectado=None,
        cantidad_detectada=int(stock_actual) if stock_actual == stock_actual.to_integral_value() else None,
        usuario=usuario,
        empresa_id=insumo.empresa_id,
    )
