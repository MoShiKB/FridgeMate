import cron from "node-cron";
import { InventoryItemModel } from "../models/inventory-item.model";
import { NotificationService } from "./notification.service";
import { FridgeModel } from "../models/fridge.model";

export const initCronJobs = () => {
    // Run daily at 9:00 AM
    cron.schedule("0 9 * * *", async () => {
        console.log("Running daily expiration check...");
        try {
            const now = new Date();
            const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

            // Find items expiring between now and 2 days from now
            // And maybe items that just expired
            const expiringItems = await InventoryItemModel.find({
                expiryDate: { $lte: twoDaysFromNow, $gte: now },
                isConsumed: false
            });

            const fridgeMap = new Map<string, string[]>();

            for (const item of expiringItems) {
                const fridgeId = item.fridgeId.toString();
                if (!fridgeMap.has(fridgeId)) {
                    const fridge = await FridgeModel.findById(fridgeId).select("members");
                    if (fridge && fridge.members) {
                        fridgeMap.set(fridgeId, fridge.members.map((m: any) => m.userId.toString()));
                    } else {
                        fridgeMap.set(fridgeId, []);
                    }
                }

                const usersToNotify = fridgeMap.get(fridgeId) || [];

                for (const userId of usersToNotify) {
                    await NotificationService.sendNotification({
                        userId,
                        type: "EXPIRING_ITEM",
                        title: "Item Expiring Soon!",
                        message: `${item.name} is expiring soon. Don't let it go to waste!`,
                        metadata: {
                            itemId: item._id,
                            fridgeId: item.fridgeId
                        }
                    });
                }
            }

            console.log(`Processed ${expiringItems.length} expiring items.`);
        } catch (error) {
            console.error("Error in expiration cron job:", error);
        }
    });

    console.log("Cron jobs initialized.");
};
