import { Request, Response } from "express";
import { items as itemsRes, ok } from "../utils/apiResponse";
import { parsePageLimit } from "../utils/pagination";
import { InventoryItemService } from "../services/inventory-item.service";

type AuthedRequest = Request & { user: { userId: string } };

export class InventoryItemController {
  /**
   * Create a new inventory item
   * POST /fridges/:fridgeId/items
   */
  static async create(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const { fridgeId } = req.params;

    const created = await InventoryItemService.create(fridgeId, userId, req.body);
    return ok(res, created, 201);
  }

  /**
   * Get all items in a fridge
   * GET /fridges/:fridgeId/items
   */
  static async getAll(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const { fridgeId } = req.params;
    const { page, limit, skip } = parsePageLimit(req.query);

    const result = await InventoryItemService.getAll(
      fridgeId,
      userId,
      req.query as any,
      { skip, limit }
    );

    return itemsRes(res, {
      items: result.items,
      total: result.total,
      page,
      limit,
    });
  }

  /**
   * Get a single item by ID
   * GET /fridges/:fridgeId/items/:itemId
   */
  static async getById(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const { itemId } = req.params;

    const item = await InventoryItemService.getById(itemId, userId);
    return ok(res, item);
  }

  /**
   * Update an item
   * PATCH /fridges/:fridgeId/items/:itemId
   */
  static async update(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const { itemId } = req.params;

    const updated = await InventoryItemService.update(itemId, userId, req.body);
    return ok(res, updated);
  }

  /**
   * Delete an item
   * DELETE /fridges/:fridgeId/items/:itemId
   */
  static async delete(req: Request, res: Response) {
    const userId = (req as AuthedRequest).user.userId;
    const { itemId } = req.params;

    const result = await InventoryItemService.delete(itemId, userId);
    return ok(res, result);
  }
}
