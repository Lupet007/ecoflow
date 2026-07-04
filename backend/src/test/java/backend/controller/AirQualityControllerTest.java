package backend.controller;

import backend.model.ArsoAirQuality;
import backend.repository.ArsoAirQualityRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AirQualityControllerTest {

    private MockMvc mockMvc;

    @Mock
    private ArsoAirQualityRepository repository;

    @BeforeEach
    void setUp() {
        AirQualityController controller = new AirQualityController(repository);

        mockMvc = MockMvcBuilders
                .standaloneSetup(controller)
                .build();
    }

    @Test
    void shouldReturnLatestAirQualityStations() throws Exception {
        ArsoAirQuality station = mock(ArsoAirQuality.class);
        when(station.getStationCode()).thenReturn("E403");
        when(station.getStationName()).thenReturn("LJ Bezigrad");
        when(station.getLatitude()).thenReturn(46.0655449);
        when(station.getLongitude()).thenReturn(14.5127203);
        when(station.getPm10()).thenReturn(13.0);
        when(station.getPm2_5()).thenReturn(8.0);

        when(repository.findLatestBatch()).thenReturn(List.of(station));

        mockMvc.perform(get("/api/air-quality"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].stationCode").value("E403"))
                .andExpect(jsonPath("$[0].pm10").value(13.0))
                .andExpect(jsonPath("$[0].pm2_5").value(8.0));
    }

    @Test
    void shouldReturnServerErrorWhenRepositoryFails() throws Exception {
        when(repository.findLatestBatch()).thenThrow(new RuntimeException("db down"));

        mockMvc.perform(get("/api/air-quality"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Failed to fetch air quality data"));
    }
}
