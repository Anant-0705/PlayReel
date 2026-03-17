import { connectRabbitMQ, consume, closeRabbitMQ } from './rabbitmq';
import { checkDbHealth } from './db';
import { initFirebase } from './firebase';
import { routeMessage } from './handlers';
import { QUEUES } from '../../shared/events';

// ── Startup retry ─────────────────────────────────────────────────────────

async function connectWithRetry(
    fn: () => Promise<void>,
    name: string,
    attempts = 10,
    delayMs = 5_000,
): Promise<void> {
    for (let i = 1; i <= attempts; i++) {
        try {
            await fn();
            console.log(`[startup] ${name} connected`);
            return;
        } catch {
            console.log(`[startup] ${name} not ready (${i}/${attempts}), retrying in ${delayMs / 1000}s...`);
            if (i === attempts) throw new Error(`${name} failed after ${attempts} attempts`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
    console.log(`[notification-worker] ${signal} received — shutting down`);
    await closeRabbitMQ().catch(() => { /* ignore */ });
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log('[notification-worker] Starting up...');

    // Init Firebase (non-blocking — worker continues without it)
    initFirebase();

    // Wait for RabbitMQ and DB
    await connectWithRetry(connectRabbitMQ, 'RabbitMQ');
    const dbOk = await checkDbHealth();
    if (!dbOk) throw new Error('PostgreSQL not reachable — cannot look up device tokens');
    console.log('[startup] PostgreSQL connected');

    // Consume both queues with the same router
    await consume(QUEUES.NOTIFICATIONS_PUSH, routeMessage);
    await consume(QUEUES.FOLLOWS, routeMessage);

    console.log('[notification-worker] Ready and waiting for events 🔔');
}

main().catch((err) => {
    console.error('[notification-worker] Fatal startup error:', err);
    process.exit(1);
});
