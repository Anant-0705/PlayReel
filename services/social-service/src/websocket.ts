import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { incrementViewers, decrementViewers, WS_GAME_ROOM_PREFIX } from './redis';

interface AuthSocket extends Socket {
    userId?: string;
    username?: string;
    currentGameId?: string;
}

export function setupWebSocket(io: Server): void {
    // Middleware: extract JWT from auth handshake (optional)
    io.use((socket: AuthSocket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        if (token) {
            try {
                const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; username: string };
                socket.userId = payload.userId;
                socket.username = payload.username;
            } catch { /* anonymous viewer — that's fine */ }
        }
        next();
    });

    io.on('connection', (rawSocket: Socket) => {
        const socket = rawSocket as AuthSocket;
        console.log(`[ws] Client connected: ${socket.id} (user: ${socket.userId ?? 'anon'})`);

        // ── Join a game room ─────────────────────────────────────
        socket.on('join_game', async (gameId: string) => {
            if (!gameId || typeof gameId !== 'string') return;

            // Leave previous room first
            if (socket.currentGameId) {
                const prevRoom = `${WS_GAME_ROOM_PREFIX}${socket.currentGameId}`;
                socket.leave(prevRoom);
                const prevCount = await decrementViewers(socket.currentGameId);
                io.to(prevRoom).emit('viewer_count', { gameId: socket.currentGameId, viewerCount: prevCount });
            }

            socket.currentGameId = gameId;
            const room = `${WS_GAME_ROOM_PREFIX}${gameId}`;
            socket.join(room);
            const count = await incrementViewers(gameId);

            // Broadcast new viewer count to all in this game's room
            io.to(room).emit('viewer_count', { gameId, viewerCount: count });
        });

        // ── Leave game room ──────────────────────────────────────
        socket.on('leave_game', async (gameId: string) => {
            const room = `${WS_GAME_ROOM_PREFIX}${gameId}`;
            socket.leave(room);
            if (socket.currentGameId === gameId) socket.currentGameId = undefined;
            const count = await decrementViewers(gameId);
            io.to(room).emit('viewer_count', { gameId, viewerCount: count });
        });

        // ── Disconnect: clean up viewer count ────────────────────
        socket.on('disconnect', async () => {
            if (socket.currentGameId) {
                const room = `${WS_GAME_ROOM_PREFIX}${socket.currentGameId}`;
                const count = await decrementViewers(socket.currentGameId);
                io.to(room).emit('viewer_count', { gameId: socket.currentGameId, viewerCount: count });
            }
            console.log(`[ws] Client disconnected: ${socket.id}`);
        });
    });

    console.log('[ws] WebSocket server ready');
}

/**
 * Broadcast a live like update to all viewers of a game.
 * Called from the likes route after DB update.
 */
export function broadcastLike(io: Server, gameId: string, likeCount: number, likerId: string): void {
    io.to(`${WS_GAME_ROOM_PREFIX}${gameId}`).emit('like_update', { gameId, likeCount, likerId });
}

/**
 * Broadcast a new comment to all viewers of a game.
 */
export function broadcastComment(io: Server, gameId: string, comment: object): void {
    io.to(`${WS_GAME_ROOM_PREFIX}${gameId}`).emit('new_comment', { gameId, comment });
}
