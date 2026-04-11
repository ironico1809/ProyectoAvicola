"""Utilidades de la app `bitacora`.

Este módulo se importa desde otras apps para registrar eventos sin repetir código.

Regla importante: la bitácora nunca debe tumbar un request.
Por eso se atrapan excepciones internamente.
"""

import json

from apps.bitacora.models import BitacoraEvento


def _get_client_ip(request):
    """Extrae la IP del cliente desde el request.

    - Entrada: `request` de Django/DRF (o None).
    - Salida: string con IP o None.
    """
    if not request:
        return None

    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        # puede venir: "ip1, ip2, ip3"
        return xff.split(',')[0].strip() or None
    return request.META.get('REMOTE_ADDR')


def registrar_evento(
    request,
    *,
    accion,
    modulo,
    entidad=None,
    entidad_id=None,
    detalle=None,
    usuario=None,
):
    """Registra un evento de bitácora.

        - Entrada:
            - `request`: request actual (para method/path/IP/UA) o None.
            - `accion`/`modulo`: strings obligatorios para clasificar el evento.
            - `entidad`/`entidad_id`: opcional, para indicar qué objeto se afectó.
            - `detalle`: dict/list/str opcional (se serializa a JSON si aplica).
            - `usuario`: actor explícito (si no se pasa, se intenta usar `request.user`).

        - Salida: None (efecto secundario: crea un registro en DB).

        Garantías:
        - No debe romper el flujo si falla el guardado (cualquier excepción se ignora).
    """

    try:
        actor = usuario
        if actor is None and request is not None:
            actor = getattr(request, 'user', None)

        nom_usuario = None
        if actor is not None:
            nom_usuario = getattr(actor, 'nom_usuario', None) or str(actor)

        detalle_txt = None
        if detalle is not None:
            if isinstance(detalle, (dict, list)):
                detalle_txt = json.dumps(detalle, ensure_ascii=False)
            else:
                detalle_txt = str(detalle)

        BitacoraEvento.objects.create(
            usuario=actor if getattr(actor, 'is_authenticated', False) else None,
            nom_usuario=nom_usuario,
            accion=str(accion),
            modulo=str(modulo),
            entidad=entidad,
            entidad_id=str(entidad_id) if entidad_id is not None else None,
            detalle=detalle_txt,
            metodo=getattr(request, 'method', None),
            path=getattr(request, 'path', None),
            ip=_get_client_ip(request),
            user_agent=(request.META.get('HTTP_USER_AGENT') if request is not None else None),
        )
    except Exception:
        # La bitácora nunca debe tumbar el request
        return
