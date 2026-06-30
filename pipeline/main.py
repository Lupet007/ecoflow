import json
import os
from datetime import datetime, timezone

import psycopg2
import requests

COPERNICUS_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$top=5"

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5433")),
    "database": os.getenv("DB_NAME", "ecoflow"),
    "user": os.getenv("DB_USER", "ecoflow"),
    "password": os.getenv("DB_PASSWORD")
}


def fetch_copernicus_products():
    print("Fetching data from Copernicus Data Space API...")

    try:
        response = requests.get(COPERNICUS_URL, timeout=15)
        print("Status:", response.status_code)

        if response.status_code == 200:
            return response.json()

        print("Copernicus API failed. Using local test dataset...")
        return load_test_dataset()

    except requests.RequestException as error:
        print("Copernicus API request error:", error)
        print("Using local test dataset...")
        return load_test_dataset()


def load_test_dataset():
    print("Loading fallback dataset from test_data/sample_data.json")

    with open("test_data/sample_data.json", "r", encoding="utf-8") as file:
        return json.load(file)


def transform_products(raw_data):
    print("Transforming Copernicus data...")

    products = raw_data.get("value", raw_data.get("records", []))
    transformed = []

    for product in products:
        transformed.append({
            "product_id": product.get("Id") or product.get("product_id") or product.get("id"),
            "name": product.get("Name") or product.get("name"),
            "content_type": product.get("ContentType") or product.get("content_type"),
            "content_length": product.get("ContentLength") or product.get("content_length"),
            "origin_date": product.get("OriginDate") or product.get("origin_date"),
            "publication_date": product.get("PublicationDate") or product.get("publication_date")
        })

    return transformed


def create_table_if_not_exists(connection):
    print("Creating table if it does not exist...")

    query = """
    CREATE TABLE IF NOT EXISTS copernicus_products (
        id SERIAL PRIMARY KEY,
        product_id VARCHAR(255) UNIQUE NOT NULL,
        name TEXT,
        content_type VARCHAR(255),
        content_length BIGINT,
        origin_date TIMESTAMP NULL,
        publication_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """

    with connection.cursor() as cursor:
        cursor.execute(query)

    connection.commit()


def save_to_database(products):
    print("Saving transformed data to PostgreSQL...")

    if not DB_CONFIG["password"]:
        print("DB_PASSWORD environment variable is not set. Skipping database save.")
        return

    connection = psycopg2.connect(**DB_CONFIG)

    try:
        create_table_if_not_exists(connection)

        insert_query = """
        INSERT INTO copernicus_products (
            product_id,
            name,
            content_type,
            content_length,
            origin_date,
            publication_date
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (product_id) DO UPDATE SET
            name = EXCLUDED.name,
            content_type = EXCLUDED.content_type,
            content_length = EXCLUDED.content_length,
            origin_date = EXCLUDED.origin_date,
            publication_date = EXCLUDED.publication_date;
        """

        with connection.cursor() as cursor:
            for product in products:
                if product["product_id"] is not None:
                    cursor.execute(insert_query, (
                        product["product_id"],
                        product["name"],
                        product["content_type"],
                        product["content_length"],
                        product["origin_date"],
                        product["publication_date"]
                    ))

        connection.commit()
        print("Processed records:", len(products))

    finally:
        connection.close()


def save_to_json(data):
    output = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "Copernicus Data Space Ecosystem API",
        "records_count": len(data),
        "records": data
    }

    os.makedirs("data", exist_ok=True)

    with open("data/copernicus_products.json", "w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=4)

    print("Saved JSON file: data/copernicus_products.json")


def main():
    print("EcoFlow data pipeline started")
    print("Started at:", datetime.now(timezone.utc).isoformat())

    raw_data = fetch_copernicus_products()
    transformed_data = transform_products(raw_data)

    save_to_json(transformed_data)
    save_to_database(transformed_data)

    print("Pipeline finished successfully")


if __name__ == "__main__":
    main()