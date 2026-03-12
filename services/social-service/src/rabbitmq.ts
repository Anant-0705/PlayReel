import amqplib, { ChannelModel, Channel } from 'amqplib';
import { EXCHANGES } from '../../../shared/events';

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
            await channel.assertExchange(EXCHANGES.SOCIAL_EVENTS, 'fanout', { durable: true });
            connection.on('close', () => setTimeout(() => connectRabbitMQ(), 5000));
            console.log('[rabbitmq] social-service connected');
            return;
        } catch {
            console.warn(`[rabbitmq] Attempt ${i + 1}/${retries} failed. Retrying in 5s...`);
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
    throw new Error('[rabbitmq] Max retries exceeded');
}

export function getChannel(): Channel {
    if (!channel) throw new Error('[rabbitmq] Channel not initialized');
    return channel;
}

export async function publish(exchange: string, routingKey: string, message: object): Promise<void> {
    const ch = getChannel();
    ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
    });
}

export async function checkRmqHealth(): Promise<boolean> {
    return connection !== null && channel !== null;
}

export { EXCHANGES };
