import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import { fridgesRoutes } from "./fridges.routes";
import { chatRoutes } from "./chat.routes";
import aiRoutes from "./ai.routes";
import recipeRoutes from "./recipe.routes";
import { commentsRoutes } from "./comments.routes";
import { postsRoutes } from "./posts.routes";
import { inventoryItemRoutes } from "./inventory-item.routes";
import { scanRoutes } from "./scan.routes";
import uploadRoutes from "./upload.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/fridges", fridgesRoutes);
router.use("/fridges/:fridgeId/items", inventoryItemRoutes);
router.use("/fridges/me/scans", scanRoutes);
router.use("/chats", chatRoutes);
router.use("/ai", aiRoutes);
router.use("/recipes", recipeRoutes);
router.use("/posts", commentsRoutes);
router.use("/posts", postsRoutes);
router.use("/upload", uploadRoutes);

export default router;
