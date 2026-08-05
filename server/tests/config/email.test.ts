const mockSend = jest.fn();

jest.mock("resend", () => ({
    Resend: jest.fn().mockImplementation(() => ({
        emails: { send: mockSend },
    })),
}));

describe("config/email — sendResetCodeEmail", () => {
    const originalKey = process.env.RESEND_API_KEY;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    afterAll(() => {
        if (originalKey === undefined) delete process.env.RESEND_API_KEY;
        else process.env.RESEND_API_KEY = originalKey;
    });

    it("throws a helpful error when RESEND_API_KEY is not set", async () => {
        delete process.env.RESEND_API_KEY;
        const { sendResetCodeEmail } = require("../../config/email");
        await expect(sendResetCodeEmail("to@example.com", "123456"))
            .rejects.toThrow(/RESEND_API_KEY is not set/);
    });

    it("sends the email via Resend when the API key is configured", async () => {
        process.env.RESEND_API_KEY = "re_test_key";
        mockSend.mockResolvedValueOnce({ data: { id: "e1" }, error: null });

        const { sendResetCodeEmail } = require("../../config/email");
        await sendResetCodeEmail("to@example.com", "987654");

        expect(mockSend).toHaveBeenCalledTimes(1);
        const arg = mockSend.mock.calls[0][0];
        expect(arg.to).toBe("to@example.com");
        expect(arg.subject).toMatch(/FridgeMate/i);
        expect(arg.html).toContain("987654");
    });

    it("reuses the same Resend client on repeat calls", async () => {
        process.env.RESEND_API_KEY = "re_test_key";
        mockSend.mockResolvedValue({ data: { id: "e1" }, error: null });

        const { sendResetCodeEmail } = require("../../config/email");
        await sendResetCodeEmail("a@x.com", "111111");
        await sendResetCodeEmail("b@x.com", "222222");

        expect(mockSend).toHaveBeenCalledTimes(2);
        const { Resend } = require("resend");
        expect(Resend).toHaveBeenCalledTimes(1);
    });

    it("throws when Resend returns an error object", async () => {
        process.env.RESEND_API_KEY = "re_test_key";
        mockSend.mockResolvedValueOnce({ data: null, error: { message: "quota exceeded" } });

        const { sendResetCodeEmail } = require("../../config/email");
        await expect(sendResetCodeEmail("to@example.com", "000000"))
            .rejects.toThrow(/quota exceeded/);
    });
});
