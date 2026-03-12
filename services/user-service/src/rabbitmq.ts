import amqplib, { ChannelModel, Channel } from 'amqplib';
import { EXCHANGES, QUEUES } from '../../../shared/events';

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

            // Exchanges are pre-declared in definitions.json, but assert defensively
            await channel.assertExchange(EXCHANGES.GAME_EVENTS, 'topic', { durable: true });
            await channel.assertExchange(EXCHANGES.SOCIAL_EVENTS, 'fanout', { durable: true });
            await channel.assertExchange(EXCHANGES.USER_EVENTS, 'direct', { durable: true });

            channel.prefetch(1); // Fair dispatch for workers

            connection.on('error', (err) => {
                console.error('[rabbitmq] Connection error:', err.message);
                reconnectRabbitMQ();
            });
            connection.on('close', () => {
                console.warn('[rabbitmq] Connection closed — reconnecting...');
                reconnectRabbitMQ();
            });

            console.log('[rabbitmq] Connected');
            return;
        } catch (err) {
            console.warn(`[rabbitmq] Connection attempt ${i + 1}/${retries} failed. Retrying in 5s...`);
            await new Promise((r) => setTimeout(r, 5_000));
        }
    }
    throw new Error('[rabbitmq] Could not connect after maximum retries');
}

async function reconnectRabbitMQ(): Promise<void> {
    connection = null;
    channel = null;
    setTimeout(() => connectRabbitMQ(), 5_000);
}

export function getChannel(): Channel {
    if (!channel) throw new Error('[rabbitmq] Channel not initialized. Call connectRabbitMQ() first.');
    return channel;
}

export async function publish(
    exchange: string,
    routingKey: string,
    message: object,
): Promise<void> {
    const ch = getChannel();
    const payload = Buffer.from(JSON.stringify(message));
    ch.publish(exchange, routingKey, payload, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
    });
}

export async function checkRmqHealth(): Promise<boolean> {
    return connection !== null && channel !== null;
}

export { QUEUES, EXCHANGES };
