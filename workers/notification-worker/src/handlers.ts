import { ConsumeMessage } from 'amqplib';
import { getDeviceTokens } from './db';
import { sendPush } from './firebase';
import {
    SocialLikedMessage,
    SocialCommentedMessage,
    UserFollowedMessage,
    GamePublishedMessage,
    GameRejectedMessage,
} from '../../shared/events';

// ── Handler: social.liked ─────────────────────────────────────────────────

export async function handleLiked(msg: ConsumeMessage): Promise<void> {
    const { gameOwnerId, likerUsername, gameTitle } =
        JSON.parse(msg.content.toString()) as SocialLikedMessage;

    const tokens = await getDeviceTokens(gameOwnerId);
    if (tokens.length === 0) return;

    await sendPush(tokens, {
        title: '❤️ New Like',
        body: `${likerUsername} liked your game "${gameTitle}"`,
        data: { type: 'like', gameTitle },
    });
}

// ── Handler: social.commented ─────────────────────────────────────────────

export async function handleCommented(msg: ConsumeMessage): Promise<void> {
    const { gameOwnerId, commenterUsername, gameTitle, contentPreview } =
        JSON.parse(msg.content.toString()) as SocialCommentedMessage;

    const tokens = await getDeviceTokens(gameOwnerId);
    if (tokens.length === 0) return;

    await sendPush(tokens, {
        title: '💬 New Comment',
        body: `${commenterUsername} commented: "${contentPreview}"`,
        data: { type: 'comment', gameTitle },
    });
}

// ── Handler: user.followed ────────────────────────────────────────────────

export async function handleFollowed(msg: ConsumeMessage): Promise<void> {
    const { followingId, followerUsername } =
        JSON.parse(msg.content.toString()) as UserFollowedMessage;

    const tokens = await getDeviceTokens(followingId);
    if (tokens.length === 0) return;

    await sendPush(tokens, {
        title: '👤 New Follower',
        body: `${followerUsername} is now following you`,
        data: { type: 'follow', followerUsername },
    });
}

// ── Handler: game.published ───────────────────────────────────────────────

export async function handleGamePublished(msg: ConsumeMessage): Promise<void> {
    const { uploaderId, title } =
        JSON.parse(msg.content.toString()) as GamePublishedMessage;

    const tokens = await getDeviceTokens(uploaderId);
    if (tokens.length === 0) return;

    await sendPush(tokens, {
        title: '🎮 Your Game is Live!',
        body: `"${title}" has been published successfully`,
        data: { type: 'game_published', title },
    });
}

// ── Handler: game.rejected ────────────────────────────────────────────────

export async function handleGameRejected(msg: ConsumeMessage): Promise<void> {
    const { uploaderId, title, reason } =
        JSON.parse(msg.content.toString()) as GameRejectedMessage;

    const tokens = await getDeviceTokens(uploaderId);
    if (tokens.length === 0) return;

    await sendPush(tokens, {
        title: '⚠️ Game Rejected',
        body: `"${title}" was rejected: ${reason}`,
        data: { type: 'game_rejected', title, reason },
    });
}

// ── Routing: route event type → correct handler ───────────────────────────

const EVENT_HANDLERS: Record<string, (msg: ConsumeMessage) => Promise<void>> = {
    'social.liked': handleLiked,
    'social.commented': handleCommented,
    'user.followed': handleFollowed,
    'game.published': handleGamePublished,
    'game.rejected': handleGameRejected,
};

export async function routeMessage(msg: ConsumeMessage): Promise<void> {
    const routingKey = msg.fields.routingKey;
    const handler = EVENT_HANDLERS[routingKey];

    if (!handler) {
        // Unknown event type — ACK to prevent dead-letter loop
        console.log(`[handlers] Unknown routing key: ${routingKey} — skipping`);
        return;
    }

    await handler(msg);
}
