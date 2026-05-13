package backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "copernicus_products")
public class CopernicusProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id")
    private String productId;

    private String name;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "content_length")
    private Long contentLength;

    @Column(name = "origin_date")
    private LocalDateTime originDate;

    @Column(name = "publication_date")
    private LocalDateTime publicationDate;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public String getProductId() {
        return productId;
    }

    public String getName() {
        return name;
    }

    public String getContentType() {
        return contentType;
    }

    public Long getContentLength() {
        return contentLength;
    }

    public LocalDateTime getOriginDate() {
        return originDate;
    }

    public LocalDateTime getPublicationDate() {
        return publicationDate;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}