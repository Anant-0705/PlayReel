import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from '../../../shared/errors';
import { checkDbHealth } from './db';
import { checkMinioHealth } from './minio';
import { connectRabbitMQ, checkRmqHealth } from './rabbitmq';
import uploadRoutes from './routes/upload';

const app = express();
const PORT = Number(process.env.PORT) || 3005;

app.set('trust proxy', 1);
app.use(helmet());
app.use(morgan('combined'));
// Note: chunk upload uses raw binary — body parsing is handle per-route
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }));

app.get('/health', async (_req, res) => {
    const [db, minio, rmq] = await Promise.all([checkDbHealth(), checkMinioHealth(), checkRmqHealth()]);
    const healthy = db && minio && rmq;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'error',
        service: 'upload-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: { db, minio, rabbitmq: rmq },
    });
});

app.use('/', uploadRoutes);

app.use(errorHandler);

async function start() {
    await connectRabbitMQ();
    app.listen(PORT, () => console.log(`[upload-service] Listening on port ${PORT}`));
}

start().catch((err) => { console.error('[upload-service] Fatal:', err); process.exit(1); });

export default app;
