import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { publish, EXCHANGES } from '../rabbitmq';
import { ROUTING_KEYS } from '../../../../shared/events';
import { asyncHandler, ConflictError, UnauthorizedError, ValidationError } from '../../../../shared/errors';

const router = Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Too many auth requests' },
});

// ── Schemas ───────────────────────────────────────────────────
const RegisterSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username: letters, numbers, underscores only'),
    email: z.string().email(),
    password: z.string().min(8).max(100),
});

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

// ── Helpers ───────────────────────────────────────────────────
function signTokens(userId: string, username: string, email: string) {
    const secret = process.env.JWT_SECRET!;
    const refreshSecret = process.env.JWT_REFRESH_SECRET!;
    const accessToken = jwt.sign({ userId, username, email }, secret, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
    });
    const refreshToken = jwt.sign({ userId }, refreshSecret, {
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as jwt.SignOptions['expiresIn'],
    });
    return { accessToken, refreshToken };
}

// ── POST /register ────────────────────────────────────────────
router.post('/register', authLimiter, asyncHandler(async (req: Request, res: Response) => {
    const result = RegisterSchema.safeParse(req.body);
    if (!result.success) {
        throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string>);
    }
    const { username, email, password } = result.data;

    // Check duplicates
    const existing = await queryOne(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email, username],
    );
    if (existing) throw new ConflictError('Email or username already taken');

    const hash = await bcrypt.hash(password, 12);
    const [user] = await query<{ id: string; username: string; email: string }>(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
        [username, email, hash],
    );

    const { accessToken, refreshToken } = signTokens(user.id, user.username, user.email);
    res.status(201).json({ success: true, data: { accessToken, refreshToken, user } });
}));

// ── POST /login ───────────────────────────────────────────────
router.post('/login', authLimiter, asyncHandler(async (req: Request, res: Response) => {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError('Invalid credentials format');
    const { email, password } = result.data;

    const user = await queryOne<{ id: string; username: string; email: string; password_hash: string }>(
        'SELECT id, username, email, password_hash FROM users WHERE email = $1',
        [email],
    );
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new UnauthorizedError('Invalid email or password');

    const { accessToken, refreshToken } = signTokens(user.id, user.username, user.email);
    const { password_hash: _, ...safeUser } = user;
    res.json({ success: true, data: { accessToken, refreshToken, user: safeUser } });
}));

// ── POST /refresh ─────────────────────────────────────────────
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) throw new UnauthorizedError('Refresh token required');

    const refreshSecret = process.env.JWT_REFRESH_SECRET!;
    let payload: { userId: string };
    try {
        payload = jwt.verify(refreshToken, refreshSecret) as { userId: string };
    } catch {
        throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await queryOne<{ id: string; username: string; email: string }>(
        'SELECT id, username, email FROM users WHERE id = $1',
        [payload.userId],
    );
    if (!user) throw new UnauthorizedError('User not found');

    const tokens = signTokens(user.id, user.username, user.email);
    res.json({ success: true, data: tokens });
}));

// ── POST /logout ──────────────────────────────────────────────
// Stateless JWT — client deletes tokens. Return 200 to confirm.
router.post('/logout', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
