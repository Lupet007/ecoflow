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
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
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

    when(routeRepository.findAll()).thenReturn(List.of());

    mockMvc.perform(get("/api/routes"))
            .andExpect(status().isOk())
            .andExpect(content().json("[]"));
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

        when(ecoScoreService.calculate(any()))
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

    @Test
    void shouldReturnSingleRouteById() throws Exception {
        Route route = new Route();
        route.setName("single-route.gpx");
        route.setPointCount(50);
        route.setEcoScore(72.0);
        route.setEcoScoreLabel("Good");
        route.setCoordinates("[]");

        when(routeRepository.findById(1L)).thenReturn(Optional.of(route));

        mockMvc.perform(get("/api/routes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("single-route.gpx"))
                .andExpect(jsonPath("$.ecoScore").value(72.0))
                .andExpect(jsonPath("$.ecoScoreLabel").value("Good"));
    }
}