import { connectRabbitMQ, consume, closeRabbitMQ } from './rabbitmq';
import { checkDbHealth } from './db';
import { checkMinioHealth } from './minio';
import { checkEsHealth } from './elasticsearch';
import { closeBrowser } from './thumbnail';
import { processGame } from './processor';

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
        } catch (err) {
            console.log(`[startup] ${name} not ready (attempt ${i}/${attempts}), retrying in ${delayMs / 1000}s...`);
            if (i === attempts) throw err;
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
    console.log(`[game-processor] ${signal} received — shutting down gracefully`);
    try {
        await closeBrowser();
        await closeRabbitMQ();
        console.log('[game-processor] Clean shutdown complete');
    } catch (err) {
        console.error('[game-processor] Error during shutdown:', err);
    }
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log('[game-processor] Starting up...');

    // Wait for all infra to be ready
    await connectWithRetry(connectRabbitMQ, 'RabbitMQ');

    // Log health of other dependencies (non-blocking — worker continues)
    const [dbOk, minioOk, esOk] = await Promise.all([
        checkDbHealth(),
        checkMinioHealth(),
        checkEsHealth(),
    ]);
    console.log(`[game-processor] Health — DB:${dbOk} MinIO:${minioOk} ES:${esOk}`);

    if (!dbOk) throw new Error('PostgreSQL not reachable — cannot process games');
    if (!minioOk) throw new Error('MinIO not reachable — cannot process game files');

    // Start consuming
    await consume(processGame);
    console.log('[game-processor] Ready and waiting for messages 🎮');
}

main().catch((err) => {
    console.error('[game-processor] Fatal startup error:', err);
    process.exit(1);
});
