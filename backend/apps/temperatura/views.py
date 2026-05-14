import random
import os
import requests as http_requests

from django.utils import timezone
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.galpones.models import Galpon
from apps.temperatura.models import TemperaturaGalpon
from apps.temperatura.serializers import TemperaturaGalponSerializer
from apps.bitacora.utils import registrar_evento

# ─────────────────────────────────────────────────────────────────────────────
# WeatherManager: gestiona la base real de temperatura por galpón
# ─────────────────────────────────────────────────────────────────────────────

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")


class WeatherManager:
    """
    Gestiona el estado del monitoreo meteorológico por galpón.

    Cada galpón tiene su propia base de temperatura real obtenida de
    OpenWeatherMap. A partir de esa base se aplica una fluctuación
    aleatoria pequeña para simular variaciones de sensor.
    """

    def __init__(self):
        # { galpon_id: { base_temp, base_humidity } }
        self._bases: dict = {}
        # { galpon_id: { temp, humidity } }  — overrides por galpón
        self._manual_overrides: dict = {}

    def fetch_real_base(self, galpon_id: int, lat: float, lon: float) -> dict:
        """
        Llama a OpenWeatherMap UNA SOLA VEZ para obtener la temperatura
        real del lugar y la guarda como base para ese galpón.
        """
        url = (
            f"https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
        )
        try:
            resp = http_requests.get(url, timeout=5)
            data = resp.json()
            base_temp = float(data["main"]["temp"])
            base_humidity = float(data["main"]["humidity"])
        except Exception:
            # Valores de respaldo si falla la conexión
            base_temp = 28.0
            base_humidity = 60.0

        self._bases[galpon_id] = {
            "base_temp": base_temp,
            "base_humidity": base_humidity,
        }
        return {"base_temp": base_temp, "base_humidity": base_humidity}

    def get_current_data(self, galpon_id: int) -> dict:
        """
        Devuelve la temperatura actual para un galpón.

        - Si ese galpón tiene un override manual, lo devuelve.
        - Si no, aplica fluctuación ±0.2°C sobre la base real.
        """
        if galpon_id in self._manual_overrides:
            override = self._manual_overrides[galpon_id]
            return {
                "temp": override["temp"],
                "humidity": override["humidity"],
                "source": "manual_override",
            }

        if galpon_id not in self._bases:
            temp = generar_temperatura_simulada()
            return {"temp": temp, "humidity": 60.0, "source": "simulated_fallback"}

        entry = self._bases[galpon_id]
        entry["base_temp"] += random.uniform(-0.2, 0.2)
        entry["base_humidity"] += random.uniform(-0.5, 0.5)
        return {
            "temp": round(entry["base_temp"], 2),
            "humidity": round(entry["base_humidity"], 1),
            "source": "simulated_real_base",
        }

    def set_manual_override(self, galpon_id: int, temp: float, humidity: float) -> None:
        """Fuerza un valor para un galpón específico."""
        self._manual_overrides[galpon_id] = {"temp": temp, "humidity": humidity}

    def clear_manual_override(self, galpon_id: int) -> None:
        """Elimina el override de un galpón, volviendo a la simulación."""
        self._manual_overrides.pop(galpon_id, None)

    def has_base(self, galpon_id: int) -> bool:
        return galpon_id in self._bases


# Instancia global (vive mientras el proceso Django esté activo)
weather_service = WeatherManager()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def calcular_estado_temperatura(temperatura):
    """
    Calcula el estado de la temperatura.

    Regla del sistema:
    - Menor a 24°C: FRIO
    - Entre 24°C y 34°C: NORMAL
    - Mayor a 34°C: CALOR
    """
    temperatura = float(temperatura)

    if temperatura < 24:
        return 'FRIO'

    if temperatura > 34:
        return 'CALOR'

    return 'NORMAL'


def generar_temperatura_simulada():
    """
    Genera una temperatura simulada según la hora del día.
    """
    hora_actual = timezone.localtime().hour

    if hora_actual >= 20 or hora_actual < 6:
        temperatura = random.uniform(22, 27)
    elif 6 <= hora_actual < 12:
        temperatura = random.uniform(24, 30)
    else:
        temperatura = random.uniform(30, 38)

    return round(temperatura, 2)


