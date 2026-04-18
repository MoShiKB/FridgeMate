import { Server } from 'socket.io';
import { createServer, Server as HttpServer } from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import ChatModel from '../../models/chat.model';
import { setupSocketHandlers } from '../../socket/socket-handlers';

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
});
