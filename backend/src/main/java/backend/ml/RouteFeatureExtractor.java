package backend.ml;

import backend.model.Route;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

/**
 * RouteFeatureExtractor turns a Route (from the database) into RouteFeatures
 * (numbers the ML can use).
 *
 * It reads the REAL coordinates JSON that is stored in the database, e.g.:
 *   [{"latitude":46.53,"longitude":15.59,"elevation":331.7}, ...]
 *
 * From those real GPS points it computes:
 *   - average elevation
 *   - maximum elevation
 *   - elevation gain (max - min)
 *   - approximate length in km (sum of distances between consecutive points)
 *
 * Nothing here is invented — every number comes from the uploaded GPX file.
 */
@Component
public class RouteFeatureExtractor {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Earth radius in km, used by the haversine distance formula. */
    private static final double EARTH_RADIUS_KM = 6371.0;

    /**
     * Convert one Route into its numeric RouteFeatures.
     * If coordinates are missing or unreadable, elevation/length fall back to 0,
     * but eco-score and point count are still used.
     */
    public RouteFeatures extract(Route route) {
        double avgElevation = 0.0;
        double maxElevation = 0.0;
        double minElevation = 0.0;
        double lengthKm = 0.0;

        try {
            JsonNode points = objectMapper.readTree(route.getCoordinates());

            if (points != null && points.isArray() && points.size() > 0) {
                double elevationSum = 0.0;
                int elevationCount = 0;
                maxElevation = Double.NEGATIVE_INFINITY;
                minElevation = Double.POSITIVE_INFINITY;

                double prevLat = 0.0;
                double prevLon = 0.0;
                boolean hasPrev = false;

                for (JsonNode point : points) {
                    // --- elevation ---
                    if (point.has("elevation") && !point.get("elevation").isNull()) {
                        double ele = point.get("elevation").asDouble();
                        elevationSum += ele;
                        elevationCount++;
                        if (ele > maxElevation) maxElevation = ele;
                        if (ele < minElevation) minElevation = ele;
                    }

                    // --- length (haversine between consecutive points) ---
                    if (point.has("latitude") && point.has("longitude")) {
                        double lat = point.get("latitude").asDouble();
                        double lon = point.get("longitude").asDouble();
                        if (hasPrev) {
                            lengthKm += haversine(prevLat, prevLon, lat, lon);
                        }
                        prevLat = lat;
                        prevLon = lon;
                        hasPrev = true;
                    }
                }

                if (elevationCount > 0) {
                    avgElevation = elevationSum / elevationCount;
                } else {
                    maxElevation = 0.0;
                    minElevation = 0.0;
                }
            }
        } catch (Exception e) {
            // If coordinates can't be parsed, we keep zeros for geometry-based
            // features. Eco-score and point count below still work.
            avgElevation = 0.0;
            maxElevation = 0.0;
            minElevation = 0.0;
            lengthKm = 0.0;
        }

        double elevationGain = maxElevation - minElevation;
        if (elevationGain < 0) elevationGain = 0.0;

        double pointCount = route.getPointCount() != null ? route.getPointCount() : 0.0;
        double ecoScore = route.getEcoScore() != null ? route.getEcoScore() : 0.0;

        return new RouteFeatures(
                route.getId(),
                route.getName(),
                avgElevation,
                maxElevation,
                elevationGain,
                lengthKm,
                pointCount,
                ecoScore
        );
    }

    /**
     * Haversine formula: distance in km between two lat/lon points on Earth.
     * This is the standard way to measure real-world distance between GPS coordinates.
     */
    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }
}