def obtener_mensaje_estado(estado):
    """Devuelve un mensaje entendible para el frontend."""
    if estado == 'FRIO':
        return 'Alerta de frío: la temperatura está por debajo del rango recomendado.'
    if estado == 'CALOR':
        return 'Alerta de calor: la temperatura está por encima del rango recomendado.'
    if estado == 'NORMAL':
        return 'Temperatura dentro del rango normal.'
    return 'Sin información de temperatura.'


# ─────────────────────────────────────────────────────────────────────────────
# Vistas existentes
# ─────────────────────────────────────────────────────────────────────────────

class TemperaturaTiempoRealView(APIView):
    """
    CU09 - Monitorear temperatura en tiempo real.

    Endpoint:
    GET /temperatura/tiempo-real/

    Usa el WeatherManager si el galpón tiene coordenadas registradas
    (base real de OpenWeather). Si no, cae en simulación por hora.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        galpones = Galpon.objects.filter(estado='activo').order_by('id')

        data = []

        for galpon in galpones:
            clima = weather_service.get_current_data(galpon.id)
            temperatura = clima["temp"]
            estado = calcular_estado_temperatura(temperatura)

            registro = TemperaturaGalpon.objects.create(
                galpon=galpon,
                temperatura=temperatura,
                estado=estado,
                fuente='SIMULADO'
            )

            data.append({
                'id': registro.id,
                'id_galpon': galpon.id,
                'galpon_nombre': galpon.nombre,
                'temperatura': registro.temperatura,
                'estado': registro.estado,
                'fuente': registro.fuente,
                'fecha_hora': registro.fecha_hora,
                'alerta': estado in ['FRIO', 'CALOR'],
                'mensaje': obtener_mensaje_estado(estado),
                'source': clima.get('source', 'simulated_fallback'),
            })

        return Response(data, status=status.HTTP_200_OK)


class TemperaturaManualCreateView(APIView):
    """
    CU08 - Registrar temperatura del galpón manualmente.

    Endpoint:
    POST /temperatura/manual/
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TemperaturaGalponSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        galpon = serializer.validated_data['galpon']
        temperatura = serializer.validated_data['temperatura']
        estado = calcular_estado_temperatura(temperatura)

        registro = TemperaturaGalpon.objects.create(
            galpon=galpon,
            temperatura=temperatura,
            estado=estado,
            fuente='MANUAL',
            usuario=request.user,
        )

        registrar_evento(
            request,
            accion='crear',
            modulo='temperatura',
            entidad='TemperaturaGalpon',
            entidad_id=registro.id,
            entidad_nombre=f"Temperatura {registro.temperatura}°C - {galpon.nombre}",
            detalle={
                'id_galpon': galpon.id,
                'galpon': galpon.nombre,
                'temperatura': registro.temperatura,
                'estado': registro.estado,
                'fuente': registro.fuente,
                'usuario_id': request.user.id,
                'usuario': request.user.nom_usuario,
            },
            usuario=request.user,
        )

        return Response(
            TemperaturaGalponSerializer(registro).data,
            status=status.HTTP_201_CREATED
        )


