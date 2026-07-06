package backend.ml;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for KMeansClusterer - verifies it genuinely learns cluster centroids
 * from data (not hard-coded), converges, and groups obviously-separated
 * points correctly.
 */
class KMeansClustererTest {

    @Test
    void groupsTwoObviouslySeparatedClustersCorrectly() {
        // Two tight groups of points, far apart from each other.
        List<double[]> points = List.of(
                new double[] {0.0, 0.0},
                new double[] {0.1, 0.1},
                new double[] {0.05, -0.05},
                new double[] {10.0, 10.0},
                new double[] {10.1, 9.9},
                new double[] {9.9, 10.1}
        );

        KMeansClusterer clusterer = new KMeansClusterer(2, 100);
        clusterer.fit(points);

        int clusterOfFirstGroup = clusterer.predict(new double[] {0.0, 0.0});
        int clusterOfSecondGroup = clusterer.predict(new double[] {10.0, 10.0});

        assertThat(clusterOfFirstGroup).isNotEqualTo(clusterOfSecondGroup);

        // All points from the same real group should land in the same
        // learned cluster.
        assertThat(clusterer.predict(new double[] {0.1, 0.1})).isEqualTo(clusterOfFirstGroup);
        assertThat(clusterer.predict(new double[] {0.05, -0.05})).isEqualTo(clusterOfFirstGroup);
        assertThat(clusterer.predict(new double[] {10.1, 9.9})).isEqualTo(clusterOfSecondGroup);
        assertThat(clusterer.predict(new double[] {9.9, 10.1})).isEqualTo(clusterOfSecondGroup);
    }

    @Test
    void learnedCentroidsAreNotHardCoded() {
        // Centroids must reflect wherever the actual data is, not a fixed
        // location - move the whole dataset and the centroids should move
        // with it.
        List<double[]> pointsNearOrigin = List.of(
                new double[] {0.0, 0.0},
                new double[] {1.0, 1.0}
        );
        List<double[]> pointsFarAway = List.of(
                new double[] {50.0, 50.0},
                new double[] {51.0, 51.0}
        );

        KMeansClusterer first = new KMeansClusterer(1, 50);
        double[][] centroidsNearOrigin = first.fit(pointsNearOrigin);

        KMeansClusterer second = new KMeansClusterer(1, 50);
        double[][] centroidsFarAway = second.fit(pointsFarAway);

        assertThat(centroidsNearOrigin[0][0]).isCloseTo(0.5, org.assertj.core.data.Offset.offset(0.001));
        assertThat(centroidsFarAway[0][0]).isCloseTo(50.5, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    void clampsClusterCountToAvailablePoints() {
        List<double[]> points = List.of(new double[] {1.0, 2.0});

        // Asking for 5 clusters with only 1 point must not crash.
        KMeansClusterer clusterer = new KMeansClusterer(5, 50);
        double[][] centroids = clusterer.fit(points);

        assertThat(centroids.length).isEqualTo(1);
        assertThat(clusterer.getClusterCount()).isEqualTo(1);
    }

    @Test
    void predictReturnsNearestCentroidIndex() {
        List<double[]> points = List.of(
                new double[] {0.0},
                new double[] {100.0}
        );

        KMeansClusterer clusterer = new KMeansClusterer(2, 50);
        clusterer.fit(points);

        int nearZero = clusterer.predict(new double[] {2.0});
        int nearHundred = clusterer.predict(new double[] {98.0});

        assertThat(nearZero).isNotEqualTo(nearHundred);
    }

    @Test
    void isDeterministicAcrossRuns() {
        List<double[]> points = List.of(
                new double[] {1.0, 1.0},
                new double[] {2.0, 2.0},
                new double[] {8.0, 9.0},
                new double[] {9.0, 8.0}
        );

        KMeansClusterer first = new KMeansClusterer(2, 100);
        double[][] firstCentroids = first.fit(points);

        KMeansClusterer second = new KMeansClusterer(2, 100);
        double[][] secondCentroids = second.fit(points);

        assertThat(firstCentroids).isDeepEqualTo(secondCentroids);
    }
}
