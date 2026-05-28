package backend.service;

import backend.model.RoutePoint;
import org.springframework.stereotype.Service;
import org.w3c.dom.*;
import javax.xml.parsers.*;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@Service
public class GpxParserService {

    public List<RoutePoint> parse(InputStream gpxStream) throws Exception {
        List<RoutePoint> points = new ArrayList<>();

        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document doc = builder.parse(gpxStream);

        NodeList trackPoints = doc.getElementsByTagName("trkpt");

        for (int i = 0; i < trackPoints.getLength(); i++) {
            Element trkpt = (Element) trackPoints.item(i);

            double lat = Double.parseDouble(trkpt.getAttribute("lat"));
            double lon = Double.parseDouble(trkpt.getAttribute("lon"));

            Double elevation = null;
            NodeList eleNodes = trkpt.getElementsByTagName("ele");
            if (eleNodes.getLength() > 0) {
                elevation = Double.parseDouble(eleNodes.item(0).getTextContent().trim());
            }

            points.add(new RoutePoint(lat, lon, elevation));
        }

        return points;
    }

    public String toJson(List<RoutePoint> points) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < points.size(); i++) {
            RoutePoint p = points.get(i);
            sb.append("{\"lat\":").append(p.getLatitude())
              .append(",\"lon\":").append(p.getLongitude());
            if (p.getElevation() != null) {
                sb.append(",\"ele\":").append(p.getElevation());
            }
            sb.append("}");
            if (i < points.size() - 1) sb.append(",");
        }
        sb.append("]");
        return sb.toString();
    }
}
