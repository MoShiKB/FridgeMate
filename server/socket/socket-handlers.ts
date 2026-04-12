import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import ChatModel, { IChat } from "../models/chat.model";

interface AuthSocket extends Socket {
    data: { userId: string };
}

export const setupSocketHandlers = (io: Server) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) return next(new Error("Authentication required"));

        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
                userId?: string;
            };
            if (!payload.userId) return next(new Error("Invalid token"));

            socket.data.userId = payload.userId;
            next();
        } catch {
            next(new Error("Invalid or expired token"));
        }
    });

    io.on("connection", (socket: AuthSocket) => {
        console.log(`Socket connected: user ${socket.data.userId}`);

        socket.on("joinChat", async ({ targetUserId }: { targetUserId: string }) => {
            try {
                const userId = socket.data.userId;

                let chat: IChat | null = await ChatModel.findOne({
                    participants: { $all: [userId, targetUserId] },
                })
                    .populate({
                        path: "messages.sender",
                        select: "displayName profileImage",
                    })
                    .exec();

                if (!chat) {
                    chat = await ChatModel.create({
                        participants: [userId, targetUserId],
                        messages: [],
                    });
                }

                const chatId = (chat as any)._id.toString();
                socket.join(chatId);
                socket.emit("chatJoined", { chatId, messages: chat.messages });
            } catch (error) {
                socket.emit("error", "Failed to join chat");
            }
        });

        socket.on(
            "sendMessage",
            async ({ chatId, content }: { chatId: string; content: string }) => {
                try {
                    const senderId = socket.data.userId;

                    const chat = await ChatModel.findOneAndUpdate(
                        { _id: chatId, participants: senderId },
                        {
                            $push: {
                                messages: { sender: senderId, content, status: "sent" },
                            },
                            lastMessage: content,
                            lastUpdated: new Date(),
                        },
                        { new: true }
                    ).populate({
                        path: "messages.sender",
                        select: "displayName profileImage",
                    });

                    if (!chat) {
                        return socket.emit("error", "Chat not found or unauthorized");
                    }

                    const newMessage = chat.messages[chat.messages.length - 1];
                    io.to(chatId).emit("receiveMessage", newMessage);
                } catch (error) {
                    socket.emit("error", "Failed to send message");
                }
            }
        );

        socket.on("getMessages", async ({ chatId }: { chatId: string }) => {
            try {
                const userId = socket.data.userId;

                const chat = await ChatModel.findOne({ _id: chatId, participants: userId })
                    .populate({
                        path: "messages.sender",
                        select: "displayName profileImage",
                    })
                    .exec();

                if (!chat) {
                    return socket.emit("error", "Chat not found or unauthorized");
                }

                socket.emit("messages", chat.messages);
            } catch (error) {
                socket.emit("error", "Failed to fetch messages");
            }
        });

        socket.on(
            "markAsRead",
            async ({ chatId, messageId }: { chatId: string; messageId: string }) => {
                try {
                    const userId = socket.data.userId;

                    const result = await ChatModel.findOneAndUpdate(
                        { _id: chatId, participants: userId, "messages._id": messageId },
                        { $set: { "messages.$.status": "read" } },
                        { new: true }
                    );

                    if (!result) {
                        return socket.emit("error", "Message not found or unauthorized");
                    }

                    io.to(chatId).emit("messageStatusUpdated", {
                        messageId,
                        status: "read",
                    });
                } catch (error) {
                    socket.emit("error", "Failed to update message status");
                }
            }
        );

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: user ${socket.data.userId}`);
        });
    });
};
