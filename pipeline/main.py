import requests
import json
from datetime import datetime

COPERNICUS_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$top=5"

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
            "id": product.get("Id"),
            "name": product.get("Name"),
            "content_type": product.get("ContentType"),
            "content_length": product.get("ContentLength"),
            "origin_date": product.get("OriginDate"),
            "publication_date": product.get("PublicationDate")
        })

    return transformed


def save_to_json(data):
    print("Saving transformed data to JSON file...")

    output = {
        "created_at": datetime.now().isoformat(),
        "source": "Copernicus Data Space Ecosystem API",
        "records_count": len(data),
        "records": data
    }

    with open("data/copernicus_products.json", "w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=4)

    print("Saved file: data/copernicus_products.json")


def main():
    print("EcoFlow data pipeline started")

    raw_data = fetch_copernicus_products()
    transformed_data = transform_products(raw_data)
    save_to_json(transformed_data)

    print("Pipeline finished successfully")


if __name__ == "__main__":
    main()