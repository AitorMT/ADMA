package adma.sa2_sa3.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Outbound payload returned after a successful login or registration. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    /** JWT Bearer token to be included in subsequent requests. */
    private String token;

    /** Convenience field – client can display the user's name without decoding the JWT. */
    private String name;

    /** Authenticated user's email (matches the JWT subject). */
    private String email;
}
