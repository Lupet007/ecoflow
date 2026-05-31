package backend.model;

public class RoutePoint {

    private double latitude;
    private double longitude;
    private Double elevation;

    public RoutePoint(double latitude, double longitude, Double elevation) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.elevation = elevation;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public Double getElevation() {
        return elevation;
    }
}
