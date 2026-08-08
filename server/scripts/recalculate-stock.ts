import "../config/env";
import { connectDB, disconnectDB } from "../config/database";
import { FridgeModel } from "../models/fridge.model";
import { InventoryItemModel } from "../models/inventory-item.model";
import { InventoryItemService } from "../services/inventory-item.service";

/**
 * Re-assesses running-low status for every fridge, or one if an id is passed.
 * Stored flags otherwise only refresh when an item, a scan or the member list
 * changes, so run this after changing the stock engine or the profile prompt.
 *
 *   npx ts-node --project tsconfig.json --files scripts/recalculate-stock.ts [fridgeId]
 */
const recalculate = async () => {
  await connectDB();

  const fridgeId = process.argv[2];
  const fridges = fridgeId
    ? await FridgeModel.find({ _id: fridgeId }).lean()
    : await FridgeModel.find({}).lean();

  if (fridges.length === 0) {
    console.log("No fridges found.");
    await disconnectDB();
    return;
  }

  for (const fridge of fridges) {
    const id = fridge._id.toString();
    const total = await InventoryItemModel.countDocuments({ fridgeId: fridge._id });
    if (total === 0) continue;

    await InventoryItemService.recalculateFridgeStock(id, fridge.members.length);

    const low = await InventoryItemModel.countDocuments({
      fridgeId: fridge._id,
      isRunningLow: true,
    });
    console.log(
      `${fridge.name} (${fridge.members.length} members): ${low}/${total} running low`
    );
  }

  await disconnectDB();
};

recalculate().catch(async (err) => {
  console.error("Recalculation failed:", err);
  await disconnectDB();
  process.exit(1);
});
