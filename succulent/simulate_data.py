"""
EcoFlow - Succulent Data Simulator
Simulates IoT sensor devices (GPS + environmental measurements) from users
across Slovenia, sending POST requests to the succulent collection server.

Air quality comes from ARSO monitoring stations (scored with the same EAQI
methodology as frontend/src/utils/environment.js) and temperature from
Open-Meteo. GPS jitter and activity type are randomized since there's no
hardware to read actual movement from.
"""

import math
import os
import time
import random
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

# Some machines (e.g. behind an HTTPS-scanning antivirus proxy) have a
# locally-trusted root cert that isn't in Python's bundled CA list; truststore
# defers to the OS certificate store instead.
import truststore
truststore.inject_into_ssl()

import requests

SUCCULENT_URL = os.getenv("SUCCULENT_URL", "http://localhost:9090") + "/measure"
ARSO_URL = "http://www.arso.gov.si/xml/zrak/ones_zrak_urni_podatki_zadnji.xml"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# ARSO refreshes hourly and Open-Meteo roughly every 15 minutes, but this
# simulator sends a reading every few seconds - refetching real data on every
# reading would be pointless load on free public services.
REAL_DATA_REFRESH_SECONDS = 600

# Simulated sensor locations across Slovenia
LOCATIONS = [
    {"city": "Ljubljana",  "lat": 46.0569, "lng": 14.5058},
    {"city": "Maribor",    "lat": 46.5547, "lng": 15.6459},
    {"city": "Koper",      "lat": 45.5469, "lng": 13.7294},
    {"city": "Celje",      "lat": 46.2313, "lng": 15.2628},
    {"city": "Kranj",      "lat": 46.2392, "lng": 14.3557},
    {"city": "Novo Mesto", "lat": 45.7996, "lng": 15.1715},
    {"city": "Velenje",    "lat": 46.3592, "lng": 15.1113},
    {"city": "Ptuj",       "lat": 46.4199, "lng": 15.8700},
]

ACTIVITY_TYPES = ["WALKING", "CYCLING", "RUNNING"]

# EAQI breakpoints (eea.europa.eu/themes/air/air-quality-index), ported from
# frontend/src/utils/environment.js so scoring matches the rest of the app.
AQI_BAND_SCORES = [95, 80, 65, 45, 25, 10]
AQI_BREAKPOINTS = {
    "pm2.5": [10, 20, 25, 50, 75],
    "pm10": [20, 40, 50, 100, 150],
    "no2": [40, 90, 120, 230, 340],
    "o3": [50, 100, 130, 240, 380],
}


def _pollutant_sub_index(pollutant, concentration):
    if concentration is None:
        return None

    for band, limit in enumerate(AQI_BREAKPOINTS[pollutant]):
        if concentration <= limit:
            return AQI_BAND_SCORES[band]

    return AQI_BAND_SCORES[-1]


def _air_quality_index(station):
    if station is None:
        return None

    sub_indexes = [
        value for value in (
            _pollutant_sub_index(pollutant, station.get(pollutant))
            for pollutant in AQI_BREAKPOINTS
        ) if value is not None
    ]

    # The EAQI convention reports the worst-performing pollutant as the
    # overall index, since that's the one actually driving health risk.
    return min(sub_indexes) if sub_indexes else None


def _haversine_km(lat1, lon1, lat2, lon2):
    radius = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _to_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def fetch_arso_stations():
    """Fetch and parse the real ARSO air-quality feed. Returns [] on failure."""
    try:
        response = requests.get(ARSO_URL, timeout=10)
        if response.status_code != 200:
            return []

        root = ET.fromstring(response.text)
        stations = []

        for postaja in root.findall("postaja"):
            lat = _to_float(postaja.get("wgs84_sirina"))
            lon = _to_float(postaja.get("wgs84_dolzina"))
            if lat is None or lon is None:
                continue

            stations.append({
                "latitude": lat,
                "longitude": lon,
                "pm10": _to_float(postaja.findtext("pm10")),
                "pm2.5": _to_float(postaja.findtext("pm2.5")),
                "no2": _to_float(postaja.findtext("no2")),
                "o3": _to_float(postaja.findtext("o3")),
            })

        return stations
    except (requests.RequestException, ET.ParseError):
        return []


