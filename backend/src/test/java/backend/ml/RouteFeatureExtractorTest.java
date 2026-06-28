package backend.ml;

import backend.model.Route;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Tests for RouteFeatureExtractor.
 *
 * These verify that a Route (with JSON coordinates from the database) is
 * correctly turned into numeric features: average elevation, max elevation,
 * elevation gain and route length.
 */
class RouteFeatureExtractorTest {

    private final RouteFeatureExtractor extractor = new RouteFeatureExtractor();

    private Route route(Long id, String name, String coordinates,
                        Integer pointCount, Double ecoScore) {
        Route r = new Route();
        r.setId(id);
        r.setName(name);
        r.setCoordinates(coordinates);
        r.setPointCount(pointCount);
        r.setEcoScore(ecoScore);
        return r;
    }

    @Test
    void extractsAverageAndMaxElevation() {
        String coords = "[" +
                "{\"latitude\":46.5,\"longitude\":15.6,\"elevation\":100.0}," +
                "{\"latitude\":46.6,\"longitude\":15.7,\"elevation\":300.0}," +
                "{\"latitude\":46.7,\"longitude\":15.8,\"elevation\":200.0}" +
                "]";
        Route r = route(1L, "test.gpx", coords, 3, 70.0);

        RouteFeatures f = extractor.extract(r);

        // average of 100, 300, 200 = 200
        assertThat(f.getAvgElevation()).isCloseTo(200.0, within(0.01));
        // max = 300
        assertThat(f.getMaxElevation()).isCloseTo(300.0, within(0.01));
        // gain = max - min = 300 - 100 = 200
        assertThat(f.getElevationGain()).isCloseTo(200.0, within(0.01));
    }

    @Test
    void computesNonZeroLengthForMultiplePoints() {
        String coords = "[" +
                "{\"latitude\":46.50,\"longitude\":15.60,\"elevation\":100.0}," +
                "{\"latitude\":46.55,\"longitude\":15.65,\"elevation\":150.0}" +
                "]";
        Route r = route(1L, "test.gpx", coords, 2, 70.0);

        RouteFeatures f = extractor.extract(r);

        // two points ~6-7 km apart -> length should be clearly positive
        assertThat(f.getLengthKm()).isGreaterThan(0.0);
    }

    @Test
    void carriesEcoScoreAndPointCountThrough() {
        String coords = "[{\"latitude\":46.5,\"longitude\":15.6,\"elevation\":100.0}]";
        Route r = route(7L, "x.gpx", coords, 123, 88.0);

        RouteFeatures f = extractor.extract(r);

        assertThat(f.getEcoScore()).isEqualTo(88.0);
        assertThat(f.getPointCount()).isEqualTo(123.0);
        assertThat(f.getRouteId()).isEqualTo(7L);
        assertThat(f.getRouteName()).isEqualTo("x.gpx");
    }

    @Test
    void handlesNullCoordinatesGracefully() {
        Route r = route(1L, "empty.gpx", null, 0, 50.0);

        RouteFeatures f = extractor.extract(r);

        // No coordinates -> geometry features are zero, but it must not crash
        assertThat(f.getAvgElevation()).isEqualTo(0.0);
        assertThat(f.getMaxElevation()).isEqualTo(0.0);
        assertThat(f.getElevationGain()).isEqualTo(0.0);
        assertThat(f.getLengthKm()).isEqualTo(0.0);
        assertThat(f.getEcoScore()).isEqualTo(50.0);
    }

    @Test
    void handlesInvalidJsonGracefully() {
        Route r = route(1L, "broken.gpx", "this is not json", 5, 60.0);

        RouteFeatures f = extractor.extract(r);

        // Bad JSON -> geometry zero, eco-score still carried, no crash
        assertThat(f.getAvgElevation()).isEqualTo(0.0);
        assertThat(f.getEcoScore()).isEqualTo(60.0);
    }

    @Test
    void handlesEmptyArray() {
        Route r = route(1L, "empty.gpx", "[]", 0, 55.0);

        RouteFeatures f = extractor.extract(r);

        assertThat(f.getAvgElevation()).isEqualTo(0.0);
        assertThat(f.getLengthKm()).isEqualTo(0.0);
    }

    @Test
    void handlesNullEcoScoreAndPointCount() {
        String coords = "[{\"latitude\":46.5,\"longitude\":15.6,\"elevation\":100.0}]";
        Route r = route(1L, "x.gpx", coords, null, null);

        RouteFeatures f = extractor.extract(r);

        // null eco-score / point count -> default to 0, no crash
        assertThat(f.getEcoScore()).isEqualTo(0.0);
        assertThat(f.getPointCount()).isEqualTo(0.0);
    }

    @Test
    void handlesPointsWithoutElevation() {
        String coords = "[" +
                "{\"latitude\":46.5,\"longitude\":15.6}," +
                "{\"latitude\":46.6,\"longitude\":15.7}" +
                "]";
        Route r = route(1L, "noele.gpx", coords, 2, 65.0);

        RouteFeatures f = extractor.extract(r);

        // no elevation values -> elevation features 0, but length still computed
        assertThat(f.getAvgElevation()).isEqualTo(0.0);
        assertThat(f.getMaxElevation()).isEqualTo(0.0);
        assertThat(f.getLengthKm()).isGreaterThan(0.0);
    }
}