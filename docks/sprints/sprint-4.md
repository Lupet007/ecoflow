Trenutno realizirano
Implementirana GPX upload stran v React aplikaciji
Dodana možnost izbire GPX datoteke preko uporabniškega vmesnika
Implementiran interaktivni Leaflet route planner
Uporabnik lahko izbere začetno in končno točko poti neposredno na zemljevidu
Implementiran prikaz izračunane poti na zemljevidu
Dodane različne možnosti poti:
Eco Route
Fast Route
Balanced Route
Implementirana vizualizacija poti z različnimi barvami
Dodan prikaz osnovnih statistik poti:
razdalja
predviden čas hoje
eco-score
Dodan panel za prikaz trenutnih okoljskih pogojev:
kakovost zraka
temperatura
priporočilo za aktivnosti
Implementirana povezava z realnim OpenStreetMap/OSRM routing servisom
Dodana možnost uporabe demo poti za predstavitev sistema
Izboljšan uporabniški vmesnik za načrtovanje poti
Implementirano filtriranje okoljskih podatkov na zemljevidu
Integracija route planning funkcionalnosti z obstoječim JWT authentication sistemom

Opombe

Trenutna implementacija uporablja realni routing servis (OSRM/OpenStreetMap) za izračun poti.
Eco-score in okoljska priporočila trenutno predstavljajo prototipno logiko v frontend aplikaciji in bodo v naslednjih korakih povezani z backend analizo okoljskih podatkov in GPX obdelavo.