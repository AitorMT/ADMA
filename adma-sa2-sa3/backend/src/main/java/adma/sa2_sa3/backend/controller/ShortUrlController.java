package adma.sa2_sa3.backend.controller;

import adma.sa2_sa3.backend.dto.CreateShortUrlRequest;
import adma.sa2_sa3.backend.dto.ShortUrlResponse;
import adma.sa2_sa3.backend.dto.SyncUrlsRequest;
import adma.sa2_sa3.backend.service.ShortUrlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * URL management endpoints.
 * <p>
 * Public endpoints (no auth required):
 *   POST /api/urls/public  – anonymous URL creation (stored without an owner)
 * <p>
 * Authenticated endpoints (JWT required):
 *   POST /api/urls          – create short URL owned by the current user
 *   GET  /api/urls          – list all short URLs owned by the current user
 *   POST /api/urls/sync     – bulk-sync anonymous localStorage URLs to the user
 */
@RestController
@RequestMapping("/api/urls")
@RequiredArgsConstructor
public class ShortUrlController {

    private final ShortUrlService shortUrlService;

    // ── Authenticated: create ─────────────────────────────────────────────────

    /**
     * Creates a new short URL for the authenticated user.
     *
     * @param request       validated payload with the original URL
     * @param userDetails   injected by Spring Security from the JWT context
     * @return 201 Created with the short URL response
     */
    @PostMapping
    public ResponseEntity<ShortUrlResponse> createShortUrl(
        @Valid @RequestBody CreateShortUrlRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        ShortUrlResponse response = shortUrlService.createShortUrl(request, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ── Authenticated: list ───────────────────────────────────────────────────

    /**
     * Lists all short URLs owned by the authenticated user (newest first).
     *
     * @param userDetails injected by Spring Security from the JWT context
     * @return 200 OK with the list of short URL responses
     */
    @GetMapping
    public ResponseEntity<List<ShortUrlResponse>> listMyUrls(
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        List<ShortUrlResponse> urls = shortUrlService.listUrlsForUser(userDetails.getUsername());
        return ResponseEntity.ok(urls);
    }

    // ── Authenticated: delete ─────────────────────────────────────────────────

    /**
     * Soft-deletes a short URL owned by the authenticated user.
     * Returns 204 No Content on success, 404 if not found, 401 if not the owner.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteShortUrl(
        @PathVariable Long id,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        shortUrlService.deleteShortUrl(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    // ── Authenticated: sync anonymous URLs ────────────────────────────────────

    /**
     * Bulk-syncs anonymous localStorage URLs to the authenticated user's account.
     * Duplicates (already owned by the user) are silently skipped.
     *
     * @param request     list of original URLs to claim
     * @param userDetails injected by Spring Security from the JWT context
     * @return 200 OK with the user's full updated URL list
     */
    @PostMapping("/sync")
    public ResponseEntity<List<ShortUrlResponse>> syncUrls(
        @Valid @RequestBody SyncUrlsRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        List<ShortUrlResponse> updated =
            shortUrlService.syncAnonymousUrls(request.getUrls(), userDetails.getUsername());
        return ResponseEntity.ok(updated);
    }

    // ── Public: anonymous create ──────────────────────────────────────────────

    /**
     * Creates a new short URL without requiring authentication.
     * The entry is stored with {@code userId = null} and can later be claimed
     * via {@code POST /api/urls/sync} after the user registers or logs in.
     *
     * @param request validated payload with the original URL
     * @return 201 Created with the short URL response
     */
    @PostMapping("/public")
    public ResponseEntity<ShortUrlResponse> createPublicShortUrl(
        @Valid @RequestBody CreateShortUrlRequest request
    ) {
        ShortUrlResponse response = shortUrlService.createAnonymousShortUrl(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
