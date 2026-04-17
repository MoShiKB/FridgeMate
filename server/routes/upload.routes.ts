import { Router, Request, Response } from "express";
import { requireAuth } from "../middlewares/auth";
import { upload } from "../middlewares/upload";
const router = Router();

router.post("/", requireAuth, upload.single("image"), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const baseUrl = `${protocol}://${req.get("host")}`;
  const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
  return res.status(201).json({ ok: true, data: { imageUrl } });
});

export default router;
