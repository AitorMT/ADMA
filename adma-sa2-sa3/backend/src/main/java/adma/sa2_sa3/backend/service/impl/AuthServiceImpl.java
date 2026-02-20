package adma.sa2_sa3.backend.service.impl;

import adma.sa2_sa3.backend.domain.User;
import adma.sa2_sa3.backend.dto.AuthResponse;
import adma.sa2_sa3.backend.dto.LoginRequest;
import adma.sa2_sa3.backend.dto.RegisterRequest;
import adma.sa2_sa3.backend.exception.ConflictException;
import adma.sa2_sa3.backend.exception.UnauthorizedException;
import adma.sa2_sa3.backend.repository.UserRepository;
import adma.sa2_sa3.backend.security.JwtTokenProvider;
import adma.sa2_sa3.backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link AuthService}.
 * <p>
 * This class contains all business logic for user registration and login.
 * Controllers remain thin – they only parse HTTP requests and delegate here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * Registers a new user.
     * <ol>
     *   <li>Guards against duplicate email (HTTP 409).</li>
     *   <li>Hashes the password with BCrypt before persisting.</li>
     *   <li>Issues a JWT immediately so the user is signed in upon registration.</li>
     * </ol>
     */
    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email already registered: " + request.getEmail());
        }

        // Hash the plaintext password – it will NEVER be stored in plaintext
        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User user = User.builder()
            .name(request.getName())
            .email(request.getEmail())
            .password(hashedPassword)
            .build();

        userRepository.save(user);
        log.info("New user registered: {}", user.getEmail());

        String token = jwtTokenProvider.generateToken(user.getEmail());
        return AuthResponse.builder()
            .token(token)
            .name(user.getName())
            .email(user.getEmail())
            .build();
    }

    /**
     * Authenticates an existing user.
     * <ol>
     *   <li>Looks up the user by email.</li>
     *   <li>Verifies the BCrypt hash – never compares plaintext.</li>
     *   <li>Returns a signed JWT on success.</li>
     * </ol>
     */
    @Override
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() ->
                // Generic message to avoid user-enumeration attacks
                new UnauthorizedException("Invalid email or password")
            );

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        log.info("User logged in: {}", user.getEmail());

        String token = jwtTokenProvider.generateToken(user.getEmail());
        return AuthResponse.builder()
            .token(token)
            .name(user.getName())
            .email(user.getEmail())
            .build();
    }
}
