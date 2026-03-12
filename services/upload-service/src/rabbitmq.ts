import amqplib, { ChannelModel, Channel } from 'amqplib';
import { EXCHANGES, ROUTING_KEYS } from '../../../shared/events';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || 'gamereel'}:${process.env.RABBITMQ_PASSWORD || 'changeme_rabbit_password'
    }@${process.env.RABBITMQ_HOST || 'rabbitmq'}:${process.env.RABBITMQ_PORT || 5672}${process.env.RABBITMQ_VHOST || '/'
    }`;

export async function connectRabbitMQ(retries = 10): Promise<void> {
    for (let i = 0; i < retries; i++) {
        try {
            connection = await amqplib.connect(RABBITMQ_URL);
            channel = await connection.createChannel();
            await channel.assertExchange(EXCHANGES.GAME_EVENTS, 'topic', { durable: true });
            connection.on('close', () => setTimeout(() => connectRabbitMQ(), 5000));
            console.log('[rabbitmq] upload-service connected');
            return;
        } catch {
            console.warn(`[rabbitmq] Attempt ${i + 1}/${retries} failed. Retrying in 5s...`);
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
    throw new Error('[rabbitmq] Max retries exceeded');
}

/** Publish game.submitted.zip or game.submitted.wasm routing key */
export async function publishGameSubmitted(payload: {
    gameId: string;
    sessionId: string;
    uploaderId: string;
    filename: string;
    minioKey: string;
    format: 'zip' | 'wasm';
    fileSizeBytes: number;
    metadata: { title: string; description: string; genre: string };
}): Promise<void> {
    if (!channel) throw new Error('[rabbitmq] Channel not initialized');
    const routingKey = payload.format === 'zip'
        ? ROUTING_KEYS.GAME_SUBMITTED_ZIP
        : ROUTING_KEYS.GAME_SUBMITTED_WASM;

    channel.publish(
        EXCHANGES.GAME_EVENTS,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true, contentType: 'application/json', timestamp: Date.now() },
    );
}

export async function checkRmqHealth(): Promise<boolean> {
    return connection !== null && channel !== null;
}
