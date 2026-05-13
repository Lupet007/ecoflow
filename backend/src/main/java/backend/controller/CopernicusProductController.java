package backend.controller;

import backend.model.CopernicusProduct;
import backend.repository.CopernicusProductRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/copernicus-products")
public class CopernicusProductController {

    private final CopernicusProductRepository repository;

    public CopernicusProductController(CopernicusProductRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<CopernicusProduct> getAllProducts() {
        return repository.findAll();
    }
}