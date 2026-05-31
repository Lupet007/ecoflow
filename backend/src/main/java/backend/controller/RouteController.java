package backend.controller;

import backend.model.Route;
import backend.model.RoutePoint;
import backend.repository.RouteRepository;
import backend.service.EcoScoreService;
import backend.service.GpxParserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final GpxParserService gpxParserService;
    private final EcoScoreService ecoScoreService;
    private final RouteRepository routeRepository;

    public RouteController(GpxParserService gpxParserService,
                           EcoScoreService ecoScoreService,
                           RouteRepository routeRepository) {
        this.gpxParserService = gpxParserService;
        this.ecoScoreService = ecoScoreService;
        this.routeRepository = routeRepository;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadGpx(@RequestParam("file") MultipartFile file) {
        try {
            // Parse GPX
            List<RoutePoint> points = gpxParserService.parse(file.getInputStream());

            if (points.isEmpty()) {
                return ResponseEntity.badRequest().body("No track points found in GPX file.");
            }

            // Calculate eco-score
            double score = ecoScoreService.calculate(points);
            String label = ecoScoreService.getLabel(score);

            // Save route
            Route route = new Route();
            route.setName(file.getOriginalFilename());
            route.setCoordinates(gpxParserService.toJson(points));
            route.setPointCount(points.size());
            route.setEcoScore(score);
            route.setEcoScoreLabel(label);

            routeRepository.save(route);

            return ResponseEntity.ok(Map.of(
                    "id", route.getId() != null ? route.getId() : 0,
                    "name", route.getName(),
                    "pointCount", points.size(),
                    "ecoScore", score,
                    "ecoScoreLabel", label
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body("Failed to process GPX file: " + e.getMessage());
        }
    }

    @GetMapping
    public List<Route> getAllRoutes() {
        return routeRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getRoute(@PathVariable Long id) {
        return routeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
