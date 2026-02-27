package adma.sa2_sa3.backend.service;

import adma.sa2_sa3.backend.repository.ShortUrlRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Scheduled service that purges expired anonymous short URLs from the database.
 *
 * <p><strong>Distributed safety:</strong> annotated with {@code @SchedulerLock}
 * (ShedLock). Even when multiple backend replicas are running on ECS Fargate,
 * only one instance will execute this job per cycle. The lock is stored in the
 * {@code shedlock} table in PostgreSQL — no Redis or ZooKeeper required.
 *
 * <p>Strategy: two-phase approach within a single transaction —
 * <ol>
 *   <li>Mark all {@code ACTIVE} rows whose {@code expiresAt < now} as {@code EXPIRED}.</li>
 *   <li>Hard-delete all {@code EXPIRED} rows.</li>
 * </ol>
 * This prevents a race condition where a redirect check sees a row mid-deletion.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExpiredUrlCleanupService {

    private final ShortUrlRepository shortUrlRepository;

    /**
     * Runs every 15 minutes. ShedLock holds the lock for at most 14 minutes
     * (configured in AppConfig via {@code defaultLockAtMostFor = "PT14M"}),
     * slightly less than the interval — so if a previous execution hangs and
     * the lock was not released, the next cycle can still acquire it.
     *
     * <p>{@code lockAtLeastFor = "PT10M"} prevents a second instance from
     * immediately running the job again if the first finishes in under 10 minutes.
     */
    @Scheduled(fixedDelayString = "PT15M", initialDelayString = "PT1M")
    @SchedulerLock(name = "purgeExpiredLinks", lockAtLeastFor = "PT10M", lockAtMostFor = "PT14M")
    @Transactional
    public void purgeExpiredLinks() {
        Instant now = Instant.now();
        int marked  = shortUrlRepository.markExpired(now);

        if (marked > 0) {
            int deleted = shortUrlRepository.deleteExpired();
            log.info("Cleanup: marked {} links EXPIRED, hard-deleted {} rows (run at {})",
                marked, deleted, now);
        } else {
            log.debug("Cleanup: no expired links found at {}", now);
        }
    }
}
