package backend.controller;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.beans.factory.annotation.Value;

import java.util.*;

@RestController
@RequestMapping("/api/succulent-data")
public class SucculentDataController {

    @Value("${succulent.url:http://localhost:9090}")
    private String succulentBaseUrl;

    private static final int SUCCULENT_TIMEOUT_MS = 3000;

    // Succulent serializes missing numeric values as NaN, which Jackson
    // rejects by default.
    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(JsonParser.Feature.ALLOW_NON_NUMERIC_NUMBERS, true);

    /**
     * Fetches sensor data collected by the succulent server.
     * Succulent returns JSON: {"data": [...]}
     */
    @GetMapping
    public ResponseEntity<?> getSucculentData() {
        try {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(SUCCULENT_TIMEOUT_MS);
            requestFactory.setReadTimeout(SUCCULENT_TIMEOUT_MS);

            RestTemplate restTemplate = new RestTemplate(requestFactory);
            String jsonResponse = restTemplate.getForObject(succulentBaseUrl + "/data", String.class);

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
            result.put("message", "Strežnik za zbiranje Succulent podatkov ne deluje.");
            result.put("data", Collections.emptyList());
            return ResponseEntity.ok(result);
        } catch (HttpStatusCodeException e) {
            // succulent's /data endpoint returns HTTP 500 when its CSV store is
            // still empty - treat that as "no data yet", not a real failure.
            Map<String, Object> result = new HashMap<>();
            result.put("status", "unavailable");
            result.put("message", "Succulent še nima zabeleženih meritev.");
            result.put("data", Collections.emptyList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Napaka pri pridobivanju Succulent podatkov: " + e.getMessage());
        }
    }

    /**
     * Forwards a single measurement to succulent's /measure endpoint as
     * query parameters, the same way succulent/simulate_data.py does.
     */
    @PostMapping
    public ResponseEntity<?> recordMeasurement(@RequestBody Map<String, Object> measurement) {
        try {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(SUCCULENT_TIMEOUT_MS);
            requestFactory.setReadTimeout(SUCCULENT_TIMEOUT_MS);

            RestTemplate restTemplate = new RestTemplate(requestFactory);

            UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(succulentBaseUrl + "/measure");
            measurement.forEach((key, value) -> builder.queryParam(key, value));

            restTemplate.postForObject(builder.build().toUri(), null, String.class);

            return ResponseEntity.ok(Map.of("status", "recorded"));
        } catch (ResourceAccessException e) {
            return ResponseEntity.status(503).body(Map.of(
                    "status", "unavailable",
                    "message", "Succulent data collection server is not running."));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Beleženje meritve ni uspelo: " + e.getMessage()));
        }
    }
}
