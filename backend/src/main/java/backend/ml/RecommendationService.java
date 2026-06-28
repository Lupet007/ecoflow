package backend.ml;

import backend.model.Route;
import backend.repository.RouteRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * RecommendationService = the Machine Learning brain of EcoFlow.
 *
 * WHAT IT DOES (in simple words):
 *   The user has a profile (e.g. "Walking" + "Air quality").
 *   We turn that profile into an "ideal route" described with numbers.
 *   Every real route in the database is also described with numbers.
 *   We measure how FAR each route is from the ideal (Euclidean distance,
 *   the same math k-NN uses). The closest routes = the best matches.
 *
 * WHY THIS IS REAL ML:
 *   - Feature vectors built from real GPX + real eco-score
 *   - Min-max normalization (so big numbers like elevation don't dominate)
 *   - Weighted Euclidean distance (k-Nearest Neighbors core)
 *   - The result is a ranked list with a "% match" and a human reason.
 *
 * Nothing is hard-coded per route. Add new routes and recommendations adapt.
 */
@Service
public class RecommendationService {

    private final RouteRepository routeRepository;
    private final RouteFeatureExtractor featureExtractor;

    public RecommendationService(RouteRepository routeRepository,
                                 RouteFeatureExtractor featureExtractor) {
        this.routeRepository = routeRepository;
        this.featureExtractor = featureExtractor;
    }

    /**
     * Main entry point. Returns routes ranked from best to worst match
     * for the given profile.
     *
     * @param activityType WALKING / RUNNING / CYCLING (may be null)
     * @param ecoPriority  AIR_QUALITY / WATER_QUALITY / LAND_TEMPERATURE (may be null)
     * @param limit        how many recommendations to return (e.g. 5)
     */
    public List<Recommendation> recommend(String activityType, String ecoPriority, int limit) {
        // 1. Load all routes and turn each into numbers (feature vectors).
        List<Route> routes = routeRepository.findAll();
        List<RouteFeatures> allFeatures = new ArrayList<>();
        for (Route route : routes) {
            allFeatures.add(featureExtractor.extract(route));
        }

        if (allFeatures.isEmpty()) {
            return new ArrayList<>();
        }

        // 2. Compute min and max for each feature, so we can normalize.
        //    Normalization puts every feature on a 0..1 scale. Without it,
        //    elevation (hundreds) would completely overpower eco-score (0-100).
        int n = RouteFeatures.vectorSize();
        double[] min = new double[n];
        double[] max = new double[n];
        for (int i = 0; i < n; i++) {
            min[i] = Double.POSITIVE_INFINITY;
            max[i] = Double.NEGATIVE_INFINITY;
        }
        for (RouteFeatures f : allFeatures) {
            double[] v = f.toVector();
            for (int i = 0; i < n; i++) {
                if (v[i] < min[i]) min[i] = v[i];
                if (v[i] > max[i]) max[i] = v[i];
            }
        }

        // 3. Build the "ideal" route vector from the user's profile.
        double[] ideal = buildIdealVector(activityType, ecoPriority, min, max);

        // 4. Feature weights: which features matter most for this profile.
        double[] weights = buildWeights(activityType, ecoPriority);

        // 5. For each route, compute weighted Euclidean distance to the ideal.
        List<Recommendation> results = new ArrayList<>();
        for (RouteFeatures f : allFeatures) {
            double[] norm = normalize(f.toVector(), min, max);
            double distance = weightedEuclidean(norm, ideal, weights);

            // Convert distance to a friendly 0-100% match.
            // Smaller distance = higher match. maxPossible normalizes it.
            double maxPossible = Math.sqrt(sum(weights));
            double matchPercent = 100.0 * (1.0 - (distance / maxPossible));
            matchPercent = Math.max(0.0, Math.min(100.0, matchPercent));
            matchPercent = Math.round(matchPercent * 10.0) / 10.0;

            String reason = buildReason(f, activityType, ecoPriority);

            results.add(new Recommendation(
                    f.getRouteId(),
                    f.getRouteName(),
                    matchPercent,
                    f.getEcoScore(),
                    Math.round(f.getAvgElevation()),
                    Math.round(f.getMaxElevation()),
                    Math.round(f.getLengthKm() * 10.0) / 10.0,
                    reason
            ));
        }

        // 6. Sort by best match first and return the top `limit`.
        results.sort(Comparator.comparingDouble(Recommendation::getMatchPercent).reversed());
        if (results.size() > limit) {
            return new ArrayList<>(results.subList(0, limit));
        }
        return results;
    }

    /**
     * Builds the ideal route the user would love, as a normalized vector.
     * Vector order: [avgElevation, maxElevation, elevationGain, lengthKm, pointCount, ecoScore]
     *
     * We express preferences as target values, then normalize them onto 0..1
     * using the same min/max as the real routes.
     */
    private double[] buildIdealVector(String activityType, String ecoPriority,
                                      double[] min, double[] max) {
        // Start with sensible targets (raw, before normalization).
        // These say "what kind of route fits this profile".
        double targetAvgEle = 600;   // moderate hills by default
        double targetMaxEle = 900;
        double targetGain   = 400;
        double targetLength = 10;    // ~10 km
        double targetPoints = 500;
        double targetEco    = 100;   // always prefer higher eco-score

        if (activityType != null) {
            switch (activityType.toUpperCase()) {
                case "WALKING":
                    // walkers like shorter, calmer routes
                    targetLength = 7;
                    targetGain = 300;
                    targetAvgEle = 500;
                    break;
                case "RUNNING":
                    // runners like flatter, medium-length routes
                    targetLength = 9;
                    targetGain = 150;
                    targetAvgEle = 350;
                    break;
                case "CYCLING":
                    // cyclists like longer routes
                    targetLength = 25;
                    targetGain = 500;
                    targetAvgEle = 600;
                    break;
                default:
                    break;
            }
        }

        // eco priority nudges the elevation/eco targets
        if (ecoPriority != null) {
            switch (ecoPriority.toUpperCase()) {
                case "AIR_QUALITY":
                    // cleaner air is usually higher up
                    targetAvgEle += 200;
                    targetMaxEle += 200;
                    break;
                case "WATER_QUALITY":
                    // water routes tend to be lower / by lakes & rivers
                    targetAvgEle = Math.max(100, targetAvgEle - 200);
                    targetMaxEle = Math.max(200, targetMaxEle - 200);
                    break;
                case "LAND_TEMPERATURE":
                    // avoid heat: prefer higher, cooler elevation
                    targetAvgEle += 150;
                    break;
                default:
                    break;
            }
        }

        double[] rawIdeal = new double[] {
                targetAvgEle, targetMaxEle, targetGain,
                targetLength, targetPoints, targetEco
        };
        return normalize(rawIdeal, min, max);
    }

    /**
     * Feature importance per profile. Higher weight = that feature matters more
     * when judging similarity. This is what makes recommendations feel smart.
     * Order: [avgElevation, maxElevation, elevationGain, lengthKm, pointCount, ecoScore]
     */
    private double[] buildWeights(String activityType, String ecoPriority) {
        // eco-score always matters a lot; the rest start moderate.
        double[] w = new double[] { 1.0, 0.8, 1.0, 1.0, 0.5, 2.0 };

        if (activityType != null) {
            switch (activityType.toUpperCase()) {
                case "WALKING":
                    w[3] = 1.5; // length matters more
                    break;
                case "RUNNING":
                    w[2] = 1.8; // flatness (low gain) matters more
                    break;
                case "CYCLING":
                    w[3] = 2.0; // length matters a lot
                    break;
                default:
                    break;
            }
        }

        if (ecoPriority != null) {
            switch (ecoPriority.toUpperCase()) {
                case "AIR_QUALITY":
                    w[0] = 1.8; // elevation (air) matters more
                    break;
                case "WATER_QUALITY":
                    w[0] = 1.4;
                    break;
                case "LAND_TEMPERATURE":
                    w[1] = 1.5;
                    break;
                default:
                    break;
            }
        }
        return w;
    }

    /**
     * Builds a human-readable reason like:
     * "High elevation and excellent eco-score match your Air quality priority."
     */
    private String buildReason(RouteFeatures f, String activityType, String ecoPriority) {
        StringBuilder sb = new StringBuilder("Recommended because: ");
        List<String> parts = new ArrayList<>();

        if (f.getEcoScore() >= 80) {
            parts.add("excellent eco-score (" + Math.round(f.getEcoScore()) + ")");
        } else if (f.getEcoScore() >= 60) {
            parts.add("good eco-score (" + Math.round(f.getEcoScore()) + ")");
        }

        if (f.getAvgElevation() >= 800) {
            parts.add("high elevation (cleaner air)");
        } else if (f.getAvgElevation() <= 300) {
            parts.add("low, easy terrain");
        }

        if (activityType != null) {
            String a = activityType.toUpperCase();
            if (a.equals("CYCLING") && f.getLengthKm() >= 20) {
                parts.add("long distance suited for cycling");
            } else if (a.equals("WALKING") && f.getLengthKm() <= 10) {
                parts.add("comfortable length for walking");
            } else if (a.equals("RUNNING") && f.getElevationGain() <= 200) {
                parts.add("flat profile ideal for running");
            }
        }

        if (ecoPriority != null) {
            String p = ecoPriority.toUpperCase();
            if (p.equals("AIR_QUALITY") && f.getAvgElevation() >= 600) {
                parts.add("matches your air-quality priority");
            } else if (p.equals("WATER_QUALITY") && f.getAvgElevation() <= 500) {
                parts.add("near-water profile matches your priority");
            } else if (p.equals("LAND_TEMPERATURE") && f.getAvgElevation() >= 600) {
                parts.add("cooler elevation matches your priority");
            }
        }

        if (parts.isEmpty()) {
            parts.add("balanced match for your profile");
        }

        sb.append(String.join(", ", parts)).append(".");
        return sb.toString();
    }

    // ---------- math helpers ----------

    /** Min-max normalization: scales a value to 0..1 using the column's min/max. */
    private double[] normalize(double[] v, double[] min, double[] max) {
        double[] out = new double[v.length];
        for (int i = 0; i < v.length; i++) {
            double range = max[i] - min[i];
            if (range == 0) {
                out[i] = 0.0; // all routes identical on this feature
            } else {
                double val = (v[i] - min[i]) / range;
                out[i] = Math.max(0.0, Math.min(1.0, val));
            }
        }
        return out;
    }

    /** Weighted Euclidean distance — the heart of k-NN similarity. */
    private double weightedEuclidean(double[] a, double[] b, double[] weights) {
        double sum = 0.0;
        for (int i = 0; i < a.length; i++) {
            double diff = a[i] - b[i];
            sum += weights[i] * diff * diff;
        }
        return Math.sqrt(sum);
    }

    private double sum(double[] arr) {
        double s = 0.0;
        for (double v : arr) s += v;
        return s;
    }
}