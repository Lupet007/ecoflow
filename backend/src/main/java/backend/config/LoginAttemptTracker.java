package backend.config;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-memory brute-force guard for the login endpoint. Tracks failed
 * attempts per email and temporarily blocks further tries after too many
 * failures in a short window - a basic, dependency-free defense against
 * password-guessing attacks.
 */
@Component
public class LoginAttemptTracker {

    private static final int MAX_ATTEMPTS = 5;
    private static final long WINDOW_SECONDS = 15 * 60;

    private final ConcurrentHashMap<String, Attempts> attemptsByEmail = new ConcurrentHashMap<>();

    private record Attempts(int count, Instant windowStart) {
    }

    public boolean isBlocked(String email) {
        Attempts attempts = attemptsByEmail.get(normalize(email));
        if (attempts == null) return false;

        if (Instant.now().isAfter(attempts.windowStart().plusSeconds(WINDOW_SECONDS))) {
            attemptsByEmail.remove(normalize(email));
            return false;
        }

        return attempts.count() >= MAX_ATTEMPTS;
    }

    public void recordFailure(String email) {
        attemptsByEmail.compute(normalize(email), (key, current) -> {
            if (current == null || Instant.now().isAfter(current.windowStart().plusSeconds(WINDOW_SECONDS))) {
                return new Attempts(1, Instant.now());
            }
            return new Attempts(current.count() + 1, current.windowStart());
        });
    }

    public void recordSuccess(String email) {
        attemptsByEmail.remove(normalize(email));
    }

    private String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
