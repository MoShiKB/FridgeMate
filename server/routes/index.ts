import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import { fridgesRoutes } from "./fridges.routes"; 

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/fridges", fridgesRoutes);

export default router;
