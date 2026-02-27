package adma.sa2_sa3.backend.repository;

import adma.sa2_sa3.backend.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Repository for {@link User} persistence operations.
 * Spring Data JPA generates the implementation at runtime.
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /** Look up a user by email (used during login and JWT validation). */
    Optional<User> findByEmail(String email);

    /** Check existence before attempting registration (prevents a round-trip). */
    boolean existsByEmail(String email);
}
