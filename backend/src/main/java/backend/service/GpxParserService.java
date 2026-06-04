package backend.service;

import backend.model.RoutePoint;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jenetics.jpx.GPX;
import io.jenetics.jpx.Track;
import io.jenetics.jpx.TrackSegment;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.io.InvalidObjectException;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class GpxParserService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Returns List<RoutePoint> — matches what RouteController expects
    public List<RoutePoint> parse(InputStream inputStream) throws Exception {
        GPX gpx;
        try {
            gpx = GPX.Reader.of(GPX.Reader.Mode.LENIENT).read(inputStream);
        } catch (Exception e) {
            System.out.println("GPX parse exception: " + e.getClass().getName() + ": " + e.getMessage());
            return List.of();
        }

        if (gpx == null) {
            return List.of();
        }

        List<RoutePoint> points = gpx.tracks()
                .flatMap(Track::segments)
                .flatMap(TrackSegment::points)
                .map(wp -> new RoutePoint(
                        wp.getLatitude().doubleValue(),
                        wp.getLongitude().doubleValue(),
                        wp.getElevation().map(e -> e.doubleValue()).orElse(null)
                ))
                .collect(Collectors.toList());

        System.out.println("GPX parsed, point count: " + points.size());
        return points;
    }

    // Converts points to JSON string for storing in DB
    public String toJson(List<RoutePoint> points) throws Exception {
        return objectMapper.writeValueAsString(points);
    }
}