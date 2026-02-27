package adma.sa2_sa3.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Inbound payload for {@code POST /auth/login}. */
@Data
public class LoginRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be a valid address")
    private String email;

    @NotBlank(message = "Password is required")
    private String password;
}
