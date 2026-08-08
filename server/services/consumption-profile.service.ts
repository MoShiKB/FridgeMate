import {
  ConsumptionProfileModel,
  CONSUMPTION_PROFILE_VERSION,
} from "../models/consumption-profile.model";
import { AIService } from "./ai.service";
import type { ConsumptionProfile } from "./stock.service";

/** Item names asked for in a single AI request. */
const LOOKUP_CHUNK_SIZE = 40;

export class ConsumptionProfileService {
  static normalizeKey(name: string): string {
    return String(name ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  }

  /**
   * Only unseen names reach the AI. Names it fails on are absent from the map,
   * which the stock engine treats as "can't assess".
   */
  static async getProfiles(names: string[]): Promise<Map<string, ConsumptionProfile>> {
    const byKey = new Map<string, string>();
    for (const name of names) {
      const key = this.normalizeKey(name);
      if (key) byKey.set(key, name);
    }
    if (byKey.size === 0) return new Map();

    const profiles = new Map<string, ConsumptionProfile>();

    const cached = await ConsumptionProfileModel.find({
      key: { $in: [...byKey.keys()] },
      version: CONSUMPTION_PROFILE_VERSION,
    }).lean();

    for (const row of cached) {
      profiles.set(row.key, {
        pieceServings: row.pieceServings,
        packageServings: row.packageServings,
        gramsPerServing: row.gramsPerServing,
        mlPerServing: row.mlPerServing,
        servingsPerPersonPerWeek: row.servingsPerPersonPerWeek,
      });
    }

    const missing = [...byKey.entries()].filter(([key]) => !profiles.has(key));
    if (missing.length === 0) return profiles;

    for (let i = 0; i < missing.length; i += LOOKUP_CHUNK_SIZE) {
      const chunk = missing.slice(i, i + LOOKUP_CHUNK_SIZE);
      const fetched = await AIService.getConsumptionProfiles(chunk.map(([, name]) => name));
      if (fetched.size === 0) continue;

      const writes: any[] = [];
      for (const [key, originalName] of chunk) {
        // The model echoes the name back, but not always byte-for-byte.
        const profile =
          fetched.get(originalName) ??
          [...fetched.entries()].find(([n]) => this.normalizeKey(n) === key)?.[1];
        if (!profile) continue;

        profiles.set(key, profile);
        writes.push({
          updateOne: {
            filter: { key },
            update: { $set: { ...profile, key, version: CONSUMPTION_PROFILE_VERSION } },
            upsert: true,
          },
        });
      }

      if (writes.length > 0) {
        try {
          await ConsumptionProfileModel.bulkWrite(writes, { ordered: false });
        } catch (err) {
          console.warn("Failed to cache consumption profiles", err);
        }
      }
    }

    return profiles;
  }
}
