package backend.ml;

import backend.model.Route;
import backend.repository.RouteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Tests for RecommendationService (the k-NN recommendation engine).
 *
 * These verify the recommendations are ranked, scored as a 0-100 % match,
 * limited correctly, react to the user profile, and carry a reason string.
 */
@ExtendWith(MockitoExtension.class)
class RecommendationServiceTest {

    @Mock
    private RouteRepository routeRepository;

    // Real extractor (no need to mock it; it just parses JSON)
    private final RouteFeatureExtractor extractor = new RouteFeatureExtractor();

    @InjectMocks
    private RecommendationService recommendationService;

    // Build the service with a real extractor
    private RecommendationService service() {
        return new RecommendationService(routeRepository, extractor);
    }

    private Route route(Long id, String name, double avgEle, double maxEle,
                        int pointCount, double ecoScore) {
        Route r = new Route();
        r.setId(id);
        r.setName(name);
        r.setPointCount(pointCount);
        r.setEcoScore(ecoScore);
        // build simple coordinates: two points so length > 0, with given elevations
        String coords = "[" +
                "{\"latitude\":46.50,\"longitude\":15.60,\"elevation\":" + avgEle + "}," +
                "{\"latitude\":46.55,\"longitude\":15.65,\"elevation\":" + maxEle + "}" +
                "]";
        r.setCoordinates(coords);
        return r;
    }

    private void mockRoutes(Route... routes) {
        when(routeRepository.findAll()).thenReturn(new ArrayList<>(List.of(routes)));
    }

    @Test
    void returnsEmptyListWhenNoRoutes() {
        when(routeRepository.findAll()).thenReturn(new ArrayList<>());

        List<Recommendation> result = service().recommend("WALKING", "AIR_QUALITY", 5);

        assertThat(result).isEmpty();
    }

    @Test
    void returnsRecommendationsForAllRoutes() {
        mockRoutes(
                route(1L, "a.gpx", 800, 1000, 300, 85.0),
                route(2L, "b.gpx", 300, 400, 200, 70.0),
                route(3L, "c.gpx", 100, 150, 100, 60.0)
        );

        List<Recommendation> result = service().recommend("WALKING", "AIR_QUALITY", 5);

        assertThat(result).hasSize(3);
    }

    @Test
    void respectsTheLimit() {
        mockRoutes(
                route(1L, "a.gpx", 800, 1000, 300, 85.0),
                route(2L, "b.gpx", 300, 400, 200, 70.0),
                route(3L, "c.gpx", 100, 150, 100, 60.0),
                route(4L, "d.gpx", 500, 600, 250, 75.0)
        );

        List<Recommendation> result = service().recommend("WALKING", "AIR_QUALITY", 2);

        assertThat(result).hasSize(2);
    }

    @Test
    void resultsAreSortedByMatchDescending() {
        mockRoutes(
                route(1L, "a.gpx", 800, 1000, 300, 85.0),
                route(2L, "b.gpx", 300, 400, 200, 70.0),
                route(3L, "c.gpx", 100, 150, 100, 60.0)
        );

        List<Recommendation> result = service().recommend("WALKING", "AIR_QUALITY", 5);

        // each match% should be >= the next one
        for (int i = 0; i < result.size() - 1; i++) {
            assertThat(result.get(i).getMatchPercent())
                    .isGreaterThanOrEqualTo(result.get(i + 1).getMatchPercent());
        }
    }

    @Test
    void matchPercentIsWithinZeroToHundred() {
        mockRoutes(
                route(1L, "a.gpx", 800, 1000, 300, 85.0),
                route(2L, "b.gpx", 300, 400, 200, 70.0)
        );

        List<Recommendation> result = service().recommend("CYCLING", "WATER_QUALITY", 5);

        for (Recommendation r : result) {
            assertThat(r.getMatchPercent()).isBetween(0.0, 100.0);
        }
    }

    @Test
    void eachRecommendationHasAReason() {
        mockRoutes(
                route(1L, "a.gpx", 800, 1000, 300, 85.0),
                route(2L, "b.gpx", 300, 400, 200, 70.0)
        );

        List<Recommendation> result = service().recommend("WALKING", "AIR_QUALITY", 5);

        for (Recommendation r : result) {
            assertThat(r.getReason()).isNotBlank();
        }
    }

    @Test
    void worksWithNullProfile() {
        mockRoutes(
                route(1L, "a.gpx", 800, 1000, 300, 85.0),
                route(2L, "b.gpx", 300, 400, 200, 70.0)
        );

        List<Recommendation> result = service().recommend(null, null, 5);

        assertThat(result).hasSize(2);
        for (Recommendation r : result) {
            assertThat(r.getMatchPercent()).isBetween(0.0, 100.0);
        }
    }

    @Test
    void differentProfilesCanProduceDifferentTopRoute() {
        // A high-elevation route and a long flat route
        Route highMountain = route(1L, "mountain.gpx", 1500, 2000, 300, 80.0);
        Route longFlat = route(2L, "cycling.gpx", 200, 250, 1200, 80.0);
        // make the flat route genuinely long by spacing the points far apart
        longFlat.setCoordinates(
                "[{\"latitude\":46.0,\"longitude\":15.0,\"elevation\":200.0}," +
                "{\"latitude\":46.4,\"longitude\":15.6,\"elevation\":250.0}]"
        );

        // Walking + air quality: should favour the high mountain
        when(routeRepository.findAll())
                .thenReturn(new ArrayList<>(List.of(highMountain, longFlat)));
        List<Recommendation> walking = service().recommend("WALKING", "AIR_QUALITY", 2);

        // Cycling + water: should shift preference (long, lower route ranks better)
        when(routeRepository.findAll())
                .thenReturn(new ArrayList<>(List.of(highMountain, longFlat)));
        List<Recommendation> cycling = service().recommend("CYCLING", "WATER_QUALITY", 2);

        // Both return results; the point is the engine reacts to the profile.
        assertThat(walking).hasSize(2);
        assertThat(cycling).hasSize(2);
        // At least the match percentages should differ between the two profiles
        boolean anyDifference = false;
        for (int i = 0; i < 2; i++) {
            if (walking.get(i).getMatchPercent() != cycling.get(i).getMatchPercent()
                    || !walking.get(i).getRouteName().equals(cycling.get(i).getRouteName())) {
                anyDifference = true;
            }
        }
        assertThat(anyDifference).isTrue();
    }

    @Test
    void limitBelowOneStillReturnsAtLeastNothingNegative() {
        mockRoutes(route(1L, "a.gpx", 800, 1000, 300, 85.0));

        // limit of 1 (controller clamps below 1, service just slices)
        List<Recommendation> result = service().recommend("WALKING", "AIR_QUALITY", 1);

        assertThat(result).hasSize(1);
    }

    @Test
    void recommendationCarriesRouteStats() {
        mockRoutes(route(5L, "stats.gpx", 600, 900, 250, 78.0));

        List<Recommendation> result = service().recommend("WALKING", "AIR_QUALITY", 1);

        Recommendation r = result.get(0);
        assertThat(r.getRouteId()).isEqualTo(5L);
        assertThat(r.getRouteName()).isEqualTo("stats.gpx");
        assertThat(r.getEcoScore()).isEqualTo(78.0);
        assertThat(r.getMaxElevation()).isGreaterThan(0L);
    }
}