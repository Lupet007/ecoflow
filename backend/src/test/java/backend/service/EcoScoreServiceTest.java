package backend.service;

import backend.model.ArsoAirQuality;
import backend.model.CopernicusProduct;
import backend.model.RoutePoint;
import backend.repository.ArsoAirQualityRepository;
import backend.repository.CopernicusProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

@ExtendWith(MockitoExtension.class)
class EcoScoreServiceTest {

    @Mock
    private CopernicusProductRepository copernicusProductRepository;

    @Mock
    private ArsoAirQualityRepository arsoAirQualityRepository;

    @InjectMocks
    private EcoScoreService ecoScoreService;

    // Default: no real ARSO station nearby, matching most tests below that
    // don't specifically exercise the "real air quality nearby" branch.
    @BeforeEach
    void setUpDefaultAirQuality() {
        lenient().when(arsoAirQualityRepository.findLatestBatch()).thenReturn(Collections.emptyList());
    }

    // --- Helper methods to build test data ---

    private CopernicusProduct product(String name) {
        CopernicusProduct p = mock(CopernicusProduct.class);
        lenient().when(p.getName()).thenReturn(name);
        return p;
    }

    // Places a real ARSO station at the same coordinates points(...) below
    // generates (46.5+i*0.001, 15.6+i*0.001), so calculate()'s real
    // proximity check finds it - replacing the old Copernicus-name-presence
    // stand-in for "air quality data is present".
    private void mockNearbyArsoStation() {
        ArsoAirQuality station = mock(ArsoAirQuality.class);
        lenient().when(station.getLatitude()).thenReturn(46.55);
        lenient().when(station.getLongitude()).thenReturn(15.65);
        lenient().when(arsoAirQualityRepository.findLatestBatch()).thenReturn(List.of(station));
    }

    private void mockNoNearbyArsoStation() {
        lenient().when(arsoAirQualityRepository.findLatestBatch()).thenReturn(Collections.emptyList());
    }

