import { MongoStore } from "./mongoStore";
import type { Store } from "./types";

const holder = globalThis as unknown as { __skylineStore?: Store };

/** The active store: MongoDB Atlas Database [skyms] */
export function getStore(): Store {
  if (!holder.__skylineStore) {
    holder.__skylineStore = new MongoStore();
  }
  return holder.__skylineStore!;
}

export * from "./types";