class TemperaturaHistorialView(APIView):
    """
    Consulta el historial de temperaturas.

    Endpoint:
    GET /temperatura/historial/

    Filtros opcionales: id_galpon, fecha_inicio, fecha_fin
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = TemperaturaGalpon.objects.select_related('galpon').all()

        id_galpon = request.query_params.get('id_galpon')
        fecha_inicio_raw = request.query_params.get('fecha_inicio')
        fecha_fin_raw = request.query_params.get('fecha_fin')

        if id_galpon:
            queryset = queryset.filter(galpon_id=id_galpon)

        if fecha_inicio_raw:
            fecha_inicio = parse_date(fecha_inicio_raw)
            if fecha_inicio is None:
                return Response(
                    {'fecha_inicio': 'Formato inválido. Use YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            queryset = queryset.filter(fecha_hora__date__gte=fecha_inicio)

        if fecha_fin_raw:
            fecha_fin = parse_date(fecha_fin_raw)
            if fecha_fin is None:
                return Response(
                    {'fecha_fin': 'Formato inválido. Use YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            queryset = queryset.filter(fecha_hora__date__lte=fecha_fin)

        queryset = queryset.order_by('-fecha_hora', '-id')[:100]

        return Response(
            TemperaturaGalponSerializer(queryset, many=True).data,
            status=status.HTTP_200_OK
        )


class TemperaturaUltimaPorGalponView(APIView):
    """
    Devuelve la última temperatura registrada por cada galpón.

    Endpoint:
    GET /temperatura/ultimas/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        galpones = Galpon.objects.all().order_by('id')
        data = []

        for galpon in galpones:
            ultimo = (
                TemperaturaGalpon.objects
                .filter(galpon=galpon)
                .order_by('-fecha_hora', '-id')
                .first()
            )

            if ultimo:
                data.append({
                    'id_galpon': galpon.id,
                    'galpon_nombre': galpon.nombre,
                    'temperatura': ultimo.temperatura,
                    'estado': ultimo.estado,
                    'fuente': ultimo.fuente,
                    'fecha_hora': ultimo.fecha_hora,
                    'alerta': ultimo.estado in ['FRIO', 'CALOR'],
                    'mensaje': obtener_mensaje_estado(ultimo.estado),
                })
            else:
                data.append({
                    'id_galpon': galpon.id,
                    'galpon_nombre': galpon.nombre,
                    'temperatura': None,
                    'estado': 'SIN_DATOS',
                    'fuente': None,
                    'fecha_hora': None,
                    'alerta': False,
                    'mensaje': 'Todavía no hay registros de temperatura.',
                })

        return Response(data, status=status.HTTP_200_OK)


