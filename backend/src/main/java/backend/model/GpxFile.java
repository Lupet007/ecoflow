package backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Entity
@Table(name = "gpx_files")
public class GpxFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fileName;        // original file name
    private String filePath;        // where it's saved on disk

    // --- parsed metadata ---
    private Double totalDistanceKm;
    private Double elevationGainM;
    private Integer totalPoints;    // number of track points

    private LocalDateTime uploadedAt;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User uploadedBy;        // links to the logged-in user
}