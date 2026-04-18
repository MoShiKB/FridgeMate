export default async function globalTeardown() {
    const mongoServer = (globalThis as any).__MONGO_SERVER__;
    if (mongoServer) {
        await mongoServer.stop();
    }
}
