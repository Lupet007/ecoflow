# EcoFlow

## Pregled projekta

EcoFlow je spletna platforma za vizualizacijo in analizo kakovosti okolja v Sloveniji. Sistem združuje javno dostopne okoljske podatke, satelitske meritve ter analizo GPS poti z namenom priporočanja ekološko najprimernejših rekreativnih poti uporabnikom.

Glavni cilj projekta je spodbujanje trajnostne mobilnosti in povečanje ozaveščenosti o kakovosti zraka s pomočjo interaktivnih zemljevidov, prostorskih analiz in inteligentnega priporočilnega sistema.

Projekt se razvija v okviru učne enote *Projekt (IPT UN – 3. letnik)* na Fakulteti za elektrotehniko, računalništvo in informatiko Univerze v Mariboru.

---

## Projektna ekipa

### Ekipa EcoFlow

| Ime in priimek       | Področje dela                         |
| -------------------- | ------------------------------------- |
| Kristijan Stefanoski | Backend razvoj, sistemska arhitektura |
| Anastasija Necoska   | Frontend razvoj, uporabniški vmesnik  |
| Luka Kitanovski      | Data pipeline in integracija API-jev  |
| Aleksa Vucinic       | Podatkovna baza in infrastruktura     |

---

## Namen projekta

Projekt rešuje problem omejene dostopnosti in interpretacije okoljskih podatkov za običajne uporabnike. Obstoječe rešitve večinoma prikazujejo zgolj surove meritve ali statične analize, medtem ko EcoFlow omogoča praktična priporočila glede na trenutne okoljske razmere.

Sistem uporabnikom omogoča:

* pregled okoljskih podatkov na interaktivnem zemljevidu,
* analizo kakovosti zraka v izbranih regijah,
* uvoz in obdelavo GPX poti,
* izračun »eco-score« vrednosti za posamezne poti,
* priporočanje okoljsko primernejših poti,
* spremljanje zgodovinskih trendov preko analitičnega dashboarda.

---

## Glavni funkcionalni sklopi

### 1. Data Pipeline

Data pipeline je odgovoren za pridobivanje, transformacijo, validacijo in shranjevanje okoljskih podatkov iz zunanjih virov.

Glavne funkcionalnosti:

* povezava s Copernicus Data Space Ecosystem API,
* povezava z ARSO odprtimi podatki,
* avtomatsko čiščenje in transformacija podatkov,
* periodično osveževanje podatkov,
* priprava prostorskih podatkov za nadaljnjo analizo.

---

### 2. Core aplikacija

Core aplikacija predstavlja glavni uporabniški del sistema.

Glavne funkcionalnosti:

* interaktivni zemljevid z uporabo knjižnice Leaflet,
* filtriranje okoljskih podatkov po času in tipu onesnaževal,
* registracija in prijava uporabnikov,
* uvoz in shranjevanje GPX poti,
* pregled zgodovine aktivnosti uporabnikov.

---

### 3. Priporočilni sistem

Priporočilni sistem analizira uporabniške poti in okoljske podatke ter izračuna primernost poti glede na kakovost okolja.

Glavne funkcionalnosti:

* analiza poti glede na okoljske razmere,
* izračun eco-score vrednosti,
* priporočanje najprimernejših poti,
* personalizacija priporočil glede na profil uporabnika.

---

### 4. Analitični dashboard

Dashboard omogoča pregled zgodovinskih in statističnih podatkov o kakovosti okolja.

Glavne funkcionalnosti:

* prikaz zgodovinskih trendov,
* primerjava regij,
* statistične analize,
* prikaz heatmap vizualizacij.

---

## Sistemska arhitektura

Arhitektura sistema je razdeljena na več neodvisnih komponent, kar omogoča boljšo modularnost, vzdrževanje in razširljivost sistema.

Glavne komponente:

* React frontend aplikacija,
* Spring Boot backend REST API,
* PostgreSQL/PostGIS podatkovna baza,
* Python data pipeline,
* zunanji okoljski API-ji.

Dodatna arhitekturna dokumentacija in UML diagrami se nahajajo v mapi `/docs`.

---

## Tehnološki sklad

### Frontend

* React
* Vite
* Leaflet

### Backend

* Spring Boot
* REST API
* JWT avtentikacija

### Podatkovna baza

* PostgreSQL
* PostGIS

### Obdelava podatkov

* Python
* Pandas
* Requests

### Zbiranje podatkov z naprav

* Succulent (Python framework za zbiranje podatkov prek HTTP POST)

### DevOps in infrastruktura

* Docker
* Docker Compose

---

## Zunanji viri podatkov

Projekt uporablja javno dostopne okoljske in geografske vire podatkov:

* Copernicus Data Space Ecosystem API
* GPX/TCX datoteke
* Succulent — zbiranje podatkov z IoT naprav (GPS, senzorji okolja)

---

## Metodologija razvoja

Projekt temelji na agilni Scrum metodologiji z eno-tedenskimi sprint iteracijami.

Pri razvoju uporabljamo:

* GitHub Issues,
* Kanban board,
* sprint planiranje,
* UML dokumentacijo,
* iterativni razvoj in testiranje.

---

## Načrtovane iteracije

### Iteracija 1

* vzpostavitev frontend in backend okolja,
* nastavitev podatkovne baze,
* priprava osnovnega REST API,
* testna povezava na zunanje API-je,
* priprava arhitekture sistema.

### Iteracija 2

* implementacija data pipeline,
* pridobivanje in transformacija podatkov,
* shranjevanje okoljskih podatkov,
* periodično osveževanje podatkov.

### Iteracija 3

* razvoj interaktivnega zemljevida,
* prikaz okoljskih podatkov,
* implementacija filtrov,
* osnovni uporabniški sistem.

### Iteracija 4

* implementacija GPX uvoza,
* analiza poti,
* povezava poti z okoljskimi podatki,
* osnovni priporočilni sistem.

### Iteracija 5

* personalizacija priporočil,
* razvoj dashboarda,
* optimizacija sistema,
* testiranje in priprava predstavitve.

---

## Struktura projekta

```text
ecoflow/
│
├── frontend/
├── backend/
├── pipeline/
├── succulent/          ← zbiranje podatkov z IoT naprav
│   ├── configuration.yml
│   ├── run.py
│   ├── simulate_data.py
│   └── requirements.txt
├── docs/
│   ├── diagrams/
│   ├── architecture/
│   └── sprints/
├── docker/
└── README.md
```

---

## Dokumentacija

Projektna dokumentacija vključuje:

* UML diagrame,
* arhitekturno dokumentacijo,
* deployment dokumentacijo,
* shemo podatkovne baze,
* sprint dokumentacijo,
* tehnične odločitve in analize.

Vsa dokumentacija se nahaja v mapi `/docs`.

---

## Namestitev in zagon

Sistem je zasnovan za zagon v Docker okolju z uporabo Docker Compose, kar omogoča lažjo prenosljivost in enostavnejše upravljanje infrastrukture.

### Zagon succulent data collector

```bash
cd succulent
pip install -r requirements.txt
python run.py          # zažene succulent strežnik na portu 9090
python simulate_data.py  # simulira pošiljanje senzorskih podatkov
```

Zbrani podatki so dostopni na `http://localhost:9090/data`.

---

## Licenca

Projekt je razvit za akademske in izobraževalne namene v okviru učne enote Projekt (IPT UN).
