package adma.sa2_sa3.backend.service;

import adma.sa2_sa3.backend.dto.AuthResponse;
import adma.sa2_sa3.backend.dto.LoginRequest;
import adma.sa2_sa3.backend.dto.RegisterRequest;

/**
 * Contract for user authentication operations.
 * <p>
 * Keeping this interface narrow (ISP) means callers only depend on
 * auth-related behaviour, not on unrelated user-management operations.
 */
public interface AuthService {

    /**
     * Registers a new user and returns a JWT so the client is immediately signed in.
     *
     * @param request validated registration payload
     * @return JWT auth response
     */
    AuthResponse register(RegisterRequest request);

    /**
     * Authenticates an existing user and returns a JWT.
     *
     * @param request validated login payload
     * @return JWT auth response
     */
    AuthResponse login(LoginRequest request);
}
