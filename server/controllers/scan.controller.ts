import { Request, Response } from "express";
import { ok } from "../utils/apiResponse";
import { ScanService } from "../services/scan.service";
import { ApiError } from "../utils/errors";

type AuthedRequest = Request & { user: { userId: string } };

export class ScanController {
  static async upload(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;

    if (!req.file) {
      throw new ApiError(400, "Image file is required", "MISSING_FILE");
    }

    const scan = await ScanService.createScan(
      userId,
      req.file.buffer,
      req.file.mimetype
    );

    return ok(res, scan, 201);
  }

  static async getById(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const { scanId } = req.params;

    const scan = await ScanService.getScanById(scanId, userId);
    return ok(res, scan);
  }
}
