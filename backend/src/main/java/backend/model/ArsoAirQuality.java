package backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "arso_air_quality",
        uniqueConstraints = @UniqueConstraint(columnNames = {"station_code", "measured_from"}))
public class ArsoAirQuality {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "station_code")
    private String stationCode;

    @Column(name = "station_name")
    private String stationName;

    private Double latitude;

    private Double longitude;

    @Column(name = "measured_from")
    private LocalDateTime measuredFrom;

    @Column(name = "measured_to")
    private LocalDateTime measuredTo;

    private Double pm10;

    @Column(name = "pm2_5")
    private Double pm2_5;

    private Double no2;

    private Double o3;

    private Double co;

    private Double so2;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public String getStationCode() {
        return stationCode;
    }

    public String getStationName() {
        return stationName;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public LocalDateTime getMeasuredFrom() {
        return measuredFrom;
    }

    public LocalDateTime getMeasuredTo() {
        return measuredTo;
    }

    public Double getPm10() {
        return pm10;
    }

    public Double getPm2_5() {
        return pm2_5;
    }

    public Double getNo2() {
        return no2;
    }

    public Double getO3() {
        return o3;
    }

    public Double getCo() {
        return co;
    }

    public Double getSo2() {
        return so2;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
