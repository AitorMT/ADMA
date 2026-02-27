package adma.sa2_sa3.backend.controller;

import adma.sa2_sa3.backend.dto.AuthResponse;
import adma.sa2_sa3.backend.dto.LoginRequest;
import adma.sa2_sa3.backend.dto.RegisterRequest;
import adma.sa2_sa3.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Handles user registration and login.
 * <p>
 * Thin controller – all business logic is delegated to {@link AuthService}.
 * Validation is handled declaratively via {@code @Valid} + Bean Validation.
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Registers a new user account.
     *
     * @return 201 Created with JWT auth response
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Authenticates an existing user.
     *
     * @return 200 OK with JWT auth response
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }
}
