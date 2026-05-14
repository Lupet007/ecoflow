# Sprint 2

## Cilj sprinta

Cilj druge iteracije je implementacija osnovnega data pipeline procesa za pridobivanje, transformacijo in pripravo podatkov iz Copernicus Data Space Ecosystem API.

## Načrtovane funkcionalnosti

- Pridobivanje podatkov iz Copernicus API
- Transformacija pridobljenih podatkov
- Shranjevanje transformiranih podatkov
- Priprava strukture za kasnejše shranjevanje v PostgreSQL/PostGIS
- Priprava osnove za periodično osveževanje podatkov

## Trenutno realizirano

- Automated Copernicus data ingestion
- Data transformation and JSON export
- PostgreSQL/PostGIS storage
- Duplicate prevention logic
- Scheduled pipeline refresh
- Fallback dataset support
- Display of Copernicus products in frontend