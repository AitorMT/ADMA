package adma.sa2_sa3.backend.dto;

import adma.sa2_sa3.backend.domain.ShortUrl.LinkStatus;
import adma.sa2_sa3.backend.domain.ShortUrl.LinkType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Outbound representation of a {@link adma.sa2_sa3.backend.domain.ShortUrl}. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShortUrlResponse {

    private Long   id;
    private String originalUrl;
    private String shortCode;

    /** Fully-qualified short URL ready to be shared (e.g. {@code https://short.ly/aB3xYz}). */
    private String shortUrl;

    private Instant createdAt;

    /** Null for permanent (registered) links; set for anonymous (temporary) links. */
    private Instant expiresAt;

    /** TEMPORARY or PERMANENT */
    private LinkType linkType;

    /** ACTIVE, EXPIRED, or DELETED */
    private LinkStatus status;

    /** Total number of times this link has been followed. */
    private Long redirectCount;

    /** Running average redirect latency in milliseconds. Null until first redirect. */
    private Double avgRedirectMs;

    /** Last HTTP status of the destination URL. Null until first availability check. */
    private Integer destinationStatus;

    /** When the destination was last checked for availability. */
    private Instant lastCheckedAt;
}
