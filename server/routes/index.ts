import { Router } from 'express';
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";

const router = Router();

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/user", userRoutes);

export default router;

