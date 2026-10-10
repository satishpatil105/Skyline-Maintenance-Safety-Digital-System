import path from "path";

/**
 * Folder for uploaded photos and application assets.
 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");

/** Data seed paths if initializing collection fixtures */
export const SEED_JSON_PATHS = [
  path.join(DATA_DIR, "db.json"),
  path.join(process.cwd(), "data", "db.json"),
];
