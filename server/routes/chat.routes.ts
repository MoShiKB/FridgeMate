import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import ChatModel from "../models/chat.model";

export const chatRoutes = Router();

chatRoutes.get(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
        const userId = (req as any).user.userId;

        const chats = await ChatModel.find({ participants: userId })
            .populate({
                path: "participants",
                select: "displayName profileImage",
            })
            .sort({ lastUpdated: -1 })
            .lean();

        const items = chats.map((chat) => ({
            chatId: (chat as any)._id.toString(),
            participants: chat.participants,
            lastMessage: chat.lastMessage || "",
            lastUpdated: chat.lastUpdated,
            messageCount: chat.messages.length,
        }));

        res.json({ items, total: items.length });
    })
);
