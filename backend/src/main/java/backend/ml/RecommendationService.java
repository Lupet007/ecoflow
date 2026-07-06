package backend.ml;

import backend.model.Route;
import backend.repository.RouteRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * RecommendationService = the machine learning engine behind EcoFlow route
 * recommendations. It combines two real techniques:
 *
 * 1. K-MEANS CLUSTERING (unsupervised learning, see {@link KMeansClusterer}):
 *    every time recommendations are requested, we LEARN natural groupings
 *    among the routes currently in the database from their real features
 *    (elevation, length, eco-score). Nothing about the clusters is
 *    hard-coded - they are fit fresh from whatever routes exist right now,
 *    so the model adapts automatically as users upload more GPX routes.
 *
 * 2. WEIGHTED K-NEAREST-NEIGHBOUR RANKING: the user's profile (e.g.
 *    "Walking" + "Air quality") is turned into a target feature vector
 *    using domain knowledge (a walker prefers a shorter route than a
 *    cyclist, etc.) - this part is necessarily a hand-designed heuristic,
 *    since no historical "user liked this route" labels exist to learn
 *    preferences from. Every real route's distance to that target is
 *    measured with weighted Euclidean distance.
 *
 * The final ranking blends both: routes are scored primarily by their
 * profile-distance (2), then nudged by whether they fall in the learned
 * cluster (1) that best matches the requested profile. Feature vectors are
 * built entirely from real GPX + real eco-score data - nothing is invented
 * per route.
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

        // 4b. Real unsupervised machine learning step: learn natural
        // groupings among the routes actually in the database right now via
        // k-means clustering (Lloyd's algorithm - see KMeansClusterer). This
        // trains fresh on every request because the live route set IS the
        // training set - there is no separate offline dataset to go stale.
        List<double[]> normalizedVectors = new ArrayList<>();
        for (RouteFeatures f : allFeatures) {
            normalizedVectors.add(normalize(f.toVector(), min, max));
        }
        int clusterCount = Math.min(3, allFeatures.size());
        KMeansClusterer clusterer = new KMeansClusterer(clusterCount, 100);
        clusterer.fit(normalizedVectors);
        int targetCluster = clusterer.predict(ideal);

        // 5. For each route, rank primarily by weighted Euclidean distance to
        // the profile's ideal vector, then nudge the score using the learned
        // cluster membership: routes in the cluster that best matches this
        // profile get a small boost, routes far from it a small penalty.
        List<Recommendation> results = new ArrayList<>();
        for (int i = 0; i < allFeatures.size(); i++) {
            RouteFeatures f = allFeatures.get(i);
            double[] norm = normalizedVectors.get(i);
            double distance = weightedEuclidean(norm, ideal, weights);

            int routeCluster = clusterer.predict(norm);
            boolean matchesLearnedCluster = routeCluster == targetCluster;
            if (matchesLearnedCluster) {
                distance = Math.max(0.0, distance - 0.05);
            } else {
                double centroidDistance = weightedEuclidean(norm, clusterer.centroidOf(targetCluster), weights);
                distance += 0.05 + centroidDistance * 0.05;
            }

            // Convert distance to a friendly 0-100% match.
            // Smaller distance = higher match. maxPossible normalizes it.
            double maxPossible = Math.sqrt(sum(weights));
            double matchPercent = 100.0 * (1.0 - (distance / maxPossible));
            matchPercent = Math.max(0.0, Math.min(100.0, matchPercent));
            matchPercent = Math.round(matchPercent * 10.0) / 10.0;

            String reason = buildReason(f, activityType, ecoPriority, matchesLearnedCluster);

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
     * Builds a human-readable reason (in Slovenian, matching the rest of the
     * frontend) like:
     * "Priporočeno, ker: visoka nadmorska višina, odlična eko-ocena (85)."
     */
    private String buildReason(RouteFeatures f, String activityType, String ecoPriority,
                               boolean matchesLearnedCluster) {
        StringBuilder sb = new StringBuilder("Priporočeno, ker: ");
        List<String> parts = new ArrayList<>();

        if (f.getEcoScore() >= 80) {
            parts.add("odlična eko-ocena (" + Math.round(f.getEcoScore()) + ")");
        } else if (f.getEcoScore() >= 60) {
            parts.add("dobra eko-ocena (" + Math.round(f.getEcoScore()) + ")");
        }

        if (f.getAvgElevation() >= 800) {
            parts.add("visoka nadmorska višina (čistejši zrak)");
        } else if (f.getAvgElevation() <= 300) {
            parts.add("nizek, lahek teren");
        }

        if (activityType != null) {
            String a = activityType.toUpperCase();
            if (a.equals("CYCLING") && f.getLengthKm() >= 20) {
                parts.add("dolga razdalja, primerna za kolesarjenje");
            } else if (a.equals("WALKING") && f.getLengthKm() <= 10) {
                parts.add("udobna dolžina za hojo");
            } else if (a.equals("RUNNING") && f.getElevationGain() <= 200) {
                parts.add("raven profil, idealen za tek");
            }
        }

        if (ecoPriority != null) {
            String p = ecoPriority.toUpperCase();
            if (p.equals("AIR_QUALITY") && f.getAvgElevation() >= 600) {
                parts.add("ustreza tvoji prioriteti kakovosti zraka");
            } else if (p.equals("WATER_QUALITY") && f.getAvgElevation() <= 500) {
                parts.add("profil blizu vode ustreza tvoji prioriteti");
            } else if (p.equals("LAND_TEMPERATURE") && f.getAvgElevation() >= 600) {
                parts.add("hladnejša nadmorska višina ustreza tvoji prioriteti");
            }
        }

        if (matchesLearnedCluster) {
            parts.add("del naučene skupine podobnih resničnih poti");
        }

        if (parts.isEmpty()) {
            parts.add("uravnotežen odgovor za tvoj profil");
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