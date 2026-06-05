package backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResourceAccessException;

import java.util.*;

@RestController
@RequestMapping("/api/succulent-data")
public class SucculentDataController {

    private static final String SUCCULENT_URL = "http://localhost:9090/data";
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Fetches sensor data collected by the succulent server.
     * Succulent returns JSON: {"data": [...]}
     */
    @GetMapping
    public ResponseEntity<?> getSucculentData() {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String jsonResponse = restTemplate.getForObject(SUCCULENT_URL, String.class);

            if (jsonResponse == null || jsonResponse.isBlank()) {
                return ResponseEntity.ok(Collections.emptyList());
            }

            // Parse JSON response from succulent: {"data": [...]}
            Map<String, Object> responseMap = objectMapper.readValue(jsonResponse, Map.class);
            Object data = responseMap.get("data");

            if (data instanceof List) {
                return ResponseEntity.ok(data);
            }

            return ResponseEntity.ok(Collections.emptyList());

        } catch (ResourceAccessException e) {
            Map<String, Object> result = new HashMap<>();
            result.put("status", "unavailable");
            result.put("message", "Succulent data collection server is not running.");
            result.put("data", Collections.emptyList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error fetching succulent data: " + e.getMessage());
        }
    }
}
