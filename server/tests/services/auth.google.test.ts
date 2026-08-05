const mockVerifyIdToken = jest.fn();

jest.mock("google-auth-library", () => ({
    OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: mockVerifyIdToken,
    })),
}));

import { AuthService } from "../../services/auth.service";
import UserModel from "../../models/user.model";

describe("AuthService.loginWithGoogleIdToken", () => {
    const originalAudience = process.env.OAUTH_CLIENT_ID;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    });

    afterAll(() => {
        if (originalAudience === undefined) delete process.env.OAUTH_CLIENT_ID;
        else process.env.OAUTH_CLIENT_ID = originalAudience;
    });

    it("throws 500 when OAUTH_CLIENT_ID is not configured", async () => {
        delete process.env.OAUTH_CLIENT_ID;
        await expect(AuthService.loginWithGoogleIdToken("fake"))
            .rejects.toMatchObject({ status: 500 });
    });

    it("throws 401 when the ID token is invalid (verifyIdToken throws)", async () => {
        mockVerifyIdToken.mockRejectedValueOnce(new Error("bad token"));
        await expect(AuthService.loginWithGoogleIdToken("bad-token"))
            .rejects.toMatchObject({ status: 401 });
    });

    it("throws 401 when the token payload lacks an email", async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
            getPayload: () => ({ email_verified: true }),
        });
        await expect(AuthService.loginWithGoogleIdToken("t"))
            .rejects.toMatchObject({ status: 401 });
    });

    it("throws 401 when the Google account email is not verified", async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
            getPayload: () => ({
                email: "u@example.com",
                email_verified: false,
                name: "U",
            }),
        });
        await expect(AuthService.loginWithGoogleIdToken("t"))
            .rejects.toMatchObject({ status: 401 });
    });

    it("logs in and returns tokens for a valid, verified Google account", async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
            getPayload: () => ({
                email: `google-user-${Date.now()}@example.com`,
                email_verified: true,
                name: "Google User",
                picture: "https://example.com/avatar.png",
            }),
        });

        const result = await AuthService.loginWithGoogleIdToken("t");
        expect(result.status).toBe(200);
        expect(result.data.accessToken).toBeDefined();
        expect(result.data.refreshToken).toBeDefined();

        const user = await UserModel.findOne({ email: /google-user-/i });
        expect(user).not.toBeNull();
        expect(user!.profileImage).toBe("https://example.com/avatar.png");
    });
});
