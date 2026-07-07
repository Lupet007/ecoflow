package backend.controller;

import backend.ml.Recommendation;
import backend.ml.RecommendationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoint for ML route recommendations.
 *
 * Example calls:
 *   GET /api/routes/recommend
 *   GET /api/routes/recommend?activityType=WALKING&ecoPriority=AIR_QUALITY
 *   GET /api/routes/recommend?activityType=CYCLING&ecoPriority=WATER_QUALITY&limit=3
 *
 * Returns a ranked JSON list of recommended routes with a "% match" and reason.
 */
@RestController
@RequestMapping("/api/routes")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping("/recommend")
    public List<Recommendation> recommend(
            @RequestParam(required = false) String activityType,
            @RequestParam(required = false) String ecoPriority,
            @RequestParam(required = false, defaultValue = "5") int limit
    ) {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;
        return recommendationService.recommend(activityType, ecoPriority, limit);
    }
}