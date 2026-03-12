import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload { userId: string; username: string; email: string; }

declare global {
    namespace Express {
        interface Request { user?: JwtPayload; }
    }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const token = req.headers.authorization?.slice(7);
    if (!token) return next(Object.assign(new Error('Unauthorized'), { statusCode: 401 }));
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        next();
    } catch {
        next(Object.assign(new Error('Invalid token'), { statusCode: 401 }));
    }
}
