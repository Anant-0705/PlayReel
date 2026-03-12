/**
 * io.ts — Socket.io singleton
 *
 * Exists solely to break the circular dependency between:
 *   index.ts (creates io) ← routes/likes.ts (needs io) ← index.ts
 *
 * index.ts calls setIo(io) after creating the server.
 * Routes call getIo() — always returns the live instance.
 */
import { Server } from 'socket.io';

let _io: Server | null = null;

export function setIo(ioInstance: Server): void {
    _io = ioInstance;
}

export function getIo(): Server {
    if (!_io) throw new Error('[social-service] Socket.io not initialized yet');
    return _io;
}
