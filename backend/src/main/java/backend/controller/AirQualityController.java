package backend.controller;

import backend.model.ArsoAirQuality;
import backend.repository.ArsoAirQualityRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/air-quality")
public class AirQualityController {

    private final ArsoAirQualityRepository repository;

    public AirQualityController(ArsoAirQualityRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<?> getLatestAirQuality() {
        try {
            List<ArsoAirQuality> stations = repository.findLatestBatch();
            return ResponseEntity.ok(stations);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Pridobivanje podatkov o kakovosti zraka ni uspelo"));
        }
    }
}
