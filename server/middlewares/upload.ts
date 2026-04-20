import multer from "multer";
import path from "path";
import crypto from "crypto";
import { UPLOADS_DIR } from "../config/env";
import { ApiError } from "../utils/errors";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = crypto.randomBytes(16).toString("hex");
    cb(null, `${name}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const SCAN_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SCAN_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const scanFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (SCAN_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, "Only JPEG, PNG, and WebP images are allowed", "INVALID_FILE_TYPE"));
  }
};

export const uploadScanImage = multer({
  storage: multer.memoryStorage(),
  fileFilter: scanFileFilter,
  limits: { fileSize: SCAN_MAX_FILE_SIZE },
}).single("image");
