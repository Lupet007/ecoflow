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

    public double calculate(List<RoutePoint> points) {
        List<CopernicusProduct> products = copernicusProductRepository.findAll();

        double score = 50.0; // baseline score

        // Bonus for available environmental data
        long airQualityCount = products.stream()
                .filter(p -> p.getName() != null && p.getName().toLowerCase().contains("air"))
                .count();
        long waterQualityCount = products.stream()
                .filter(p -> p.getName() != null && p.getName().toLowerCase().contains("water"))
                .count();
        long tempCount = products.stream()
                .filter(p -> p.getName() != null && p.getName().toLowerCase().contains("temperature"))
                .count();

        if (airQualityCount > 0) score += 15;
        if (waterQualityCount > 0) score += 10;
        if (tempCount > 0) score += 5;

        // Bonus for elevation
        double avgElevation = points.stream()
                .filter(p -> p.getElevation() != null)
                .mapToDouble(RoutePoint::getElevation)
                .average()
                .orElse(0);

        if (avgElevation > 500) score += 10;
        else if (avgElevation > 200) score += 5;
    
        if (points.size() > 500) score -= 5;

        score = Math.max(0, Math.min(100, score));

        return Math.round(score * 10.0) / 10.0;
    }

    public String getLabel(double score) {
        if (score >= 80) return "Excellent";
        if (score >= 60) return "Good";
        if (score >= 40) return "Moderate";
        if (score >= 20) return "Poor";
        return "Bad";
    }
}
