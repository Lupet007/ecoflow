package backend.service;

import backend.model.CopernicusProduct;
import backend.model.RoutePoint;
import backend.repository.CopernicusProductRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class EcoScoreService {

    private final CopernicusProductRepository copernicusProductRepository;

    public EcoScoreService(CopernicusProductRepository copernicusProductRepository) {
        this.copernicusProductRepository = copernicusProductRepository;
    }

    public double calculate(List<RoutePoint> points, String activityType, String ecoPriority) {
        List<CopernicusProduct> products = copernicusProductRepository.findAll();

        double score = 50.0;

        long airQualityCount = products.stream()
                .filter(p -> p.getName() != null && (
                        p.getName().contains("OL_1") ||
                        p.getName().contains("OL_2_WRR") ||
                        p.getName().contains("OL_2_LFR")
                ))
                .count();

        long waterQualityCount = products.stream()
                .filter(p -> p.getName() != null && (
                        p.getName().contains("OL_2") ||
                        p.getName().contains("WRR")
                ))
                .count();

        long temperatureCount = products.stream()
                .filter(p -> p.getName() != null && (
                        p.getName().contains("SL_1") ||
                        p.getName().contains("SL_2") ||
                        p.getName().contains("LST")
                ))
                .count();

        if (airQualityCount > 0) score += 15.0;
        if (waterQualityCount > 0) score += 10.0;
        if (temperatureCount > 0) score -= 5.0;

        long totalDataSources = airQualityCount + waterQualityCount + temperatureCount;
        if (totalDataSources >= 3) score += 5.0;

        double avgElevation = points.stream()
                .filter(p -> p.getElevation() != null)
                .mapToDouble(RoutePoint::getElevation)
                .average()
                .orElse(0.0);

        double maxElevation = points.stream()
                .filter(p -> p.getElevation() != null)
                .mapToDouble(RoutePoint::getElevation)
                .max()
                .orElse(0.0);

        if (avgElevation > 800) score += 15.0;
        else if (avgElevation > 500) score += 10.0;
        else if (avgElevation > 200) score += 5.0;
        else if (avgElevation < 100) score -= 5.0;

        if (maxElevation - avgElevation > 300) score += 5.0;

        if (points.size() > 1000) score -= 10.0;
        else if (points.size() > 500) score -= 5.0;
        else if (points.size() < 50) score -= 3.0;

        if (activityType != null) {
            switch (activityType.toUpperCase()) {
                case "WALKING":
                    if (airQualityCount == 0) score -= 5.0;
                    break;
                case "RUNNING":
                    if (airQualityCount == 0) score -= 8.0;
                    else score += 3.0;
                    break;
                case "CYCLING":
                    score += 2.0;
                    break;
                default:
                    break;
            }
        }

        if (ecoPriority != null) {
            switch (ecoPriority.toUpperCase()) {
                case "AIR_QUALITY":
                    if (airQualityCount > 0) score += 8.0;
                    else score -= 8.0;
                    break;
                case "WATER_QUALITY":
                    if (waterQualityCount > 0) score += 6.0;
                    else score -= 3.0;
                    break;
                case "LAND_TEMPERATURE":
                    if (temperatureCount > 0) score -= 5.0;
                    else score += 3.0;
                    break;
                default:
                    break;
            }
        }

        score = Math.max(0.0, Math.min(100.0, score));
        return Math.round(score * 10.0) / 10.0;
    }

    public double calculate(List<RoutePoint> points) {
        return calculate(points, null, null);
    }

    public String getLabel(double score) {
        if (score >= 80) return "Excellent";
        if (score >= 60) return "Good";
        if (score >= 40) return "Moderate";
        if (score >= 20) return "Poor";
        return "Bad";
    }
}