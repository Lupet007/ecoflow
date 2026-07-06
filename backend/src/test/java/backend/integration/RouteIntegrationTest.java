package backend.integration;

import backend.model.Route;
import backend.repository.RouteRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RouteIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RouteRepository routeRepository;

    @AfterEach
    void cleanup() {
        routeRepository.deleteAll();
    }

    @Test
    @WithMockUser
    void shouldUploadGpxAndPersistToDatabase() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "test-route.gpx",
                "application/gpx+xml",
                validGpxContent().getBytes()
        );

        mockMvc.perform(multipart("/api/routes/upload").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("test-route.gpx"))
                .andExpect(jsonPath("$.ecoScore").isNumber())
                .andExpect(jsonPath("$.ecoScoreLabel").isString())
                .andExpect(jsonPath("$.pointCount").value(2));

        assertThat(routeRepository.findAll()).hasSize(1);
        assertThat(routeRepository.findAll().get(0).getName()).isEqualTo("test-route.gpx");
    }

    @Test
    @WithMockUser
    void shouldReturnAllRoutesFromDatabase() throws Exception {
        Route route = new Route();
        route.setName("saved-route.gpx");
        route.setPointCount(50);
        route.setEcoScore(72.0);
        route.setEcoScoreLabel("Dobro");
        route.setCoordinates("[]");
        route.setUploadedAt(LocalDateTime.now());
        routeRepository.save(route);

        mockMvc.perform(get("/api/routes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("saved-route.gpx"))
                .andExpect(jsonPath("$[0].ecoScore").value(72.0))
                .andExpect(jsonPath("$[0].ecoScoreLabel").value("Dobro"));
    }

    @Test
    @WithMockUser
    void shouldReturnBadRequestForEmptyGpx() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "empty.gpx",
                "application/gpx+xml",
                "<gpx></gpx>".getBytes()
        );

        mockMvc.perform(multipart("/api/routes/upload").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("V GPX datoteki ni najdenih točk sledi."));

        assertThat(routeRepository.findAll()).isEmpty();
    }

    @Test
    @WithMockUser
    void shouldReturnRouteByIdFromDatabase() throws Exception {
        Route route = new Route();
        route.setName("by-id-route.gpx");
        route.setPointCount(10);
        route.setEcoScore(60.0);
        route.setEcoScoreLabel("Zmerno");
        route.setCoordinates("[]");
        route.setUploadedAt(LocalDateTime.now());
        Route saved = routeRepository.save(route);

        mockMvc.perform(get("/api/routes/" + saved.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("by-id-route.gpx"));
    }

    @Test
    @WithMockUser
    void shouldReturn404ForNonExistentRoute() throws Exception {
        mockMvc.perform(get("/api/routes/999999"))
                .andExpect(status().isNotFound());
    }

    private String validGpxContent() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <gpx version="1.1" 
                     creator="EcoFlow"
                     xmlns="http://www.topografix.com/GPX/1/1">
                  <trk>
                    <trkseg>
                      <trkpt lat="46.5547" lon="15.6459">
                        <ele>280.0</ele>
                        <time>2024-01-01T08:00:00Z</time>
                      </trkpt>
                      <trkpt lat="46.5550" lon="15.6462">
                        <ele>282.0</ele>
                        <time>2024-01-01T08:01:00Z</time>
                      </trkpt>
                    </trkseg>
                  </trk>
                </gpx>
                """;
    }
}