// ============================================================
// GameReel — Shared Error Classes
// ============================================================

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

// ── HTTP Errors ───────────────────────────────────────────────

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}

export class ValidationError extends AppError {
    public readonly fields?: Record<string, string>;

    constructor(message: string, fields?: Record<string, string>) {
        super(message, 422);
        this.fields = fields;
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409);
    }
}

export class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429);
    }
}

export class PayloadTooLargeError extends AppError {
    constructor(maxSize: string) {
        super(`File exceeds maximum allowed size of ${maxSize}`, 413);
    }
}

export class ServiceUnavailableError extends AppError {
    constructor(service: string) {
        super(`${service} is temporarily unavailable`, 503);
    }
}

// ── Error Handler (Express middleware) ────────────────────────

import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            ...(err instanceof ValidationError && err.fields
                ? { fields: err.fields }
                : {}),
        });
        return;
    }

    // Unknown / programming errors — don't leak details
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
}

// ── Async wrapper to avoid try/catch boilerplate ──────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
