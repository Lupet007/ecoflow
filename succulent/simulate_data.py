"""
EcoFlow - Succulent Data Simulator
Simulates IoT sensor data (GPS + environmental measurements) from users
across Slovenia, sending POST requests to the succulent collection server.
"""

import requests
import time
import random

SUCCULENT_URL = "http://localhost:9090/measure"

# Simulated sensor locations across Slovenia (city, lat, lng)
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


def generate_sensor_reading(location):
    """Generate a realistic sensor reading for a given location."""
    # Add small GPS jitter to simulate movement
    lat = location["lat"] + random.uniform(-0.01, 0.01)
    lng = location["lng"] + random.uniform(-0.01, 0.01)

    # Environmental values — vary by activity and randomness
    activity = random.choice(ACTIVITY_TYPES)
    air_quality = round(random.uniform(30, 95), 1)
    temperature = round(random.uniform(10, 28), 1)

    # Eco score influenced by air quality and activity
    base_score = air_quality * 0.6 + random.uniform(10, 30)
    if activity == "WALKING":
        base_score += 5
    elif activity == "RUNNING":
        base_score += 3
    elif activity == "CYCLING":
        base_score += 1
    eco_score = round(min(base_score, 100), 1)

    return {
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "air_quality": air_quality,
        "temperature": temperature,
        "eco_score": eco_score,
        "activity_type": activity,
    }


def send_measurement(data):
    """Send a single measurement to the succulent server."""
    try:
        response = requests.post(SUCCULENT_URL, params=data, timeout=5)
        if response.status_code == 200:
            print(f"[OK] Sent: {data['activity_type']} @ ({data['latitude']}, {data['longitude']}) "
                  f"| eco={data['eco_score']} | air={data['air_quality']}")
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
    print("  Press Ctrl+C to stop")
    print("=" * 60)

    count = 0
    try:
        while rounds is None or count < rounds:
            # Pick a random location for this measurement
            location = random.choice(LOCATIONS)
            data = generate_sensor_reading(location)
            send_measurement(data)
            count += 1
            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        print(f"\n[STOP] Simulation stopped after {count} measurements.")


if __name__ == "__main__":
    run_simulation(interval_seconds=3)
