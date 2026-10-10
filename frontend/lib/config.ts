import path from "path";

/**
 * Folder for uploaded machine photos and attachments.
 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
