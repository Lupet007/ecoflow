package backend.repository;

import backend.model.ArsoAirQuality;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ArsoAirQualityRepository extends JpaRepository<ArsoAirQuality, Long> {

    @Query("SELECT a FROM ArsoAirQuality a WHERE a.measuredFrom = " +
            "(SELECT MAX(m.measuredFrom) FROM ArsoAirQuality m)")
    List<ArsoAirQuality> findLatestBatch();
}
