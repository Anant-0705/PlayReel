import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../../shared/errors';

export interface JwtPayload {
    userId: string;
    username: string;
    email: string;
    iat: number;
    exp: number;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next(new UnauthorizedError('Missing or invalid Authorization header'));
    }

    const token = authHeader.slice(7);
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET not configured');
        const payload = jwt.verify(token, secret) as JwtPayload;
        req.user = payload;
        next();
    } catch (err) {
        next(new UnauthorizedError('Invalid or expired token'));
    }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next(); // Allow unauthenticated — req.user will be undefined
    }
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET not configured');
        req.user = jwt.verify(authHeader.slice(7), secret) as JwtPayload;
    } catch {
        // Invalid token — proceed without user (don't throw)
    }
    next();
}
