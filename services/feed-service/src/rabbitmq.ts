import amqplib, { ChannelModel, Channel } from 'amqplib';
import { QUEUES } from '../../../shared/events';
import { invalidateFeed } from './redis';

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
            channel.prefetch(5);

            await channel.assertQueue(QUEUES.FEED_INVALIDATION, {
                durable: true,
                deadLetterExchange: 'dead.letter',
                messageTtl: 300_000,
            });

            await channel.consume(QUEUES.FEED_INVALIDATION, async (msg) => {
                if (!msg) return;
                try {
                    const data = JSON.parse(msg.content.toString()) as { userId: string };
                    await invalidateFeed(data.userId);
                    channel!.ack(msg);
                } catch (err) {
                    console.error('[feed-service] Failed to process invalidation:', err);
                    channel!.nack(msg, false, false);
                }
            });

            connection.on('close', () => setTimeout(() => connectRabbitMQ(), 5000));
            console.log('[rabbitmq] feed-service connected and consuming feed.invalidation');
            return;
        } catch {
            console.warn(`[rabbitmq] Attempt ${i + 1}/${retries} failed. Retrying in 5s...`);
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
    throw new Error('[rabbitmq] Could not connect after max retries');
}

export async function checkRmqHealth(): Promise<boolean> {
    return connection !== null && channel !== null;
}
