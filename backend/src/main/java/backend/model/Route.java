package backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "routes")
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(name = "coordinates", columnDefinition = "TEXT")
    private String coordinates; 

    @Column(name = "point_count")
    private Integer pointCount;

    @Column(name = "eco_score")
    private Double ecoScore;

    @Column(name = "eco_score_label")
    private String ecoScoreLabel;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @PrePersist
    public void prePersist() {
        this.uploadedAt = LocalDateTime.now();
    }


    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCoordinates() {
        return coordinates;
    }

    public void setCoordinates(String coordinates) {
        this.coordinates = coordinates;
    }

    public Integer getPointCount() {
        return pointCount;
    }

    public void setPointCount(Integer pointCount) {
        this.pointCount = pointCount;
    }

    public Double getEcoScore() {
        return ecoScore;
    }

    public void setEcoScore(Double ecoScore) {
        this.ecoScore = ecoScore;
    }

    public String getEcoScoreLabel() {
        return ecoScoreLabel;
    }

    public void setEcoScoreLabel(String ecoScoreLabel) {
        this.ecoScoreLabel = ecoScoreLabel;
    }

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }
}
