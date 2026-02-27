package adma.sa2_sa3.backend.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * Request body for POST /api/urls/sync
 * <p>
 * Carries a list of original (long) URLs that an anonymous user created in
 * localStorage. After the user registers or logs in, these are synced to the
 * backend and associated with their account.
 */
@Data
public class SyncUrlsRequest {

    /**
     * Original URLs to sync. Must not be empty and capped at 100 to prevent abuse.
     */
    @NotEmpty(message = "urls must not be empty")
    @Size(max = 100, message = "Cannot sync more than 100 URLs at once")
    private List<String> urls;
}
