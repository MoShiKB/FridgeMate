import { Request, Response } from "express";
import { items as itemsRes, ok } from "../utils/apiResponse";
import { parsePageLimit } from "../utils/pagination";
import { ScanService } from "../services/scan.service";
import { ApiError } from "../utils/errors";

import { AuthedRequest } from "../middlewares/auth";

export class ScanController {
  static async upload(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const file = (req as AuthedRequest).file;

    if (!file) {
      throw new ApiError(400, "Image file is required", "MISSING_FILE");
    }

    const scan = await ScanService.createScan(
      userId,
      file.buffer,
      file.mimetype
    );

    return ok(res, scan, 201);
  }

  static async getAll(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const { page, limit, skip } = parsePageLimit(req.query);

    const result = await ScanService.getScans(userId, { skip, limit });

    return itemsRes(res, {
      items: result.items,
      total: result.total,
      page,
      limit,
    });
  }

  static async getById(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const { scanId } = req.params;

    const scan = await ScanService.getScanById(scanId, userId);
    return ok(res, scan);
  }
}
