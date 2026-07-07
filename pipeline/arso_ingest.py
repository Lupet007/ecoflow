import json
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import psycopg2
import requests

ARSO_URL = "https://www.arso.gov.si/xml/zrak/ones_zrak_urni_podatki_zadnji.xml"

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5433")),
    "database": os.getenv("DB_NAME", "ecoflow"),
    "user": os.getenv("DB_USER", "ecoflow"),
    "password": os.getenv("DB_PASSWORD")
}


def fetch_arso_data():
    print("Fetching air quality data from ARSO...")

    try:
        response = requests.get(ARSO_URL, timeout=15)
        print("Status:", response.status_code)

        if response.status_code == 200:
            return response.text

        print("ARSO API failed. Using local test dataset...")
        return load_test_dataset()

    except requests.RequestException as error:
        print("ARSO API request error:", error)
        print("Using local test dataset...")
        return load_test_dataset()


def load_test_dataset():
    print("Loading fallback dataset from test_data/arso_sample.xml")

    with open("test_data/arso_sample.xml", "r", encoding="utf-8") as file:
        return file.read()


def _to_float(value):
    if value is None:
        return None

    try:
        return float(value)
    except ValueError:
        return None


def _to_datetime(value):
    if value is None:
        return None

    try:
        return datetime.strptime(value, "%Y-%m-%d %H:%M")
    except ValueError:
        return None


def transform_stations(raw_xml):
    print("Transforming ARSO air quality data...")

    root = ET.fromstring(raw_xml)
    stations = []

    for postaja in root.findall("postaja"):
        latitude = _to_float(postaja.get("wgs84_sirina"))
        longitude = _to_float(postaja.get("wgs84_dolzina"))

        if latitude is None or longitude is None:
            continue

        stations.append({
            "station_code": postaja.get("sifra"),
            "station_name": postaja.findtext("merilno_mesto"),
            "latitude": latitude,
            "longitude": longitude,
            "measured_from": _to_datetime(postaja.findtext("datum_od")),
            "measured_to": _to_datetime(postaja.findtext("datum_do")),
            "pm10": _to_float(postaja.findtext("pm10")),
            "pm2_5": _to_float(postaja.findtext("pm2.5")),
            "no2": _to_float(postaja.findtext("no2")),
            "o3": _to_float(postaja.findtext("o3")),
            "co": _to_float(postaja.findtext("co")),
            "so2": _to_float(postaja.findtext("so2"))
        })

    return stations


def create_table_if_not_exists(connection):
    print("Creating table if it does not exist...")

    query = """
    CREATE TABLE IF NOT EXISTS arso_air_quality (
        id SERIAL PRIMARY KEY,
        station_code VARCHAR(50) NOT NULL,
        station_name TEXT,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        measured_from TIMESTAMP NOT NULL,
        measured_to TIMESTAMP,
        pm10 DOUBLE PRECISION,
        pm2_5 DOUBLE PRECISION,
        no2 DOUBLE PRECISION,
        o3 DOUBLE PRECISION,
        co DOUBLE PRECISION,
        so2 DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (station_code, measured_from)
    );
    """

    with connection.cursor() as cursor:
        cursor.execute(query)

    connection.commit()


def save_to_database(stations):
    print("Saving transformed data to PostgreSQL...")

    if not DB_CONFIG["password"]:
        print("DB_PASSWORD environment variable is not set. Skipping database save.")
        return

    connection = psycopg2.connect(**DB_CONFIG)

    try:
        create_table_if_not_exists(connection)

        insert_query = """
        INSERT INTO arso_air_quality (
            station_code,
            station_name,
            latitude,
            longitude,
            measured_from,
            measured_to,
            pm10,
            pm2_5,
            no2,
            o3,
            co,
            so2
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (station_code, measured_from) DO UPDATE SET
            station_name = EXCLUDED.station_name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            measured_to = EXCLUDED.measured_to,
            pm10 = EXCLUDED.pm10,
            pm2_5 = EXCLUDED.pm2_5,
            no2 = EXCLUDED.no2,
            o3 = EXCLUDED.o3,
            co = EXCLUDED.co,
            so2 = EXCLUDED.so2;
        """

        with connection.cursor() as cursor:
            for station in stations:
                if station["station_code"] is not None and station["measured_from"] is not None:
                    cursor.execute(insert_query, (
                        station["station_code"],
                        station["station_name"],
                        station["latitude"],
                        station["longitude"],
                        station["measured_from"],
                        station["measured_to"],
                        station["pm10"],
                        station["pm2_5"],
                        station["no2"],
                        station["o3"],
                        station["co"],
                        station["so2"]
                    ))

        connection.commit()
        print("Processed records:", len(stations))

    finally:
        connection.close()


def save_to_json(stations):
    output = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "ARSO - Agencija RS za okolje",
        "records_count": len(stations),
        "records": [
            {**station,
             "measured_from": station["measured_from"].isoformat() if station["measured_from"] else None,
             "measured_to": station["measured_to"].isoformat() if station["measured_to"] else None}
            for station in stations
        ]
    }

    os.makedirs("data", exist_ok=True)

    with open("data/arso_air_quality.json", "w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=4)

    print("Saved JSON file: data/arso_air_quality.json")


def main():
    print("EcoFlow ARSO air quality pipeline started")
    print("Started at:", datetime.now(timezone.utc).isoformat())

    raw_data = fetch_arso_data()
    stations = transform_stations(raw_data)

    save_to_json(stations)
    save_to_database(stations)

    print("ARSO pipeline finished successfully")


if __name__ == "__main__":
    main()
