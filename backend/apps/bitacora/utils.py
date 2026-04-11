import json

from apps.bitacora.models import BitacoraEvento


def _get_client_ip(request):
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

    - No debe romper el flujo si falla el guardado.
    - `detalle` puede ser dict/list/str; se serializa a JSON si aplica.
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
