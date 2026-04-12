import "../config/env";
import { connectDB, disconnectDB } from "../config/database";
import { UserModel } from "../models/user.model";
import { InventoryItemModel } from "../models/inventory-item.model";
import mongoose from "mongoose";

const mockItemTemplates = [
  { name: "Milk", quantity: "200ml", ownership: "SHARED" as const, isRunningLow: true },
  { name: "Eggs", quantity: "2 left", ownership: "SHARED" as const, isRunningLow: true },
  { name: "Butter", quantity: "30g", ownership: "PRIVATE" as const, isRunningLow: true },
  { name: "Chicken Breast", quantity: "500g", ownership: "SHARED" as const, isRunningLow: false },
  { name: "Broccoli", quantity: "1 head", ownership: "SHARED" as const, isRunningLow: false },
  { name: "Cheddar Cheese", quantity: "200g", ownership: "PRIVATE" as const, isRunningLow: false },
  { name: "Orange Juice", quantity: "1 liter", ownership: "SHARED" as const, isRunningLow: false },
  { name: "Leftover Pasta", quantity: "1 container", ownership: "PRIVATE" as const, isRunningLow: false },
  { name: "Yogurt", quantity: "3 cups", ownership: "SHARED" as const, isRunningLow: false },
  { name: "Tomatoes", quantity: "4 pieces", ownership: "SHARED" as const, isRunningLow: false },
];

const seed = async () => {
  await connectDB();

  const users = await UserModel.find({ activeFridgeId: { $ne: null } }).lean();

  if (users.length === 0) {
    console.log("No users with active fridges found. Nothing to seed.");
    await disconnectDB();
    return;
  }

  console.log(`Found ${users.length} user(s) with active fridges.`);

  for (const user of users) {
    const fridgeId = user.activeFridgeId!;

    const existing = await InventoryItemModel.countDocuments({
      fridgeId,
      ownerId: user._id,
    });

    if (existing > 0) {
      console.log(`Skipping "${user.displayName}" — items already exist (${existing} items).`);
      continue;
    }

    const items = mockItemTemplates.map((template) => ({
      fridgeId: new mongoose.Types.ObjectId(fridgeId.toString()),
      ownerId: new mongoose.Types.ObjectId(user._id.toString()),
      name: template.name,
      quantity: template.quantity,
      ownership: template.ownership,
      isRunningLow: template.isRunningLow,
    }));

    await InventoryItemModel.insertMany(items);
    console.log(`Added ${items.length} items for "${user.displayName}".`);
  }

  await disconnectDB();
  console.log("Seeding complete.");
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
