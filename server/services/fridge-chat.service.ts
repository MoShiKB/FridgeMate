import mongoose, { Types } from "mongoose";
import { FridgeModel } from "../models/fridge.model";
import FridgeChatModel, { IFridgeChat, IFridgeChatMessage } from "../models/fridge-chat.model";
import FridgeChatReadModel from "../models/fridge-chat-read.model";
import { ApiError } from "../utils/errors";

const DEFAULT_PAGE = 50;
const MAX_PAGE = 200;

function ensureValidObjectId(id: string, what: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, `Invalid ${what}`);
  }
}

export const FridgeChatService = {
  async assertMember(fridgeId: string, userId: string) {
    ensureValidObjectId(fridgeId, "fridgeId");
    const isMember = await FridgeModel.exists({
      _id: fridgeId,
      "members.userId": new Types.ObjectId(userId),
    });
    if (!isMember) throw new ApiError(403, "You are not a member of this fridge");
  },

  async getOrCreate(fridgeId: string): Promise<IFridgeChat> {
    const existing = await FridgeChatModel.findOne({ fridgeId }).exec();
    if (existing) return existing;

    try {
      return await FridgeChatModel.create({
        fridgeId: new Types.ObjectId(fridgeId),
        messages: [],
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        const again = await FridgeChatModel.findOne({ fridgeId }).exec();
        if (again) return again;
      }
      throw err;
    }
  },

  async getMessages(
    fridgeId: string,
    userId: string,
    opts: { before?: string; limit?: number } = {}
  ) {
    await this.assertMember(fridgeId, userId);

    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_PAGE, 1), MAX_PAGE);

    const chat = await FridgeChatModel.findOne({ fridgeId })
      .populate({ path: "messages.sender", select: "displayName profileImage" })
      .lean()
      .exec();

    if (!chat) return { messages: [], hasMore: false };

    let all = chat.messages as unknown as IFridgeChatMessage[];

    if (opts.before) {
      ensureValidObjectId(opts.before, "before");
      const beforeIdx = all.findIndex((m) => m._id.toString() === opts.before);
      if (beforeIdx > -1) {
        all = all.slice(0, beforeIdx);
      }
    }

    const start = Math.max(0, all.length - limit);
    const page = all.slice(start);
    return { messages: page, hasMore: start > 0 };
  },

  async appendMessage(
    fridgeId: string,
    senderId: string,
    content: string,
    opts: { type?: "text" | "recipe_share"; payload?: Record<string, unknown> } = {}
  ) {
    await this.assertMember(fridgeId, senderId);

    const type = opts.type ?? "text";
    const trimmed = content?.trim() ?? "";

    // For text messages, content is required. For shares, content can be empty
    // (we synthesize a fallback so the chat preview/last-message reads naturally).
    if (type === "text" && !trimmed) {
      throw new ApiError(400, "Message content is required");
    }
    if (trimmed.length > 2000) throw new ApiError(400, "Message too long");

    let finalContent = trimmed;
    if (type === "recipe_share") {
      const payload = opts.payload;
      if (!payload || typeof payload !== "object") {
        throw new ApiError(400, "Invalid recipe payload");
      }
      const recipeId = (payload as any).recipeId;
      const title = (payload as any).title;
      if (typeof recipeId !== "string" || !recipeId) {
        throw new ApiError(400, "recipeId is required");
      }
      if (typeof title !== "string" || !title) {
        throw new ApiError(400, "title is required");
      }
      if (!finalContent) finalContent = `Shared a recipe: ${title}`;
    }

    await this.getOrCreate(fridgeId);

    const messageId = new Types.ObjectId();
    const now = new Date();

    const updated = await FridgeChatModel.findOneAndUpdate(
      { fridgeId },
      {
        $push: {
          messages: {
            _id: messageId,
            sender: new Types.ObjectId(senderId),
            content: finalContent,
            type,
            payload: opts.payload,
            createdAt: now,
          },
        },
        $set: { lastMessage: finalContent, lastUpdated: now },
      },
      { new: true }
    )
      .populate({ path: "messages.sender", select: "displayName profileImage" })
      .exec();

    if (!updated) throw new ApiError(500, "Failed to append message");

    const newMessage = updated.messages[updated.messages.length - 1];
    return newMessage;
  },

  async markRead(fridgeId: string, userId: string) {
    await this.assertMember(fridgeId, userId);
    await FridgeChatReadModel.updateOne(
      { fridgeId: new Types.ObjectId(fridgeId), userId: new Types.ObjectId(userId) },
      { $set: { lastReadAt: new Date() } },
      { upsert: true }
    );
  },

  async getUnreadCount(fridgeId: string, userId: string): Promise<number> {
    await this.assertMember(fridgeId, userId);

    const chat = await FridgeChatModel.findOne({ fridgeId })
      .select({ messages: 1 })
      .lean<{ messages: IFridgeChatMessage[] }>()
      .exec();
    if (!chat || chat.messages.length === 0) return 0;

    const userObjectId = new Types.ObjectId(userId);

    const read = await FridgeChatReadModel.findOne({
      fridgeId: new Types.ObjectId(fridgeId),
      userId: userObjectId,
    })
      .lean()
      .exec();

    let cutoff: Date | undefined = read?.lastReadAt;
    if (!cutoff) {
      const fridge = await FridgeModel.findOne(
        { _id: fridgeId, "members.userId": userObjectId },
        { "members.$": 1 }
      )
        .lean<{ members: { userId: Types.ObjectId; joinedAt: Date }[] }>()
        .exec();
      cutoff = fridge?.members[0]?.joinedAt;
    }

    let count = 0;
    for (const m of chat.messages) {
      if (m.sender.equals(userObjectId)) continue;
      if (cutoff && m.createdAt <= cutoff) continue;
      count += 1;
    }
    return count;
  },
};
