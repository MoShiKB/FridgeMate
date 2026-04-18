import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
    const mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_TEST_URI = mongoServer.getUri();
    (globalThis as any).__MONGO_SERVER__ = mongoServer;
}
