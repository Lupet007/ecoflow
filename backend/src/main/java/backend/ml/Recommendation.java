package backend.ml;

/**
 * Recommendation = one recommended route, ready to send to the frontend.
 *
 * It carries everything the UI needs to draw a nice card:
 *   - which route
 *   - how well it matches the profile (matchPercent, 0-100)
 *   - its eco-score and basic stats
 *   - a human-readable reason ("Recommended because ...")
 */
public class Recommendation {

    private final Long routeId;
    private final String routeName;
    private final double matchPercent;
    private final double ecoScore;
    private final long avgElevation;
    private final long maxElevation;
    private final double lengthKm;
    private final String reason;
    private final boolean limitedData;

    public Recommendation(Long routeId, String routeName, double matchPercent,
                          double ecoScore, long avgElevation, long maxElevation,
                          double lengthKm, String reason, boolean limitedData) {
        this.routeId = routeId;
        this.routeName = routeName;
        this.matchPercent = matchPercent;
        this.ecoScore = ecoScore;
        this.avgElevation = avgElevation;
        this.maxElevation = maxElevation;
        this.lengthKm = lengthKm;
        this.reason = reason;
        this.limitedData = limitedData;
    }

    public Long getRouteId() {
        return routeId;
    }

    public String getRouteName() {
        return routeName;
    }

    public double getMatchPercent() {
        return matchPercent;
    }

    public double getEcoScore() {
        return ecoScore;
    }

    public long getAvgElevation() {
        return avgElevation;
    }

    public long getMaxElevation() {
        return maxElevation;
    }

    public double getLengthKm() {
        return lengthKm;
    }

    public String getReason() {
        return reason;
    }

    public boolean isLimitedData() {
        return limitedData;
    }
}