def nearest_air_quality_index(lat, lon, stations, max_km=35):
    """Real EAQI-based score from the nearest real ARSO station, or None if
    no station is within range."""
    nearest, nearest_distance = None, float("inf")

    for station in stations:
        distance = _haversine_km(lat, lon, station["latitude"], station["longitude"])
        if distance < nearest_distance and distance <= max_km:
            nearest, nearest_distance = station, distance

    return _air_quality_index(nearest)


def fetch_real_temperature(lat, lon):
    """Real current temperature from Open-Meteo, or None on failure."""
    try:
        response = requests.get(OPEN_METEO_URL, params={
            "latitude": lat, "longitude": lon, "current": "temperature_2m"
        }, timeout=10)
        if response.status_code != 200:
            return None
        return response.json().get("current", {}).get("temperature_2m")
    except requests.RequestException:
        return None


class RealDataCache:
    """Refreshes real ARSO/Open-Meteo data periodically instead of hitting
    those APIs on every simulated measurement."""

    def __init__(self):
        self._stations = []
        self._temperatures = {}
        self._last_refresh = 0

    def refresh_if_needed(self):
        now = time.time()
        if self._stations and now - self._last_refresh < REAL_DATA_REFRESH_SECONDS:
            return

        print("Refreshing real ARSO + Open-Meteo data...")
        self._stations = fetch_arso_stations()
        self._temperatures = {}

        for location in LOCATIONS:
            temperature = fetch_real_temperature(location["lat"], location["lng"])
            if temperature is not None:
                self._temperatures[location["city"]] = temperature

        self._last_refresh = now
        print(f"  {len(self._stations)} ARSO station(s), "
              f"{len(self._temperatures)}/{len(LOCATIONS)} city temperature(s) loaded.")

    def air_quality_for(self, lat, lon):
        return nearest_air_quality_index(lat, lon, self._stations)

    def temperature_for(self, city):
        return self._temperatures.get(city)


def generate_sensor_reading(location, cache):
    """Generate a sensor reading for a location. Returns None if air quality
    or temperature data isn't available there right now."""
    # Small GPS jitter simulates a device moving around within the city.
    lat = location["lat"] + random.uniform(-0.01, 0.01)
    lng = location["lng"] + random.uniform(-0.01, 0.01)

    activity = random.choice(ACTIVITY_TYPES)

    air_quality = cache.air_quality_for(location["lat"], location["lng"])
    temperature = cache.temperature_for(location["city"])

    if air_quality is None or temperature is None:
        return None

    return {
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "air_quality": air_quality,
        "temperature": temperature,
        "eco_score": air_quality,
        "activity_type": activity,
    }


def send_measurement(data):
    """Send a single measurement to the succulent server."""
    try:
        response = requests.post(SUCCULENT_URL, params=data, timeout=5)
        if response.status_code == 200:
            print(f"[OK] Sent: {data['activity_type']} @ ({data['latitude']}, {data['longitude']}) "
                  f"| eco={data['eco_score']} | air={data['air_quality']} | temp={data['temperature']}C")
        else:
            print(f"[WARN] Server returned {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("[ERROR] Cannot connect to succulent server at", SUCCULENT_URL)
        print("        Make sure succulent is running: python run.py")
    except Exception as e:
        print(f"[ERROR] {e}")


def run_simulation(interval_seconds=3, rounds=None):
    """
    Run the simulation loop.
    interval_seconds: pause between measurements
    rounds: number of rounds (None = run forever)
    """
    print("=" * 60)
    print("  EcoFlow Succulent Data Simulator")
    print(f"  Target: {SUCCULENT_URL}")
    print(f"  Interval: {interval_seconds}s | Locations: {len(LOCATIONS)}")
    print("  Air quality: real ARSO stations | Temperature: real Open-Meteo")
    print("  Press Ctrl+C to stop")
    print("=" * 60)

    cache = RealDataCache()
    count = 0

    try:
        while rounds is None or count < rounds:
            cache.refresh_if_needed()

            location = random.choice(LOCATIONS)
            data = generate_sensor_reading(location, cache)

            if data is None:
                print(f"[SKIP] No real air-quality/temperature data available for {location['city']} right now.")
            else:
                send_measurement(data)

            count += 1
            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        print(f"\n[STOP] Simulation stopped after {count} measurements.")


if __name__ == "__main__":
    rounds_env = os.getenv("SIMULATOR_ROUNDS")
    run_simulation(interval_seconds=3, rounds=int(rounds_env) if rounds_env else None)
