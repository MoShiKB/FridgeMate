import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../../config/database";

describe("config/database — connectDB / disconnectDB", () => {
    const originalUri = process.env.MONGO_URI;

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(() => {
        if (originalUri === undefined) delete process.env.MONGO_URI;
        else process.env.MONGO_URI = originalUri;
    });

    it("throws when MONGO_URI is missing", async () => {
        delete process.env.MONGO_URI;
        await expect(connectDB()).rejects.toThrow(/MONGO_URI is not defined/);
    });

    it("logs the success path, wires event listeners, and does not throw", async () => {
        process.env.MONGO_URI = process.env.MONGO_TEST_URI!;
        // Mock mongoose.connect so we don't touch the shared test connection.
        const connectSpy = jest
            .spyOn(mongoose, "connect")
            .mockResolvedValueOnce(mongoose);
        // Silence expected logs.
        const logSpy = jest.spyOn(console, "log").mockImplementation(() => { });
        // Also spy on the connection.on registrations to prove wire-up.
        const onSpy = jest.spyOn(mongoose.connection, "on");

        await expect(connectDB()).resolves.toBeUndefined();
        expect(connectSpy).toHaveBeenCalledWith(
            process.env.MONGO_TEST_URI,
            expect.objectContaining({ serverSelectionTimeoutMS: 5000 })
        );
        expect(onSpy).toHaveBeenCalledWith("error", expect.any(Function));
        expect(onSpy).toHaveBeenCalledWith("disconnected", expect.any(Function));
        expect(onSpy).toHaveBeenCalledWith("reconnected", expect.any(Function));

        // Exercise the listener bodies so their bodies get covered too.
        const listeners = onSpy.mock.calls;
        const errorCb = listeners.find(([evt]) => evt === "error")?.[1] as any;
        const discCb = listeners.find(([evt]) => evt === "disconnected")?.[1] as any;
        const reCb = listeners.find(([evt]) => evt === "reconnected")?.[1] as any;
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => { });
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
        errorCb(new Error("simulated"));
        discCb();
        reCb();
        expect(errSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();

        logSpy.mockRestore();
        errSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it("re-throws when mongoose.connect rejects", async () => {
        process.env.MONGO_URI = "mongodb://bad-host:1/nope";
        const connectSpy = jest
            .spyOn(mongoose, "connect")
            .mockRejectedValueOnce(new Error("connect failed"));
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => { });
        const logSpy = jest.spyOn(console, "log").mockImplementation(() => { });

        await expect(connectDB()).rejects.toThrow("connect failed");
        expect(connectSpy).toHaveBeenCalled();
        expect(errSpy).toHaveBeenCalled();

        errSpy.mockRestore();
        logSpy.mockRestore();
    });

    it("calls connection.close on disconnectDB (mocked to preserve the test connection)", async () => {
        const closeSpy = jest
            .spyOn(mongoose.connection, "close")
            .mockResolvedValueOnce(undefined as any);
        const logSpy = jest.spyOn(console, "log").mockImplementation(() => { });

        await expect(disconnectDB()).resolves.toBeUndefined();
        expect(closeSpy).toHaveBeenCalledTimes(1);

        logSpy.mockRestore();
    });

    it("re-throws when connection.close fails", async () => {
        const closeSpy = jest
            .spyOn(mongoose.connection, "close")
            .mockRejectedValueOnce(new Error("close failed"));
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => { });

        await expect(disconnectDB()).rejects.toThrow("close failed");
        expect(closeSpy).toHaveBeenCalled();

        errSpy.mockRestore();
    });
});
