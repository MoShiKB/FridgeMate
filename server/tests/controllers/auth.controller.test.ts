import { Request, Response } from 'express';
import { AuthController } from '../../controllers/auth.controller';
import { AuthService } from '../../services/auth.service';

jest.mock('../../services/auth.service');

const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res as Response;
};

describe('AuthController.handleGoogleCallback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CLIENT_URL = 'http://localhost:3000';
    });

    it('should redirect with tokens on successful Google login', async () => {
        (AuthService.loginWithGoogle as jest.Mock).mockResolvedValueOnce({
            status: 200,
            data: { message: 'Login successful', accessToken: 'at123', refreshToken: 'rt456' },
        });

        const req = {
            user: { email: 'google@example.com', userName: 'googleuser', profileImage: 'http://img.com/pic.jpg' },
        } as any;
        const res = mockRes();

        await AuthController.handleGoogleCallback(req, res);

        expect(AuthService.loginWithGoogle).toHaveBeenCalledWith(
            'google@example.com', 'googleuser', 'http://img.com/pic.jpg'
        );
        expect(res.redirect).toHaveBeenCalledWith(
            expect.stringContaining('http://localhost:3000/auth/google/callback?')
        );
        expect(res.redirect).toHaveBeenCalledWith(
            expect.stringContaining('accessToken=at123')
        );
        expect(res.redirect).toHaveBeenCalledWith(
            expect.stringContaining('refreshToken=rt456')
        );
    });

    it('should throw when Google user has no email', async () => {
        const req = { user: { userName: 'noemail' } } as any;
        const res = mockRes();

        await expect(
            AuthController.handleGoogleCallback(req, res)
        ).rejects.toThrow('Google login failed: missing email');
    });

    it('should throw when req.user is null', async () => {
        const req = { user: null } as any;
        const res = mockRes();

        await expect(
            AuthController.handleGoogleCallback(req, res)
        ).rejects.toThrow('Google login failed: missing email');
    });
});
