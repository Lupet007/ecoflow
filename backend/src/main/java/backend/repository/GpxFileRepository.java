package backend.repository;

import backend.model.GpxFile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GpxFileRepository extends JpaRepository<GpxFile, Long> {
    List<GpxFile> findByUploadedById(Long userId);
}