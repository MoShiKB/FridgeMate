import { Request, Response, NextFunction } from 'express';

interface CustomError extends Error {
    status?: number;
    code?: number;
    errors?: Record<string, { message: string }>;
}

const errorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction): Response => {
    console.error(err);

    if (err.name === 'ValidationError' && err.errors) {
        const messages = Object.values(err.errors).map((val) => val.message);
        return res.status(400).json({ message: 'Validation Error', errors: messages });
    }

    if (err.code === 11000) {
        return res.status(400).json({ message: 'Duplicate key error: A record with this key already exists.' });
    }

    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' && status === 500
        ? 'An internal server error occurred.'
        : err.message;

    return res.status(status).json({ message });
};

export default errorHandler;

