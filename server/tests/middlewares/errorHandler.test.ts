import { Request, Response } from 'express';
import errorHandler from '../../middlewares/errorHandler';

function mockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

const req = {} as Request;
const next = jest.fn();

describe('errorHandler middleware', () => {
    it('should handle ValidationError with field messages', () => {
        const err: any = new Error('Validation failed');
        err.name = 'ValidationError';
        err.errors = {
            email: { message: 'Email is required' },
            name: { message: 'Name is required' },
        };

        const res = mockRes();
        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Validation Error',
            errors: ['Email is required', 'Name is required'],
        });
    });

    it('should handle duplicate key error (code 11000)', () => {
        const err: any = new Error('E11000');
        err.code = 11000;

        const res = mockRes();
        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Duplicate key error: A record with this key already exists.',
        });
    });

    it('should use err.status when set', () => {
        const err: any = new Error('Not Found');
        err.status = 404;

        const res = mockRes();
        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Not Found' });
    });

    it('should default to 500 when no status', () => {
        const err: any = new Error('Something broke');

        const res = mockRes();
        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: 'Something broke' });
    });

    it('should mask 500 error message in production', () => {
        const original = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const err: any = new Error('secret internal detail');

        const res = mockRes();
        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: 'An internal server error occurred.',
        });

        process.env.NODE_ENV = original;
    });

    it('should not mask non-500 errors in production', () => {
        const original = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const err: any = new Error('Bad Request');
        err.status = 400;

        const res = mockRes();
        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Bad Request' });

        process.env.NODE_ENV = original;
    });
});
