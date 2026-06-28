package backend.controller;

import backend.ml.Recommendation;
import backend.ml.RecommendationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Tests for RecommendationController.
 *
 * These verify the endpoint passes the profile to the service and clamps the
 * limit into a safe range (1..50).
 */
@ExtendWith(MockitoExtension.class)
class RecommendationTest {

    @Mock
    private RecommendationService recommendationService;

    @InjectMocks
    private RecommendationController controller;

    @Test
    void passesProfileToService() {
        when(recommendationService.recommend("WALKING", "AIR_QUALITY", 5))
                .thenReturn(new ArrayList<>());

        List<Recommendation> result =
                controller.recommend("WALKING", "AIR_QUALITY", 5);

        assertThat(result).isNotNull();
    }

    @Test
    void clampsLimitBelowOneToOne() {
        ArgumentCaptor<Integer> limitCaptor = ArgumentCaptor.forClass(Integer.class);
        when(recommendationService.recommend(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                limitCaptor.capture()))
                .thenReturn(new ArrayList<>());

        controller.recommend("WALKING", "AIR_QUALITY", 0);

        assertThat(limitCaptor.getValue()).isEqualTo(1);
    }

    @Test
    void clampsLimitAboveFiftyToFifty() {
        ArgumentCaptor<Integer> limitCaptor = ArgumentCaptor.forClass(Integer.class);
        when(recommendationService.recommend(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                limitCaptor.capture()))
                .thenReturn(new ArrayList<>());

        controller.recommend("WALKING", "AIR_QUALITY", 999);

        assertThat(limitCaptor.getValue()).isEqualTo(50);
    }

    @Test
    void allowsValidLimit() {
        ArgumentCaptor<Integer> limitCaptor = ArgumentCaptor.forClass(Integer.class);
        when(recommendationService.recommend(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                limitCaptor.capture()))
                .thenReturn(new ArrayList<>());

        controller.recommend("CYCLING", "WATER_QUALITY", 8);

        assertThat(limitCaptor.getValue()).isEqualTo(8);
    }

    @Test
    void worksWithNullProfileParams() {
        when(recommendationService.recommend(null, null, 5))
                .thenReturn(new ArrayList<>());

        List<Recommendation> result = controller.recommend(null, null, 5);

        assertThat(result).isNotNull();
    }
}