class TemperaturaAlertasView(APIView):
    """
    Endpoint global para detectar alertas de temperatura.

    Endpoint:
    GET /temperatura/alertas/

    Lee el ÚLTIMO registro real de cada galpón activo.
    Solo incluye registros con estado FRIO o CALOR.
    """

    TEMP_MIN = 0
    TEMP_MAX = 60

    permission_classes = [IsAuthenticated]

    def get(self, request):
        galpones = Galpon.objects.filter(estado='activo').order_by('id')

        alertas = []

        for galpon in galpones:
            ultimo = (
                TemperaturaGalpon.objects
                .filter(galpon=galpon)
                .order_by('-fecha_hora', '-id')
                .first()
            )

            if not ultimo:
                continue

            temp_float = float(ultimo.temperatura)

            if temp_float < self.TEMP_MIN or temp_float > self.TEMP_MAX:
                continue

            estado_real = calcular_estado_temperatura(temp_float)

            if estado_real not in ('FRIO', 'CALOR'):
                continue

            alertas.append({
                'id': ultimo.id,
                'id_galpon': galpon.id,
                'galpon_nombre': galpon.nombre,
                'temperatura': ultimo.temperatura,
                'estado': estado_real,
                'fecha_hora': ultimo.fecha_hora,
                'alerta': True,
                'mensaje': obtener_mensaje_estado(estado_real),
            })

        return Response(alertas, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Nuevos endpoints: Reverse Geocoding + Simulación con base real
# ─────────────────────────────────────────────────────────────────────────────

class ReverseGeocodingView(APIView):
    """
    Convierte coordenadas (lat, lon) en un nombre de lugar legible.

    Endpoint:
    GET /temperatura/reverse-geocoding/?lat=-17.78&lon=-63.18

    La llamada a OpenWeather se hace desde el backend para no exponer
    la API key en el JavaScript del cliente.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')

        if not lat or not lon:
            return Response(
                {'error': 'Se requieren los parámetros lat y lon.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except ValueError:
            return Response(
                {'error': 'lat y lon deben ser números válidos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        url = (
            f"http://api.openweathermap.org/geo/1.0/reverse"
            f"?lat={lat_f}&lon={lon_f}&limit=1&appid={OPENWEATHER_API_KEY}"
        )

        try:
            resp = http_requests.get(url, timeout=5)
            data = resp.json()

            if data and isinstance(data, list) and len(data) > 0:
                lugar = data[0]
                nombre = lugar.get('name', '')
                estado_lugar = lugar.get('state', '')
                pais = lugar.get('country', '')
                partes = [p for p in [nombre, estado_lugar] if p]
                nombre_completo = ', '.join(partes)
                if pais:
                    nombre_completo += f' ({pais})'
            else:
                nombre_completo = 'Ubicación desconocida'

        except Exception as e:
            nombre_completo = 'Ubicación desconocida'

        return Response({
            'nombre': nombre_completo,
            'lat': lat_f,
            'lon': lon_f,
        }, status=status.HTTP_200_OK)


class SimulacionIniciarView(APIView):
    """
    Inicia el monitoreo con base real de OpenWeather para un galpón.

    Endpoint:
    POST /temperatura/simulacion/iniciar/

    Body: { "galpon_id": 1, "lat": -17.78, "lon": -63.18 }

    Llama a OpenWeather UNA SOLA VEZ y guarda la temperatura base
    en el WeatherManager global. Los siguientes polls de tiempo-real
    usarán esa base con fluctuación ±0.2°C.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        galpon_id = request.data.get('galpon_id')
        lat = request.data.get('lat')
        lon = request.data.get('lon')

        if not galpon_id or lat is None or lon is None:
            return Response(
                {'error': 'Se requieren galpon_id, lat y lon.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            galpon = Galpon.objects.get(pk=galpon_id)
        except Galpon.DoesNotExist:
            return Response(
                {'error': 'Galpón no encontrado.'},
                status=status.HTTP_404_NOT_FOUND
            )

        resultado = weather_service.fetch_real_base(
            galpon_id=galpon.id,
            lat=float(lat),
            lon=float(lon),
        )

        return Response({
            'status': 'Monitoreo iniciado con base real',
            'galpon': galpon.nombre,
            'base_temp': resultado['base_temp'],
            'base_humidity': resultado['base_humidity'],
        }, status=status.HTTP_200_OK)


class ClimaActualView(APIView):
    """
    Devuelve la temperatura actual del WeatherManager sin guardar en BD.

    Endpoint:
    GET /temperatura/clima/actual/?galpon_id=1

    Útil para el panel de operador que quiere ver el valor en tiempo real
    sin generar un registro nuevo en la base de datos.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        galpon_id_raw = request.query_params.get('galpon_id')

        if not galpon_id_raw:
            return Response(
                {'error': 'Se requiere el parámetro galpon_id.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            galpon_id = int(galpon_id_raw)
        except ValueError:
            return Response(
                {'error': 'galpon_id debe ser un número entero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        clima = weather_service.get_current_data(galpon_id)
        estado = calcular_estado_temperatura(clima['temp'])

        return Response({
            'galpon_id': galpon_id,
            'temp': clima['temp'],
            'humidity': clima['humidity'],
            'source': clima['source'],
            'estado': estado,
            'alerta': estado in ('FRIO', 'CALOR'),
            'mensaje': obtener_mensaje_estado(estado),
        }, status=status.HTTP_200_OK)


class ClimaManualOverrideView(APIView):
    """
    Fuerza un valor de temperatura en el WeatherManager para un galpón específico.

    Endpoint:
    POST /temperatura/clima/manual/

    Body activar:   { "galpon_id": 1, "temp": 35, "humidity": 70 }
    Body desactivar: { "galpon_id": 1, "desactivar": true }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        galpon_id_raw = request.data.get('galpon_id')
        desactivar = request.data.get('desactivar', False)

        if not galpon_id_raw:
            return Response(
                {'error': 'Se requiere galpon_id.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            galpon_id = int(galpon_id_raw)
        except (ValueError, TypeError):
            return Response(
                {'error': 'galpon_id debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if desactivar:
            weather_service.clear_manual_override(galpon_id)
            return Response(
                {'status': 'Override eliminado. Volviendo a simulación.'},
                status=status.HTTP_200_OK
            )

        temp = request.data.get('temp')
        humidity = request.data.get('humidity', 60)

        if temp is None:
            return Response(
                {'error': 'Se requiere el campo temp.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            temp_f = float(temp)
            humidity_f = float(humidity)
        except (ValueError, TypeError):
            return Response(
                {'error': 'temp y humidity deben ser números.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if temp_f < 0 or temp_f > 60:
            return Response(
                {'error': 'La temperatura debe estar entre 0°C y 60°C.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        weather_service.set_manual_override(galpon_id, temp_f, humidity_f)
        estado = calcular_estado_temperatura(temp_f)

        return Response({
            'status': 'Override activado para el galpón',
            'galpon_id': galpon_id,
            'temp': temp_f,
            'humidity': humidity_f,
            'estado': estado,
            'alerta': estado in ('FRIO', 'CALOR'),
            'mensaje': obtener_mensaje_estado(estado),
        }, status=status.HTTP_200_OK)
