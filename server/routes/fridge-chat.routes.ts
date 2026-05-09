import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { FridgeChatService } from "../services/fridge-chat.service";

export const fridgeChatRoutes = Router({ mergeParams: true });

fridgeChatRoutes.get(
  "/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).user.userId;
    const { fridgeId } = req.params as { fridgeId: string };
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;

    const { messages, hasMore } = await FridgeChatService.getMessages(fridgeId, userId, {
      before,
      limit,
    });

    res.json({ items: messages, hasMore });
  })
);

fridgeChatRoutes.post(
  "/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).user.userId;
    const { fridgeId } = req.params as { fridgeId: string };
    await FridgeChatService.markRead(fridgeId, userId);
    res.status(204).end();
  })
);

fridgeChatRoutes.get(
  "/unread-count",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).user.userId;
    const { fridgeId } = req.params as { fridgeId: string };
    const unreadCount = await FridgeChatService.getUnreadCount(fridgeId, userId);
    res.json({ unreadCount });
  })
);
