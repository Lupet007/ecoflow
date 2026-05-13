import requests
import psycopg2
from datetime import datetime

COPERNICUS_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$top=5"

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "ecoflow",
    "user": "ecoflow",
    "password": "ecoflow"
}


def fetch_copernicus_products():
    print("Fetching data from Copernicus Data Space API...")

    response = requests.get(COPERNICUS_URL, timeout=15)
    print("Status:", response.status_code)

    if response.status_code != 200:
        raise Exception("Copernicus API request failed")

    return response.json()


def transform_products(raw_data):
    print("Transforming Copernicus data...")

    products = raw_data.get("value", [])
    transformed = []

    for product in products:
        transformed.append({
            "product_id": product.get("Id"),
            "name": product.get("Name"),
            "content_type": product.get("ContentType"),
            "content_length": product.get("ContentLength"),
            "origin_date": product.get("OriginDate"),
            "publication_date": product.get("PublicationDate")
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


def main():
    print("EcoFlow data pipeline started")
    print("Started at:", datetime.now().isoformat())

    raw_data = fetch_copernicus_products()
    transformed_data = transform_products(raw_data)
    save_to_database(transformed_data)

    print("Pipeline finished successfully")


if __name__ == "__main__":
    main()