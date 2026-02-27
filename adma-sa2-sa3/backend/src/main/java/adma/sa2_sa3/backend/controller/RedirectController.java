package adma.sa2_sa3.backend.controller;

import adma.sa2_sa3.backend.exception.LinkExpiredException;
import adma.sa2_sa3.backend.exception.ResourceNotFoundException;
import adma.sa2_sa3.backend.service.ShortUrlService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public redirect endpoint.
 * <p>
 * This controller deliberately lives at the root path (not under {@code /api})
 * to produce clean short URLs like {@code https://short.ly/aB3xYz}.
 * <p>
 * When a short code is valid, the browser is sent a 302 → original URL.
 * When a short code is unknown or expired, the browser is redirected to the
 * frontend SPA error page ({@code /r/:code}) instead of receiving raw JSON,
 * so the user always sees a polished error screen.
 */
@RestController
@RequiredArgsConstructor
public class RedirectController {

    private final ShortUrlService shortUrlService;

    /** Frontend origin — used to build the SPA error redirect URL. */
    @Value("${app.frontend-url:http://localhost}")
    private String frontendUrl;

    /**
     * Resolves a short code and issues an HTTP 302 redirect.
     * <p>
     * Response matrix:
     * <ul>
     *   <li>302 → original URL — valid, active link</li>
     *   <li>302 → {frontendUrl}/r/{code}?error=not_found — code not in DB</li>
     *   <li>302 → {frontendUrl}/r/{code}?error=expired  — link has expired</li>
     * </ul>
     * Browser users always land on either the destination or the SPA error page.
     * API clients (fetching with Accept: application/json) that need the raw
     * status codes should call the /api/urls endpoint instead.
     */
    @GetMapping("/{shortCode:[a-zA-Z0-9]{4,10}}")
    public ResponseEntity<Void> redirect(@PathVariable String shortCode) {
        long start = System.currentTimeMillis();
        try {
            String originalUrl = shortUrlService.resolveShortCode(shortCode,
                System.currentTimeMillis() - start);

            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.LOCATION, originalUrl);
            return ResponseEntity.status(HttpStatus.FOUND).headers(headers).build();

        } catch (LinkExpiredException e) {
            return spaErrorRedirect(shortCode, "expired");

        } catch (ResourceNotFoundException e) {
            return spaErrorRedirect(shortCode, "not_found");
        }
    }

    /** Builds a 302 to the SPA's /r/:code page with an error query param. */
    private ResponseEntity<Void> spaErrorRedirect(String shortCode, String errorType) {
        String spaUrl = frontendUrl.stripTrailing() + "/r/" + shortCode + "?error=" + errorType;
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.LOCATION, spaUrl);
        return ResponseEntity.status(HttpStatus.FOUND).headers(headers).build();
    }
}
