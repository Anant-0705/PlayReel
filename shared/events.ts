// ============================================================
// GameReel — RabbitMQ Event Routing Keys & Exchange Names
// ============================================================

// ── Exchange Names ────────────────────────────────────────────

export const EXCHANGES = {
    GAME_EVENTS: 'game.events',       // topic exchange — wildcard routing
    SOCIAL_EVENTS: 'social.events',  // fanout exchange — all queues
    USER_EVENTS: 'user.events',      // direct exchange — point-to-point
    DEAD_LETTER: 'dead.letter',      // direct exchange — failed messages
} as const;

// ── Queue Names ───────────────────────────────────────────────

export const QUEUES = {
    GAME_PROCESSING: 'game.processing',
    NOTIFICATIONS_PUSH: 'notifications.push',
    FEED_INVALIDATION: 'feed.invalidation',
    FOLLOWS: 'follows',
    MODERATION: 'moderation',
    DEAD_LETTER: 'dead.letter.queue',
} as const;

// ── Routing Keys ──────────────────────────────────────────────

export const ROUTING_KEYS = {
    // Upload service → game-processor (topic)
    GAME_SUBMITTED_ZIP: 'game.submitted.zip',
    GAME_SUBMITTED_WASM: 'game.submitted.wasm',

    // game-processor → feed-service (topic)
    GAME_APPROVED: 'game.approved',

    // game-processor → notification-worker (direct)
    GAME_PUBLISHED: 'game.published',

    // game-processor → moderation (topic)
    GAME_FLAGGED: 'game.flagged',

    // game-processor → notification-worker (direct)
    GAME_REJECTED: 'game.rejected',

    // social-service → fanout (no key needed, all queues receive)
    SOCIAL_LIKED: 'social.liked',
    SOCIAL_COMMENTED: 'social.commented',

    // user-service → notification-worker (direct)
    USER_FOLLOWED: 'user.followed',

    // social-service → feed-service (topic)
    FEED_INVALIDATION: 'feed.invalidation',

    // Wildcard: catches game.submitted.zip + game.submitted.wasm
    GAME_UPLOADED_WILDCARD: 'game.submitted.#',
} as const;

// ── Message Interfaces ────────────────────────────────────────

export interface GameSubmittedMessage {
    gameId: string;
    sessionId: string;
    uploaderId: string;
    filename: string;
    minioKey: string; // e.g. uploads/ready/{gameId}.zip
    format: 'zip' | 'wasm';
    fileSizeBytes: number;
    metadata: {
        title: string;
        description: string;
        genre: string;
    };
}

export interface GameApprovedMessage {
    gameId: string;
    uploaderId: string;
    title: string;
    genre: string;
    manifestUrl: string;
}

export interface GamePublishedMessage {
    gameId: string;
    uploaderId: string;
    title: string;
}

export interface GameFlaggedMessage {
    gameId: string;
    uploaderId: string;
    reason: string;
    flags: string[];
}

export interface GameRejectedMessage {
    gameId: string;
    uploaderId: string;
    reason: string;
}

export interface SocialLikedMessage {
    gameId: string;
    likerId: string;
    gameOwnerId: string;
    likerUsername: string;
    gameTitle: string;
}

export interface SocialCommentedMessage {
    gameId: string;
    commentId: string;
    commenterId: string;
    gameOwnerId: string;
    commenterUsername: string;
    gameTitle: string;
    contentPreview: string; // first 80 chars
}

export interface UserFollowedMessage {
    followerId: string;
    followingId: string;
    followerUsername: string;
}

export interface FeedInvalidationMessage {
    userId: string;      // whose feed to invalidate
    reason: 'like' | 'comment' | 'follow' | 'new_game';
}
