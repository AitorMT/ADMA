package adma.sa2_sa3.backend.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Public platform statistics returned by {@code GET /api/stats}.
 * All fields are aggregate values computed directly from the database —
 * no hardcoded numbers.
 */
@Value
@Builder
public class StatsResponse {

    /** Total short URLs ever created on the platform. */
    long totalLinks;

    /** Sum of all redirect events across every short URL. */
    long totalRedirects;

    /**
     * Global average redirect latency in milliseconds.
     * Rounded to one decimal place. {@code null} when no redirects have
     * been recorded yet (avoids showing "0 ms" on a fresh instance).
     */
    Double avgLatencyMs;
}
