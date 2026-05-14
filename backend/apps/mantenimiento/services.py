"""Servicio central de backup y restore.

Responsabilidades:
- `generar_backup(tipo)`:  ejecuta dumpdata, comprime con gzip, guarda BackupLog.
- `restaurar_backup(log)`: vacía la BD y carga el archivo json.gz con loaddata.
- `tamano_legible(bytes)`: formatea tamaño a KB / MB.
"""

import gzip
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

# ── Directorio donde se almacenarán los respaldos ────────────────────────────
BACKUP_DIR: Path = getattr(settings, "BACKUP_DIR", Path(settings.BASE_DIR) / "backups")


def _ensure_backup_dir() -> Path:
    """Crea la carpeta de backups si no existe y retorna su ruta."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR


def tamano_legible(num_bytes: int) -> str:
    """Convierte bytes a una cadena legible (KB / MB)."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 ** 2:
        return f"{num_bytes / 1024:.1f} KB"
    else:
        return f"{num_bytes / (1024 ** 2):.2f} MB"


def generar_backup(tipo: str = "MANUAL") -> "BackupLog":  # type: ignore[name-defined]
    """Genera un volcado completo de la base de datos en formato JSON comprimido.

    Pasos:
    1. Ejecuta `manage.py dumpdata` excluyendo tablas internas de Django.
    2. Comprime el resultado con gzip.
    3. Guarda el archivo en BACKUP_DIR.
    4. Registra el evento en BackupLog.

    Retorna: instancia de BackupLog recién creada.
    Lanza: RuntimeError si el comando falla.
    """
    from apps.mantenimiento.models import BackupLog  # import tardío para evitar circular

    directorio = _ensure_backup_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre = f"backup_{tipo.lower()}_{timestamp}.json.gz"
    ruta = directorio / nombre

    # Argumentos de dumpdata: excluimos las tablas de sesión/contenido de Django
    # para que el archivo sea lo más limpio y portable posible.
    cmd = [
        sys.executable, "-m", "django", "dumpdata",
        "--exclude", "contenttypes",
        "--exclude", "auth.permission",
        "--exclude", "sessions.session",
        "--exclude", "admin.logentry",
        "--natural-foreign",
        "--natural-primary",
        "--indent", "2",
    ]

    try:
        resultado = subprocess.run(
            cmd,
            capture_output=True,
            check=True,
            env={**os.environ, "DJANGO_SETTINGS_MODULE": "core.settings"},
        )
    except subprocess.CalledProcessError as exc:
        error_msg = exc.stderr.decode(errors="replace")
        logger.error("dumpdata falló: %s", error_msg)
        raise RuntimeError(f"Error al generar el backup: {error_msg}") from exc

    # Comprimir y guardar
    with gzip.open(ruta, "wb") as f:
        f.write(resultado.stdout)

    tamano = tamano_legible(ruta.stat().st_size)

    log = BackupLog.objects.create(
        nombre_archivo=nombre,
        ruta_archivo=str(ruta),
        tamano=tamano,
        tipo=tipo,
    )
    logger.info("Backup generado: %s (%s)", nombre, tamano)
    return log


def restaurar_backup(backup_log: "BackupLog") -> None:  # type: ignore[name-defined]
    """Restaura el estado de la base de datos desde un BackupLog.

    Pasos:
    1. Verifica que el archivo exista.
    2. Descomprime el .json.gz a un archivo temporal .json.
    3. Ejecuta `manage.py flush --no-input` para vaciar la BD.
    4. Ejecuta `manage.py loaddata` apuntando al .json temporal.
    5. Elimina el .json temporal.

    Lanza: FileNotFoundError si el archivo no existe.
           RuntimeError si flush o loaddata fallan.
    """
    import tempfile

    ruta = Path(backup_log.ruta_archivo)
    if not ruta.exists():
        raise FileNotFoundError(f"El archivo de respaldo no existe: {ruta}")

    # Descomprimir a un archivo temporal
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        ruta_tmp = tmp.name
        with gzip.open(ruta, "rb") as gz:
            tmp.write(gz.read())

    env = {**os.environ, "DJANGO_SETTINGS_MODULE": "core.settings"}

    try:
        # Vaciar la base de datos (preserva estructura de tablas)
        flush_cmd = [sys.executable, "-m", "django", "flush", "--no-input"]
        subprocess.run(flush_cmd, capture_output=True, check=True, env=env)

        # Cargar los datos del backup
        load_cmd = [sys.executable, "-m", "django", "loaddata", ruta_tmp]
        subprocess.run(load_cmd, capture_output=True, check=True, env=env)

    except subprocess.CalledProcessError as exc:
        error_msg = exc.stderr.decode(errors="replace")
        logger.error("Restore falló: %s", error_msg)
        raise RuntimeError(f"Error al restaurar el backup: {error_msg}") from exc
    finally:
        # Siempre limpiar el archivo temporal
        try:
            os.unlink(ruta_tmp)
        except OSError:
            pass

    logger.info("Restore completado desde: %s", backup_log.nombre_archivo)
