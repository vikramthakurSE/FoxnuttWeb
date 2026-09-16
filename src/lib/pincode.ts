import data from "@/data/pincodes.json";
import { isPincode, type PincodeLocation } from "./delivery";

/**
 * PIN code → India Post district(s) and state, from the bundled All India
 * Pincode Directory (src/data/pincodes.json). Bundled rather than fetched
 * so checkout never depends on a third-party lookup service being up.
 *
 * The file stores each distinct district/state pair once; a PIN code maps
 * to one index, or to several (most post offices first) when it straddles
 * districts.
 */

const table = data as unknown as {
  districts: [string, string][];
  pincodes: Record<string, number | number[]>;
};

export function lookupPincode(raw: string): PincodeLocation | null {
  const pincode = raw.replace(/\s/g, "");
  if (!isPincode(pincode)) return null;
  const hit = table.pincodes[pincode];
  if (hit == null) return null;
  const pairs = (Array.isArray(hit) ? hit : [hit]).map((i) => table.districts[i]);
  return {
    pincode,
    districts: [...new Set(pairs.map(([district]) => district))],
    state: pairs[0][1],
  };
}
