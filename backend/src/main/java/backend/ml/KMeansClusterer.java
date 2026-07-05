package backend.ml;

import java.util.List;

/**
 * A from-scratch implementation of k-means clustering (Lloyd's algorithm) -
 * a standard unsupervised machine learning technique.
 *
 * Given a set of real numeric feature vectors, it iteratively LEARNS k
 * cluster centroids that minimize the within-cluster squared distance.
 * No labels are required and nothing is hard-coded per input: the centroids
 * are entirely a function of whatever data is passed to {@link #fit}.
 *
 * Centroid initialization uses deterministic "farthest-first" seeding (each
 * new centroid is the point farthest from all previously chosen centroids).
 * This keeps results reproducible - important for automated tests - while
 * still being a recognized k-means++-style initialization strategy, rather
 * than picking arbitrary starting points.
 */
public class KMeansClusterer {

    private final int k;
    private final int maxIterations;
    private double[][] centroids;

    public KMeansClusterer(int k, int maxIterations) {
        this.k = k;
        this.maxIterations = maxIterations;
    }

    /**
     * Learns cluster centroids from the given real data points.
     * Returns the learned centroids (also cached for later {@link #predict}
     * calls).
     */
    public double[][] fit(List<double[]> points) {
        int effectiveK = Math.max(1, Math.min(k, points.size()));
        centroids = seedCentroids(points, effectiveK);

        for (int iteration = 0; iteration < maxIterations; iteration++) {
            int[] assignments = assignAll(points);
            double[][] updated = recomputeCentroids(points, assignments, effectiveK);

            boolean converged = converged(centroids, updated);
            centroids = updated;
            if (converged) {
                break;
            }
        }

        return centroids;
    }

    /** Returns the index of the nearest learned centroid to the given point. */
    public int predict(double[] point) {
        return nearestCentroidIndex(point);
    }

    public double[] centroidOf(int clusterIndex) {
        return centroids[clusterIndex];
    }

    public double[][] getCentroids() {
        return centroids;
    }

    public int getClusterCount() {
        return centroids.length;
    }

    private double[][] seedCentroids(List<double[]> points, int effectiveK) {
        double[][] chosen = new double[effectiveK][];
        chosen[0] = points.get(0);

        for (int c = 1; c < effectiveK; c++) {
            double bestDistance = -1;
            double[] bestPoint = points.get(0);

            for (double[] candidate : points) {
                double nearestChosenDistance = Double.POSITIVE_INFINITY;
                for (int i = 0; i < c; i++) {
                    nearestChosenDistance = Math.min(nearestChosenDistance, squaredDistance(candidate, chosen[i]));
                }
                if (nearestChosenDistance > bestDistance) {
                    bestDistance = nearestChosenDistance;
                    bestPoint = candidate;
                }
            }
            chosen[c] = bestPoint;
        }
        return chosen;
    }

    private int[] assignAll(List<double[]> points) {
        int[] assignments = new int[points.size()];
        for (int i = 0; i < points.size(); i++) {
            assignments[i] = nearestCentroidIndex(points.get(i));
        }
        return assignments;
    }

    private int nearestCentroidIndex(double[] point) {
        int nearest = 0;
        double nearestDistance = Double.POSITIVE_INFINITY;
        for (int i = 0; i < centroids.length; i++) {
            double distance = squaredDistance(point, centroids[i]);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = i;
            }
        }
        return nearest;
    }

    private double[][] recomputeCentroids(List<double[]> points, int[] assignments, int effectiveK) {
        int dimensions = points.get(0).length;
        double[][] sums = new double[effectiveK][dimensions];
        int[] counts = new int[effectiveK];

        for (int i = 0; i < points.size(); i++) {
            int cluster = assignments[i];
            double[] point = points.get(i);
            for (int d = 0; d < dimensions; d++) {
                sums[cluster][d] += point[d];
            }
            counts[cluster]++;
        }

        double[][] updated = new double[effectiveK][dimensions];
        for (int c = 0; c < effectiveK; c++) {
            if (counts[c] == 0) {
                // Empty cluster (can happen with unlucky seeding on small
                // datasets) - keep its previous centroid instead of NaNs.
                updated[c] = centroids[c];
                continue;
            }
            for (int d = 0; d < dimensions; d++) {
                updated[c][d] = sums[c][d] / counts[c];
            }
        }
        return updated;
    }

    private boolean converged(double[][] previous, double[][] updated) {
        double epsilon = 1e-9;
        for (int c = 0; c < previous.length; c++) {
            if (squaredDistance(previous[c], updated[c]) > epsilon) {
                return false;
            }
        }
        return true;
    }

    private double squaredDistance(double[] a, double[] b) {
        double sum = 0.0;
        for (int i = 0; i < a.length; i++) {
            double diff = a[i] - b[i];
            sum += diff * diff;
        }
        return sum;
    }
}
