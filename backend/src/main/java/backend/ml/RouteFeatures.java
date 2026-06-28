package backend.ml;

/**
 * RouteFeatures = a route expressed as numbers (a "feature vector").
 *
 * The k-NN recommendation algorithm cannot compare routes by name or text.
 * It needs numbers. This class holds the numeric description of one route,
 * extracted ONLY from real data (GPX coordinates + computed eco-score).
 *
 * Fields:
 *  - avgElevation : average elevation of all GPX points (meters)
 *  - maxElevation : highest point on the route (meters)
 *  - elevationGain: maxElevation - minElevation (how hilly the route is)
 *  - lengthKm     : approximate route length in kilometers
 *  - pointCount   : number of GPS points (route detail / length proxy)
 *  - ecoScore     : the route's computed eco-score (0-100)
 */
public class RouteFeatures {

    private final Long routeId;
    private final String routeName;

    private final double avgElevation;
    private final double maxElevation;
    private final double elevationGain;
    private final double lengthKm;
    private final double pointCount;
    private final double ecoScore;

    public RouteFeatures(Long routeId, String routeName,
                         double avgElevation, double maxElevation,
                         double elevationGain, double lengthKm,
                         double pointCount, double ecoScore) {
        this.routeId = routeId;
        this.routeName = routeName;
        this.avgElevation = avgElevation;
        this.maxElevation = maxElevation;
        this.elevationGain = elevationGain;
        this.lengthKm = lengthKm;
        this.pointCount = pointCount;
        this.ecoScore = ecoScore;
    }

    /**
     * Returns the feature vector as an array of numbers, in a FIXED order.
     * The order must always be the same so distances are computed correctly.
     *
     * Order: [avgElevation, maxElevation, elevationGain, lengthKm, pointCount, ecoScore]
     */
    public double[] toVector() {
        return new double[] {
                avgElevation,
                maxElevation,
                elevationGain,
                lengthKm,
                pointCount,
                ecoScore
        };
    }

    /** Number of features in the vector. Used by the normalizer. */
    public static int vectorSize() {
        return 6;
    }

    public Long getRouteId() {
        return routeId;
    }

    public String getRouteName() {
        return routeName;
    }

    public double getAvgElevation() {
        return avgElevation;
    }

    public double getMaxElevation() {
        return maxElevation;
    }

    public double getElevationGain() {
        return elevationGain;
    }

    public double getLengthKm() {
        return lengthKm;
    }

    public double getPointCount() {
        return pointCount;
    }

    public double getEcoScore() {
        return ecoScore;
    }
}