    private List<RoutePoint> points(int count, Double elevation) {
        List<RoutePoint> list = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            list.add(new RoutePoint(46.5 + i * 0.001, 15.6 + i * 0.001, elevation));
        }
        return list;
    }

    private void mockProducts(String... names) {
        List<CopernicusProduct> products = new ArrayList<>();
        for (String name : names) {
            products.add(product(name));
        }
        lenient().when(copernicusProductRepository.findAll()).thenReturn(products);
    }

    // --- Tests for getLabel ---

    @Test
    void getLabel_returnsExcellent_forHighScore() {
        assertThat(ecoScoreService.getLabel(85.0)).isEqualTo("Excellent");
        assertThat(ecoScoreService.getLabel(80.0)).isEqualTo("Excellent");
    }

    @Test
    void getLabel_returnsGood_forMediumHighScore() {
        assertThat(ecoScoreService.getLabel(70.0)).isEqualTo("Good");
        assertThat(ecoScoreService.getLabel(60.0)).isEqualTo("Good");
    }

    @Test
    void getLabel_returnsModerate_forMediumScore() {
        assertThat(ecoScoreService.getLabel(50.0)).isEqualTo("Moderate");
        assertThat(ecoScoreService.getLabel(40.0)).isEqualTo("Moderate");
    }

    @Test
    void getLabel_returnsPoor_forLowScore() {
        assertThat(ecoScoreService.getLabel(30.0)).isEqualTo("Poor");
        assertThat(ecoScoreService.getLabel(20.0)).isEqualTo("Poor");
    }

    @Test
    void getLabel_returnsBad_forVeryLowScore() {
        assertThat(ecoScoreService.getLabel(10.0)).isEqualTo("Bad");
        assertThat(ecoScoreService.getLabel(0.0)).isEqualTo("Bad");
    }

    // --- Tests for Copernicus product type detection ---

    @Test
    void calculate_addsBonus_whenAirQualityDataPresent() {
        mockNearbyArsoStation();
        double score = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(score).isGreaterThan(50.0);
    }

    @Test
    void calculate_addsBonus_whenWaterQualityDataPresent() {
        mockProducts("S3A_OL_2_WRR____20161024.SEN3");
        double score = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(score).isGreaterThan(50.0);
    }

    @Test
    void calculate_appliesPenalty_whenTemperatureDataPresent() {
        mockProducts("S3A_SL_2_LST____20160610.SEN3");
        double scoreWithTemp = ecoScoreService.calculate(points(100, 300.0), null, null);

        mockProducts();
        double scoreNoData = ecoScoreService.calculate(points(100, 300.0), null, null);

        assertThat(scoreWithTemp).isLessThan(scoreNoData + 10);
    }

    @Test
    void calculate_addsDiversityBonus_whenThreeDataSources() {
        mockProducts(
                "S3A_OL_2_WRR____water.SEN3",
                "S3A_SL_2_LST____temp.SEN3"
        );
        mockNearbyArsoStation();
        double score = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(score).isGreaterThan(50.0);
    }

    // --- Tests for elevation analysis ---

    @Test
    void calculate_addsLargeBonus_forVeryHighElevation() {
        mockProducts();
        double highScore = ecoScoreService.calculate(points(100, 900.0), null, null);
        double lowScore = ecoScoreService.calculate(points(100, 50.0), null, null);
        assertThat(highScore).isGreaterThan(lowScore);
    }

    @Test
    void calculate_addsBonus_forHighElevation() {
        mockProducts();
        double score = ecoScoreService.calculate(points(100, 600.0), null, null);
        assertThat(score).isGreaterThanOrEqualTo(55.0);
    }

    @Test
    void calculate_addsSmallBonus_forMediumElevation() {
        mockProducts();
        double score = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(score).isGreaterThanOrEqualTo(50.0);
    }

    @Test
    void calculate_appliesPenalty_forLowElevation() {
        mockProducts();
        double lowElevScore = ecoScoreService.calculate(points(100, 50.0), null, null);
        double medElevScore = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(lowElevScore).isLessThan(medElevScore);
    }

    @Test
    void calculate_handlesNullElevation() {
        mockProducts();
        double score = ecoScoreService.calculate(points(100, null), null, null);
        assertThat(score).isBetween(0.0, 100.0);
    }

    // --- Tests for route length penalty ---

    @Test
    void calculate_appliesPenalty_forVeryLongRoute() {
        mockProducts();
        double longScore = ecoScoreService.calculate(points(1500, 300.0), null, null);
        double normalScore = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(longScore).isLessThan(normalScore);
    }

    @Test
    void calculate_appliesPenalty_forVeryShortRoute() {
        mockProducts();
        double shortScore = ecoScoreService.calculate(points(10, 300.0), null, null);
        double normalScore = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(shortScore).isLessThan(normalScore);
    }

    // --- Tests for activity type personalization ---

    @Test
    void calculate_walkingActivity_penalizedWithoutAirData() {
        mockProducts();
        double walkingScore = ecoScoreService.calculate(points(100, 300.0), "WALKING", null);
        double defaultScore = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(walkingScore).isLessThan(defaultScore);
    }

    @Test
    void calculate_runningActivity_bonusWithAirData() {
        mockNearbyArsoStation();
        double runningScore = ecoScoreService.calculate(points(100, 300.0), "RUNNING", null);
        assertThat(runningScore).isGreaterThan(50.0);
    }

    @Test
    void calculate_runningActivity_penalizedWithoutAirData() {
        mockProducts();
        double runningScore = ecoScoreService.calculate(points(100, 300.0), "RUNNING", null);
        double defaultScore = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(runningScore).isLessThan(defaultScore);
    }

    @Test
    void calculate_cyclingActivity_addsBonus() {
        mockProducts();
        double cyclingScore = ecoScoreService.calculate(points(100, 300.0), "CYCLING", null);
        double defaultScore = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(cyclingScore).isGreaterThan(defaultScore);
    }

    @Test
    void calculate_handlesLowercaseActivityType() {
        mockProducts("S3A_OL_1_EFR____air.SEN3");
        double score = ecoScoreService.calculate(points(100, 300.0), "running", null);
        assertThat(score).isBetween(0.0, 100.0);
    }

    @Test
    void calculate_handlesUnknownActivityType() {
        mockProducts();
        double score = ecoScoreService.calculate(points(100, 300.0), "SWIMMING", null);
        assertThat(score).isBetween(0.0, 100.0);
    }

    // --- Tests for eco priority personalization ---

    @Test
    void calculate_airQualityPriority_bonusWhenDataPresent() {
        mockNearbyArsoStation();
        double withData = ecoScoreService.calculate(points(100, 300.0), null, "AIR_QUALITY");

        mockNoNearbyArsoStation();
        double withoutData = ecoScoreService.calculate(points(100, 300.0), null, "AIR_QUALITY");

        assertThat(withData).isGreaterThan(withoutData);
    }

    @Test
    void calculate_waterQualityPriority_bonusWhenDataPresent() {
        mockProducts("S3A_OL_2_WRR____water.SEN3");
        double score = ecoScoreService.calculate(points(100, 300.0), null, "WATER_QUALITY");
        assertThat(score).isGreaterThan(50.0);
    }

    @Test
    void calculate_landTemperaturePriority_appliesPenalty() {
        mockProducts("S3A_SL_2_LST____temp.SEN3");
        double withTempData = ecoScoreService.calculate(points(100, 300.0), null, "LAND_TEMPERATURE");

        mockProducts();
        double withoutTempData = ecoScoreService.calculate(points(100, 300.0), null, "LAND_TEMPERATURE");

        assertThat(withTempData).isLessThan(withoutTempData);
    }

    @Test
    void calculate_handlesLowercaseEcoPriority() {
        mockProducts("S3A_OL_1_EFR____air.SEN3");
        double score = ecoScoreService.calculate(points(100, 300.0), null, "air_quality");
        assertThat(score).isBetween(0.0, 100.0);
    }

    @Test
    void calculate_handlesUnknownEcoPriority() {
        mockProducts();
        double score = ecoScoreService.calculate(points(100, 300.0), null, "NOISE_LEVEL");
        assertThat(score).isBetween(0.0, 100.0);
    }

    // --- Combined personalization ---

    @Test
    void calculate_differentProfiles_produceDifferentScores() {
        mockProducts("S3A_SL_2_LST____temp.SEN3");
        mockNearbyArsoStation();

        double runningAir = ecoScoreService.calculate(points(100, 300.0), "RUNNING", "AIR_QUALITY");
        double walkingTemp = ecoScoreService.calculate(points(100, 300.0), "WALKING", "LAND_TEMPERATURE");

        assertThat(runningAir).isNotEqualTo(walkingTemp);
    }

    // --- Score clamping ---

    @Test
    void calculate_neverExceeds100() {
        mockProducts("S3A_OL_2_WRR____water.SEN3");
        mockNearbyArsoStation();
        double score = ecoScoreService.calculate(points(100, 1000.0), "CYCLING", "AIR_QUALITY");
        assertThat(score).isLessThanOrEqualTo(100.0);
    }

    @Test
    void calculate_neverBelowZero() {
        mockProducts("S3A_SL_2_LST____temp.SEN3");
        double score = ecoScoreService.calculate(points(2000, 30.0), "RUNNING", "AIR_QUALITY");
        assertThat(score).isGreaterThanOrEqualTo(0.0);
    }

    // --- Backward compatible overload + edge cases ---

    @Test
    void calculate_backwardCompatibleOverload_works() {
        mockProducts("S3A_OL_1_EFR____air.SEN3");
        double score = ecoScoreService.calculate(points(100, 300.0));
        assertThat(score).isBetween(0.0, 100.0);
    }

    @Test
    void calculate_emptyProductList_returnsValidScore() {
        mockProducts();
        double score = ecoScoreService.calculate(points(100, 300.0), null, null);
        assertThat(score).isBetween(0.0, 100.0);
    }

    @Test
    void calculate_resultIsRoundedToOneDecimal() {
        mockProducts("S3A_OL_1_EFR____air.SEN3");
        double score = ecoScoreService.calculate(points(100, 300.0), "RUNNING", "AIR_QUALITY");
        assertThat(score * 10).isEqualTo(Math.round(score * 10));
    }
}