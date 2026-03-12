import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from '../../../shared/errors';
import { checkDbHealth } from './db';
import { checkMinioHealth } from './minio';
import { checkEsHealth } from './elasticsearch';
import gamesRoutes from './routes/games';
import searchRoutes from './routes/search';

const app = express();
const PORT = Number(process.env.PORT) || 3002;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.get('/health', async (_req, res) => {
    const [db, minio, es] = await Promise.all([checkDbHealth(), checkMinioHealth(), checkEsHealth()]);
    const healthy = db && minio && es;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'error',
        service: 'game-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: { db, minio, elasticsearch: es },
    });
});

app.use('/', gamesRoutes);    // GET /games, GET /games/:id
app.use('/search', searchRoutes); // GET /search

app.use(errorHandler);

app.listen(PORT, () => console.log(`[game-service] Listening on port ${PORT}`));

export default app;
