package backend.repository;

import backend.model.CopernicusProduct;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CopernicusProductRepository extends JpaRepository<CopernicusProduct, Long> {
}