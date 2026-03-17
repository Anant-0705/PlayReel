import amqplib, { ChannelModel, Channel, ConsumeMessage } from 'amqplib';
import { EXCHANGES, QUEUES, ROUTING_KEYS } from '../../shared/events';

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
    channel.prefetch(1); // Process ONE game at a time per instance

    // Assert exchange + queue + binding
    await channel.assertExchange(EXCHANGES.GAME_EVENTS, 'topic', { durable: true });
    await channel.assertQueue(QUEUES.GAME_PROCESSING, {
        durable: true,
        deadLetterExchange: EXCHANGES.DEAD_LETTER,
        messageTtl: 30 * 60 * 1000, // 30 min max processing time
    });
    await channel.bindQueue(
        QUEUES.GAME_PROCESSING,
        EXCHANGES.GAME_EVENTS,
        ROUTING_KEYS.GAME_UPLOADED_WILDCARD,
    );

    connection.on('close', () => {
        console.error('[rabbitmq] Connection closed — exiting for Docker restart');
        process.exit(1);
    });
    connection.on('error', (err) => {
        console.error('[rabbitmq] Connection error:', err.message);
        process.exit(1);
    });
    console.log('[rabbitmq] game-processor connected');
}

export async function consume(
    handler: (msg: ConsumeMessage) => Promise<void>,
): Promise<void> {
    if (!channel) throw new Error('[rabbitmq] Channel not initialized');
    await channel.consume(QUEUES.GAME_PROCESSING, async (msg) => {
        if (!msg) return;
        try {
            await handler(msg);
            channel!.ack(msg);
            console.log('[rabbitmq] ACK', msg.properties.messageId);
        } catch (err) {
            console.error('[rabbitmq] Processing failed — sending to dead letter:', err);
            channel!.nack(msg, false, false); // → dead.letter.queue, no requeue
        }
    });
    console.log('[rabbitmq] Consuming queue:', QUEUES.GAME_PROCESSING);
}

export async function publish(
    exchange: string,
    routingKey: string,
    message: object,
): Promise<void> {
    if (!channel) throw new Error('[rabbitmq] Channel not initialized');
    channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, contentType: 'application/json', timestamp: Date.now() },
    );
}

export async function closeRabbitMQ(): Promise<void> {
    try {
        await channel?.close();
        await connection?.close();
    } catch { /* ignore during shutdown */ }
}
