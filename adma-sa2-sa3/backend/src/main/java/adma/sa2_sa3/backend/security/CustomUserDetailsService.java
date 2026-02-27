package adma.sa2_sa3.backend.security;

import adma.sa2_sa3.backend.domain.User;
import adma.sa2_sa3.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Loads user information from the database for Spring Security's authentication
 * pipeline. Implements {@link UserDetailsService} (ISP – Interface Segregation)
 * so only the required contract is fulfilled.
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * Locate a {@link User} by email and wrap it in a Spring Security
     * {@link UserDetails} object.
     *
     * @param email the user's email address (JWT subject)
     * @throws UsernameNotFoundException if no user exists with that email
     */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() ->
                new UsernameNotFoundException("No user found with email: " + email)
            );

        return org.springframework.security.core.userdetails.User.builder()
            .username(user.getEmail())
            .password(user.getPassword())           // already BCrypt-hashed
            .authorities(List.of(new SimpleGrantedAuthority("ROLE_USER")))
            .build();
    }
}
