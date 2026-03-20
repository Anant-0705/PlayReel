import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from '../../../shared/errors';
import { checkDbHealth } from './db';
import { connectRedis, checkRedisHealth } from './redis';
import { connectRabbitMQ, checkRmqHealth } from './rabbitmq';
import { setupWebSocket } from './websocket';
import { setIo } from './io';
import likesRoutes from './routes/likes';
import commentsRoutes from './routes/comments';

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT) || 3004;

// Socket.io setup — stored in singleton so routes can access without circular import
const io = new Server(httpServer, {
    transports: ['websocket', 'polling'],
});
setIo(io); // make io available to routes via getIo()

app.set('trust proxy', 1);
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.get('/health', async (_req, res) => {
    const [db, redis, rmq] = await Promise.all([checkDbHealth(), checkRedisHealth(), checkRmqHealth()]);
    const healthy = db && redis && rmq;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'error',
        service: 'social-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: { db, redis, rabbitmq: rmq },
    });
});

app.use('/', likesRoutes);
app.use('/', commentsRoutes);

app.use(errorHandler);

async function start() {
    await connectRedis();
    await connectRabbitMQ();
    setupWebSocket(io);
    httpServer.listen(PORT, () => console.log(`[social-service] Listening on port ${PORT}`));
}

start().catch((err) => { console.error('[social-service] Fatal:', err); process.exit(1); });

export default app;
