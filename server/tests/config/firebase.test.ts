const mockInitializeApp = jest.fn();
const mockCert = jest.fn();

jest.mock("firebase-admin", () => ({
    __esModule: true,
    initializeApp: (...args: any[]) => mockInitializeApp(...args),
    credential: {
        cert: (...args: any[]) => mockCert(...args),
    },
}));

describe("config/firebase — initFirebase / getFirebaseApp", () => {
    const originalPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockInitializeApp.mockImplementation((cfg: any) => ({ __app: true, cfg }));
        mockCert.mockImplementation((sa: any) => ({ __cert: sa }));
    });

    afterAll(() => {
        if (originalPath === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        else process.env.FIREBASE_SERVICE_ACCOUNT_PATH = originalPath;
    });

    it("returns undefined and warns when FIREBASE_SERVICE_ACCOUNT_PATH is not set", () => {
        delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });

        const { initFirebase, getFirebaseApp } = require("../../config/firebase");
        const result = initFirebase();
        expect(result).toBeUndefined();
        expect(getFirebaseApp()).toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it("initializes the SDK when a valid service account path is provided", () => {
        // Point to any real JSON file we can require — package.json works.
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "package.json";

        const { initFirebase, getFirebaseApp } = require("../../config/firebase");
        const app = initFirebase();

        expect(app).toEqual({ __app: true, cfg: { credential: { __cert: expect.anything() } } });
        expect(getFirebaseApp()).toBe(app);
    });

    it("returns the cached app on subsequent calls", () => {
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "package.json";
        const { initFirebase } = require("../../config/firebase");
        const a = initFirebase();
        const b = initFirebase();
        expect(a).toBe(b);
        expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    });

    it("returns undefined and logs when the service account cannot be loaded", () => {
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "this-file-definitely-does-not-exist.json";
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => { });

        const { initFirebase } = require("../../config/firebase");
        const result = initFirebase();
        expect(result).toBeUndefined();
        expect(errSpy).toHaveBeenCalled();

        errSpy.mockRestore();
    });
});
