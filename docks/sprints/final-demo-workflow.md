# EcoFlow Final Demo Workflow

## 1. Project startup

### Start PostgreSQL / PostGIS database

```bash
cd docker
docker compose up -d
```

### Start backend

```bash
cd backend
./mvnw spring-boot:run
```

### Start frontend

```bash
cd frontend
npm run dev
```

Application URL:

```text
http://localhost:5173
```

---

## 2. User authentication demo

1. Open the application.
2. Register a new user account.
3. Login with the created account.
4. Confirm that the user is redirected to the EcoFlow map page.

Expected result:

* JWT authentication works.
* Protected routes are accessible only after login.

---

## 3. Environmental map demo

1. Open the main map page.
2. Check that Copernicus environmental products are loaded.
3. Use environmental layer filters:

   * Air quality
   * Water quality
   * Land temperature
4. Enable the heatmap layer.

Expected result:

* Leaflet map is displayed.
* Environmental markers are visible.
* Heatmap overlay is shown on the map.

---

## 4. Route planning demo

1. Click `Select start`.
2. Select a start point on the map.
3. Click `Select destination`.
4. Select a destination point on the map.
5. Choose one of the route options:

   * Eco Route
   * Fast Route
   * Balanced Route
6. Click `Calculate route`.

Expected result:

* Route is drawn on the map.
* Distance and duration are displayed.
* Eco-score is calculated.
* Environmental recommendation is shown.

---

## 5. GPX upload demo

1. Go to `Upload GPX`.
2. Select a valid `.gpx` file.
3. Click `Upload and analyse route`.
4. Return to the map.

Expected result:

* GPX file is uploaded.
* Route is stored in PostgreSQL.
* Uploaded route is displayed on the Leaflet map.
* Eco-score is shown for the uploaded route.

---

## 6. Eco Profile demo

1. Open `Eco Profile`.
2. Select:

   * Eco priority
   * Activity type
   * Preferred region
   * Alert preferences
3. Save preferences.
4. Return to map.

Expected result:

* Eco Profile is stored locally.
* Map adjusts to selected preferred region.
* Personalized route recommendations are displayed.
* Planned route eco-score is adjusted based on the profile.

---

## 7. Dashboard demo

1. Open `Dashboard`.
2. Review environmental statistics.
3. Review uploaded route statistics.
4. Check average eco-score and route quality distribution.

Expected result:

* Dashboard displays real backend data.
* Uploaded GPX routes are included in statistics.
* Environmental product statistics are visible.

---

## 8. Testing and CI/CD demo

1. Open GitHub repository.
2. Go to the `Actions` tab.
3. Show EcoFlow CI Pipeline.
4. Show:

   * Backend tests with PostgreSQL
   * Frontend build
   * Python pipeline check

Expected result:

* CI/CD pipeline validates the project.
* Backend route tests are executed.
* Frontend build is checked.
* Python pipeline files are validated.

---

## 9. Final presentation flow

Recommended presentation order:

1. Project vision
2. Architecture overview
3. Login and authentication
4. Environmental map
5. Route planning
6. GPX upload
7. Eco Profile
8. Personalized recommendations
9. Dashboard
10. CI/CD and tests
11. Conclusion
