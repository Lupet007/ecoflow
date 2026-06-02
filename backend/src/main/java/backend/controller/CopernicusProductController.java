package backend.controller;

import backend.model.CopernicusProduct;
import backend.repository.CopernicusProductRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/copernicus-products")
public class CopernicusProductController {

    private final CopernicusProductRepository repository;

    public CopernicusProductController(CopernicusProductRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<?> getAllProducts() {
        try {
            List<CopernicusProduct> products = repository.findAll();
            return ResponseEntity.ok(products);
        } catch (Exception e){
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to fetch Copernicus products"));
        }
    }
}