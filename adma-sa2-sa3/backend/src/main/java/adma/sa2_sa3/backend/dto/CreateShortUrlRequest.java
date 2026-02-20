package adma.sa2_sa3.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Inbound payload for {@code POST /api/urls}. */
@Data
public class CreateShortUrlRequest {

    @NotBlank(message = "Original URL is required")
    @Size(max = 2048, message = "URL must be at most 2048 characters")
    @Pattern(
        regexp = "^(https?|ftp)://.*",
        message = "URL must start with http://, https://, or ftp://"
    )
    private String originalUrl;
}
