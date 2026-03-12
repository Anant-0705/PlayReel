import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from '../../../shared/errors';
import { checkDbHealth } from './db';
import { connectRedis, checkRedisHealth } from './redis';
import { connectRabbitMQ, checkRmqHealth } from './rabbitmq';
import feedRoutes from './routes/feed';

const app = express();
const PORT = Number(process.env.PORT) || 3003;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.get('/health', async (_req, res) => {
    const [db, redis, rmq] = await Promise.all([checkDbHealth(), checkRedisHealth(), checkRmqHealth()]);
    const healthy = db && redis && rmq;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'error',
        service: 'feed-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: { db, redis, rabbitmq: rmq },
    });
});

app.use('/', feedRoutes);

app.use(errorHandler);

async function start() {
    await connectRedis();
    await connectRabbitMQ();
    app.listen(PORT, () => console.log(`[feed-service] Listening on port ${PORT}`));
}

start().catch((err) => { console.error('[feed-service] Fatal:', err); process.exit(1); });

export default app;
