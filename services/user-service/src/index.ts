import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from '../../../shared/errors'
import { checkDbHealth } from './db';
import { connectRabbitMQ, checkRmqHealth } from './rabbitmq';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import followRoutes from './routes/follow';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ── Security & Middleware ─────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Global rate limit ─────────────────────────────────────────
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests' },
}));

// ── Health Check ──────────────────────────────────────────────
app.get('/health', async (_req, res) => {
    const [db, rmq] = await Promise.all([checkDbHealth(), checkRmqHealth()]);
    const healthy = db && rmq;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'error',
        service: 'user-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: { db, rabbitmq: rmq },
    });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/', authRoutes);       // POST /register, /login, /refresh, /logout
app.use('/', profileRoutes);    // GET /profile/:id, PUT /profile
app.use('/', followRoutes);     // POST /follow/:id, DELETE /unfollow/:id

// ── Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ─────────────────────────────────────────────────────
async function start() {
    try {
        await connectRabbitMQ();
        app.listen(PORT, () => {
            console.log(`[user-service] Listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('[user-service] Failed to start:', err);
        process.exit(1);
    }
}

start();

export default app;
