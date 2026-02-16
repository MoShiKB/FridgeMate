import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import { fridgesRoutes } from "./fridges.routes";
import aiRoutes from "./ai.routes";
import recipeRoutes from "./recipe.routes";
import { commentsRoutes } from "./comments.routes";
import { postsRoutes } from "./posts.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/fridges", fridgesRoutes);
router.use("/ai", aiRoutes);
router.use("/recipes", recipeRoutes);
router.use("/posts", commentsRoutes);
router.use("/posts", postsRoutes);

export default router;
