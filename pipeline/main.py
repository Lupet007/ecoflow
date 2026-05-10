import requests

URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$top=1"

def main():

    print("EcoFlow data pipeline started")
    print("Testing Copernicus Data Space API connection...")

    response = requests.get(URL, timeout=15)

    print("Status:", response.status_code)

    if response.status_code == 200:
        print("Copernicus API connection successful")

        data = response.json()

        if "value" in data:
            print("Products received:", len(data["value"]))
        else:
            print("No products returned")

    else:
        print("Copernicus API connection failed")

if __name__ == "__main__":
    main()