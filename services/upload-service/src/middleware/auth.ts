import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../../../shared/errors';

export interface JwtPayload { userId: string; username: string; email: string; }

declare global {
    namespace Express {
        interface Request { user?: JwtPayload; }
    }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const token = req.headers.authorization?.slice(7);
    if (!token) return next(new UnauthorizedError('Unauthorized'));
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        next();
    } catch {
        next(new UnauthorizedError('Invalid token'));
    }
}
