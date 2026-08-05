import { Server } from 'socket.io';
import { createServer, Server as HttpServer } from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import ChatModel from '../../models/chat.model';
import { setupSocketHandlers } from '../../socket/socket-handlers';
import { FridgeModel } from '../../models/fridge.model';
import FridgeChatModel from '../../models/fridge-chat.model';

let httpServer: HttpServer;
let ioServer: Server;
let port: number;

const user1Id = new mongoose.Types.ObjectId().toString();
const user2Id = new mongoose.Types.ObjectId().toString();

function makeToken(userId: string) {
    return jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
}

function connectClient(token: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
        const client = ClientIO(`http://localhost:${port}`, {
            auth: { token },
            transports: ['websocket'],
        });
        client.on('connect', () => resolve(client));
        client.on('connect_error', reject);
    });
}

beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);
    setupSocketHandlers(ioServer);
    httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        done();
    });
});

afterAll((done) => {
    ioServer.close();
    httpServer.close(done);
});

describe('Socket Handlers', () => {
    describe('Authentication middleware', () => {
        it('should reject connection without token', (done) => {
            const client = ClientIO(`http://localhost:${port}`, {
                auth: {},
                transports: ['websocket'],
            });
            client.on('connect_error', (err) => {
                expect(err.message).toContain('Authentication required');
                client.disconnect();
                done();
            });
        });

        it('should reject connection with invalid token', (done) => {
            const client = ClientIO(`http://localhost:${port}`, {
                auth: { token: 'bad.token.here' },
                transports: ['websocket'],
            });
            client.on('connect_error', (err) => {
                expect(err.message).toContain('Invalid or expired token');
                client.disconnect();
                done();
            });
        });

        it('should reject token without userId', (done) => {
            const tokenNoUser = jwt.sign({ foo: 'bar' }, process.env.JWT_SECRET as string);
            const client = ClientIO(`http://localhost:${port}`, {
                auth: { token: tokenNoUser },
                transports: ['websocket'],
            });
            client.on('connect_error', (err) => {
                expect(err.message).toContain('Invalid token');
                client.disconnect();
                done();
            });
        });

        it('should accept connection with valid token', async () => {
            const client = await connectClient(makeToken(user1Id));
            expect(client.connected).toBe(true);
            client.disconnect();
        });
    });

    describe('joinChat', () => {
        let client: ClientSocket;

        beforeEach(async () => {
            client = await connectClient(makeToken(user1Id));
        });

        afterEach(() => {
            client.disconnect();
        });

        it('should create a new chat and join it', (done) => {
            client.emit('joinChat', { targetUserId: user2Id });
            client.on('chatJoined', (data: any) => {
                expect(data).toHaveProperty('chatId');
                expect(data.messages).toEqual([]);
                done();
            });
        });

        it('should join existing chat instead of creating duplicate', async () => {
            const chat = await ChatModel.create({
                participants: [user1Id, user2Id],
                messages: [{ sender: user1Id, content: 'Hello', status: 'sent' }],
                lastMessage: 'Hello',
                lastUpdated: new Date(),
            });

            await new Promise<void>((resolve) => {
                client.emit('joinChat', { targetUserId: user2Id });
                client.on('chatJoined', (data: any) => {
                    expect(data.chatId).toBe(chat._id.toString());
                    expect(data.messages).toHaveLength(1);
                    resolve();
                });
            });
        });
    });

    describe('sendMessage', () => {
        let client: ClientSocket;
        let chatId: string;

        beforeEach(async () => {
            const chat = await ChatModel.create({
                participants: [user1Id, user2Id],
                messages: [],
                lastUpdated: new Date(),
            });
            chatId = chat._id.toString();
            client = await connectClient(makeToken(user1Id));

            await new Promise<void>((resolve) => {
                client.emit('joinChat', { targetUserId: user2Id });
                client.on('chatJoined', () => resolve());
            });
        });

        afterEach(() => {
            client.disconnect();
        });

        it('should send a message and receive it back', (done) => {
            client.on('receiveMessage', (msg: any) => {
                expect(msg.content).toBe('Test message');
                expect(msg.status).toBe('sent');
                done();
            });
            client.emit('sendMessage', { chatId, content: 'Test message' });
        });

        it('should emit error for non-existent chat', (done) => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            client.on('error', (msg: any) => {
                expect(msg).toBe('Chat not found or unauthorized');
                done();
            });
            client.emit('sendMessage', { chatId: fakeId, content: 'Hello' });
        });
    });

    describe('getMessages', () => {
        let client: ClientSocket;

        beforeEach(async () => {
            client = await connectClient(makeToken(user1Id));
        });

        afterEach(() => {
            client.disconnect();
        });

        it('should fetch messages for a chat', async () => {
            const chat = await ChatModel.create({
                participants: [user1Id, user2Id],
                messages: [
                    { sender: user1Id, content: 'Hi', status: 'sent' },
                    { sender: user2Id, content: 'Hey', status: 'sent' },
                ],
                lastUpdated: new Date(),
            });

            await new Promise<void>((resolve) => {
                client.emit('getMessages', { chatId: chat._id.toString() });
                client.on('messages', (msgs: any[]) => {
                    expect(msgs).toHaveLength(2);
                    expect(msgs[0].content).toBe('Hi');
                    expect(msgs[1].content).toBe('Hey');
                    resolve();
                });
            });
        });

        it('should emit error for unauthorized chat', (done) => {
            const stranger1 = new mongoose.Types.ObjectId();
            const stranger2 = new mongoose.Types.ObjectId();

            ChatModel.create({
                participants: [stranger1, stranger2],
                messages: [],
                lastUpdated: new Date(),
            }).then((chat) => {
                client.emit('getMessages', { chatId: chat._id.toString() });
                client.on('error', (msg: any) => {
                    expect(msg).toBe('Chat not found or unauthorized');
                    done();
                });
            });
        });
    });

    describe('markAsRead', () => {
        let client: ClientSocket;

        beforeEach(async () => {
            client = await connectClient(makeToken(user1Id));
        });

        afterEach(() => {
            client.disconnect();
        });

        it('should mark a message as read', async () => {
            const chat = await ChatModel.create({
                participants: [user1Id, user2Id],
                messages: [{ sender: user2Id, content: 'Hello', status: 'sent' }],
                lastUpdated: new Date(),
            });
            const messageId = chat.messages[0]._id.toString();
            const chatId = chat._id.toString();

            // Join the chat room first
            await new Promise<void>((resolve) => {
                client.emit('joinChat', { targetUserId: user2Id });
                client.on('chatJoined', () => resolve());
            });

            await new Promise<void>((resolve) => {
                client.on('messageStatusUpdated', (data: any) => {
                    expect(data.messageId).toBe(messageId);
                    expect(data.status).toBe('read');
                    resolve();
                });
                client.emit('markAsRead', { chatId, messageId });
            });

            const updated = await ChatModel.findById(chatId);
            expect(updated!.messages[0].status).toBe('read');
        });

        it('should emit error for non-existent message', (done) => {
            const fakeChat = new mongoose.Types.ObjectId().toString();
            const fakeMsg = new mongoose.Types.ObjectId().toString();

            client.on('error', (msg: any) => {
                expect(msg).toBe('Message not found or unauthorized');
                done();
            });
            client.emit('markAsRead', { chatId: fakeChat, messageId: fakeMsg });
        });
    });

    describe('joinChat error path', () => {
        it('emits error when the DB throws', async () => {
            const client = await connectClient(makeToken(user1Id));
            const spy = jest.spyOn(ChatModel, 'findOne').mockImplementationOnce(() => {
                throw new Error('boom');
            });

            await new Promise<void>((resolve) => {
                client.on('error', (msg: any) => {
                    expect(msg).toBe('Failed to join chat');
                    resolve();
                });
                client.emit('joinChat', { targetUserId: user2Id });
            });

            spy.mockRestore();
            client.disconnect();
        });
    });

    describe('sendMessage error path (unexpected)', () => {
        it('emits error when the DB throws unexpectedly', async () => {
            const client = await connectClient(makeToken(user1Id));
            const spy = jest.spyOn(ChatModel, 'findOneAndUpdate').mockImplementationOnce(() => {
                throw new Error('boom');
            });

            await new Promise<void>((resolve) => {
                client.on('error', (msg: any) => {
                    expect(msg).toBe('Failed to send message');
                    resolve();
                });
                client.emit('sendMessage', {
                    chatId: new mongoose.Types.ObjectId().toString(),
                    content: 'x',
                });
            });

            spy.mockRestore();
            client.disconnect();
        });
    });

    describe('getMessages error path (unexpected)', () => {
        it('emits error when the DB throws unexpectedly', async () => {
            const client = await connectClient(makeToken(user1Id));
            const spy = jest.spyOn(ChatModel, 'findOne').mockImplementationOnce(() => {
                throw new Error('boom');
            });

            await new Promise<void>((resolve) => {
                client.on('error', (msg: any) => {
                    expect(msg).toBe('Failed to fetch messages');
                    resolve();
                });
                client.emit('getMessages', { chatId: new mongoose.Types.ObjectId().toString() });
            });

            spy.mockRestore();
            client.disconnect();
        });
    });

    describe('markAsRead error path (unexpected)', () => {
        it('emits error when the DB throws unexpectedly', async () => {
            const client = await connectClient(makeToken(user1Id));
            const spy = jest.spyOn(ChatModel, 'findOneAndUpdate').mockImplementationOnce(() => {
                throw new Error('boom');
            });

            await new Promise<void>((resolve) => {
                client.on('error', (msg: any) => {
                    expect(msg).toBe('Failed to update message status');
                    resolve();
                });
                client.emit('markAsRead', {
                    chatId: new mongoose.Types.ObjectId().toString(),
                    messageId: new mongoose.Types.ObjectId().toString(),
                });
            });

            spy.mockRestore();
            client.disconnect();
        });
    });

    describe('fridge chat events', () => {
        let fridgeId: string;

        beforeEach(async () => {
            const fridge = await FridgeModel.create({
                name: 'Sock Fridge',
                inviteCode: `SOCK_${Date.now()}_${Math.random()}`,
                members: [
                    { userId: new mongoose.Types.ObjectId(user1Id), joinedAt: new Date() },
                    { userId: new mongoose.Types.ObjectId(user2Id), joinedAt: new Date() },
                ],
            });
            fridgeId = fridge._id.toString();
        });

        it('joinFridgeChat: emits fridgeChatJoined for a member and creates the chat doc', async () => {
            const client = await connectClient(makeToken(user1Id));
            await new Promise<void>((resolve) => {
                client.on('fridgeChatJoined', (data: any) => {
                    expect(data.fridgeId).toBe(fridgeId);
                    resolve();
                });
                client.emit('joinFridgeChat', { fridgeId });
            });

            const chat = await FridgeChatModel.findOne({ fridgeId });
            expect(chat).not.toBeNull();

            client.disconnect();
        });

        it('joinFridgeChat: emits fridgeChatError for a non-member', async () => {
            const strangerId = new mongoose.Types.ObjectId().toString();
            const client = await connectClient(makeToken(strangerId));
            await new Promise<void>((resolve) => {
                client.on('fridgeChatError', (data: any) => {
                    expect(data.fridgeId).toBe(fridgeId);
                    expect(String(data.message)).toMatch(/not a member/i);
                    resolve();
                });
                client.emit('joinFridgeChat', { fridgeId });
            });
            client.disconnect();
        });

        it('leaveFridgeChat: leaves the room silently', async () => {
            const client = await connectClient(makeToken(user1Id));
            await new Promise<void>((resolve) => {
                client.on('fridgeChatJoined', () => resolve());
                client.emit('joinFridgeChat', { fridgeId });
            });
            // No response expected — just should not throw.
            client.emit('leaveFridgeChat', { fridgeId });
            await new Promise((r) => setTimeout(r, 20));
            client.disconnect();
        });

        it('sendFridgeMessage: fans out to the fridge room and persists the message', async () => {
            const clientA = await connectClient(makeToken(user1Id));
            const clientB = await connectClient(makeToken(user2Id));

            await new Promise<void>((r) => {
                clientA.on('fridgeChatJoined', () => r());
                clientA.emit('joinFridgeChat', { fridgeId });
            });
            await new Promise<void>((r) => {
                clientB.on('fridgeChatJoined', () => r());
                clientB.emit('joinFridgeChat', { fridgeId });
            });

            const receivedByB = new Promise<any>((r) => {
                clientB.on('fridgeMessageReceived', (payload: any) => r(payload));
            });

            clientA.emit('sendFridgeMessage', { fridgeId, content: 'ping', type: 'text' });
            const payload = await receivedByB;
            expect(payload.fridgeId).toBe(fridgeId);
            expect(payload.message.content).toBe('ping');

            const chat = await FridgeChatModel.findOne({ fridgeId });
            expect(chat!.messages).toHaveLength(1);

            clientA.disconnect();
            clientB.disconnect();
        });

        it('sendFridgeMessage: emits fridgeChatError when validation fails', async () => {
            const client = await connectClient(makeToken(user1Id));
            await new Promise<void>((r) => {
                client.on('fridgeChatJoined', () => r());
                client.emit('joinFridgeChat', { fridgeId });
            });

            await new Promise<void>((resolve) => {
                client.on('fridgeChatError', (data: any) => {
                    expect(String(data.message)).toMatch(/required|content/i);
                    resolve();
                });
                client.emit('sendFridgeMessage', { fridgeId, content: '', type: 'text' });
            });

            client.disconnect();
        });
    });

    describe('disconnect handler', () => {
        it('logs on disconnect (no assertion on side-effects, just exercises the branch)', async () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            const client = await connectClient(makeToken(user1Id));
            client.disconnect();
            // Give the server a tick to process the disconnect.
            await new Promise((r) => setTimeout(r, 30));
            logSpy.mockRestore();
        });
    });
});
