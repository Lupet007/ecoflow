package backend.controller;

import backend.model.Route;
import backend.model.RoutePoint;
import backend.repository.RouteRepository;
import backend.service.EcoScoreService;
import backend.service.GpxParserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.io.InputStream;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class RouteControllerTest {

    private MockMvc mockMvc;

    @Mock
    private GpxParserService gpxParserService;

    @Mock
    private EcoScoreService ecoScoreService;

    @Mock
    private RouteRepository routeRepository;

    @BeforeEach
    void setUp() {
        RouteController routeController =
                new RouteController(gpxParserService, ecoScoreService, routeRepository);

        mockMvc = MockMvcBuilders
                .standaloneSetup(routeController)
                .build();
    }

    @Test
    void shouldReturnAllUploadedRoutes() throws Exception {
        Route route = new Route();
        route.setId(1L);
        route.setName("test-route.gpx");
        route.setPointCount(120);
        route.setEcoScore(85.0);
        route.setEcoScoreLabel("Excellent");
        route.setCoordinates("[]");
        route.setUploadedAt(java.time.LocalDateTime.now());

        when(routeRepository.findAll()).thenReturn(List.of(route));

        mockMvc.perform(get("/api/routes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("test-route.gpx"))
                .andExpect(jsonPath("$[0].pointCount").value(120))
                .andExpect(jsonPath("$[0].ecoScore").value(85.0))
                .andExpect(jsonPath("$[0].ecoScoreLabel").value("Excellent"));
    }

    @Test
    void shouldUploadGpxAndReturnEcoScore() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "walk-route.gpx",
                "application/gpx+xml",
                "<gpx><trk><trkseg></trkseg></trk></gpx>".getBytes()
        );

        RoutePoint point = mock(RoutePoint.class);

        when(gpxParserService.parse(any(InputStream.class)))
                .thenReturn(List.of(point));

        when(gpxParserService.toJson(any()))
                .thenReturn("[{\"lat\":46.55,\"lon\":15.64}]");

        // Updated: calculate now takes 3 parameters (points, activityType, ecoPriority)
        when(ecoScoreService.calculate(any(), isNull(), isNull()))
                .thenReturn(88.0);

        when(ecoScoreService.getLabel(88.0))
                .thenReturn("Excellent");

        mockMvc.perform(multipart("/api/routes/upload").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("walk-route.gpx"))
                .andExpect(jsonPath("$.pointCount").value(1))
                .andExpect(jsonPath("$.ecoScore").value(88.0))
                .andExpect(jsonPath("$.ecoScoreLabel").value("Excellent"));
    }

    @Test
    void shouldReturnBadRequestWhenGpxHasNoTrackPoints() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "empty-route.gpx",
                "application/gpx+xml",
                "<gpx></gpx>".getBytes()
        );

        when(gpxParserService.parse(any(InputStream.class)))
                .thenReturn(List.of());

        mockMvc.perform(multipart("/api/routes/upload").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("No track points found in GPX file."));
    }
}