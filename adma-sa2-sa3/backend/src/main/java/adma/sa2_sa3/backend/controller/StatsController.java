package adma.sa2_sa3.backend.controller;

import adma.sa2_sa3.backend.dto.StatsResponse;
import adma.sa2_sa3.backend.repository.ShortUrlRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

/**
 * Public read-only endpoint that exposes aggregate platform statistics.
 * No authentication required — used by the landing page footer.
 *
 * <p>The response is cached for 30 seconds via the {@code Cache-Control} header
 * so that simultaneous page loads don't hammer the database.</p>
 */
@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final ShortUrlRepository shortUrlRepository;

    /**
     * Returns live aggregate stats:
     * <ul>
     *   <li>{@code totalLinks}    – total short URLs ever created</li>
     *   <li>{@code totalRedirects} – sum of all redirect events</li>
     *   <li>{@code avgLatencyMs}  – global mean redirect latency (ms), null if no data</li>
     * </ul>
     */
    @GetMapping
    public ResponseEntity<StatsResponse> getStats() {
        long   totalLinks    = shortUrlRepository.countTotal();
        long   totalRedirects = shortUrlRepository.sumRedirects();
        double rawLatency    = shortUrlRepository.avgLatencyMs();

        // Only expose latency when we actually have redirect data
        Double avgLatencyMs = totalRedirects > 0
            ? Math.round(rawLatency * 10.0) / 10.0
            : null;

        StatsResponse body = StatsResponse.builder()
            .totalLinks(totalLinks)
            .totalRedirects(totalRedirects)
            .avgLatencyMs(avgLatencyMs)
            .build();

        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(30, TimeUnit.SECONDS).cachePublic())
            .body(body);
    }
}
