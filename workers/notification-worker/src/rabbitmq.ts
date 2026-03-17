import amqplib, { ChannelModel, Channel, ConsumeMessage } from 'amqplib';
import { EXCHANGES, QUEUES } from '../../shared/events';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || 'gamereel'}:${
    process.env.RABBITMQ_PASSWORD || 'changeme_rabbit_password'
}@${process.env.RABBITMQ_HOST || 'rabbitmq'}:${process.env.RABBITMQ_PORT || 5672}${
    process.env.RABBITMQ_VHOST || '/'
}`;

export async function connectRabbitMQ(): Promise<void> {
    connection = await amqplib.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    channel.prefetch(10); // Notifications are fast — higher concurrency

    // Assert queues
    await channel.assertQueue(QUEUES.NOTIFICATIONS_PUSH, {
        durable: true,
        deadLetterExchange: EXCHANGES.DEAD_LETTER,
    });
    await channel.assertQueue(QUEUES.FOLLOWS, {
        durable: true,
        deadLetterExchange: EXCHANGES.DEAD_LETTER,
    });

    connection.on('close', () => {
        console.error('[rabbitmq] Connection closed — exiting for Docker restart');
        process.exit(1);
    });
    console.log('[rabbitmq] notification-worker connected');
}

export async function consume(
    queue: string,
    handler: (msg: ConsumeMessage) => Promise<void>,
): Promise<void> {
    if (!channel) throw new Error('[rabbitmq] Not connected');
    await channel.consume(queue, async (msg) => {
        if (!msg) return;
        try {
            await handler(msg);
            channel!.ack(msg);
        } catch (err) {
            console.error(`[rabbitmq] Handler failed for queue ${queue}:`, err);
            channel!.nack(msg, false, false); // → dead letter, no requeue
        }
    });
    console.log(`[rabbitmq] Consuming queue: ${queue}`);
}

export async function closeRabbitMQ(): Promise<void> {
    try {
        await channel?.close();
        await connection?.close();
    } catch { /* ignore */ }
}
