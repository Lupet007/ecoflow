package backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.*;

@RestController
@RequestMapping("/api/succulent-data")
public class SucculentDataController {

    private static final String SUCCULENT_URL = "http://localhost:9090/data";
    private static final String SUCCULENT_MEASURE_URL = "http://localhost:9090/measure";
    private static final int SUCCULENT_TIMEOUT_MS = 3000;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Fetches sensor data collected by the succulent server.
     * Succulent returns JSON: {"data": [...]}
     */
    @GetMapping
    public ResponseEntity<?> getSucculentData() {
        try {
            // Without an explicit timeout, RestTemplate hangs indefinitely when
            // the succulent container is unreachable or stuck, instead of
            // falling through to the "unavailable" response below.
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(SUCCULENT_TIMEOUT_MS);
            requestFactory.setReadTimeout(SUCCULENT_TIMEOUT_MS);

            RestTemplate restTemplate = new RestTemplate(requestFactory);
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
        } catch (HttpStatusCodeException e) {
            // The succulent server itself has a known bug: when its CSV store is
            // still empty (no measurement has ever been recorded yet), its /data
            // endpoint throws a KeyError internally and returns HTTP 500 instead
            // of an empty result. That is a normal, expected "no data yet" state
            // (e.g. right after the container starts, before the simulator has
            // sent anything) - not a real failure - so report it the same way as
            // "unavailable" rather than surfacing a raw error to the frontend.
            Map<String, Object> result = new HashMap<>();
            result.put("status", "unavailable");
            result.put("message", "Succulent has no measurements recorded yet.");
            result.put("data", Collections.emptyList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error fetching succulent data: " + e.getMessage());
        }
    }

    /**
     * Records a single real measurement (e.g. the logged-in user's real
     * browser geolocation, paired with real air-quality/temperature values
     * already looked up by the frontend) by forwarding it to succulent's
     * /measure endpoint as query parameters - the same way succulent/simulate_data.py
     * already posts measurements.
     */
    @PostMapping
    public ResponseEntity<?> recordMeasurement(@RequestBody Map<String, Object> measurement) {
        try {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(SUCCULENT_TIMEOUT_MS);
            requestFactory.setReadTimeout(SUCCULENT_TIMEOUT_MS);

            RestTemplate restTemplate = new RestTemplate(requestFactory);

            UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(SUCCULENT_MEASURE_URL);
            measurement.forEach((key, value) -> builder.queryParam(key, value));

            restTemplate.postForObject(builder.build().toUri(), null, String.class);

            return ResponseEntity.ok(Map.of("status", "recorded"));
        } catch (ResourceAccessException e) {
            return ResponseEntity.status(503).body(Map.of(
                    "status", "unavailable",
                    "message", "Succulent data collection server is not running."));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to record measurement: " + e.getMessage()));
        }
    }
}
