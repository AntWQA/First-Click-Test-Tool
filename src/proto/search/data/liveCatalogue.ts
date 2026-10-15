import { liveCatalogue as live, liveImages } from "virtual:live-catalogue";

/**
 * Optional real catalogue from the live storefront, kept outside the repo (see vite.config.ts, LIVE_CATALOGUE_DIR).
 * Nothing here is committed: the folder is read at build time and the module is simply empty when it is not on this machine.
 */
interface LiveFile { products: unknown[]; articles: unknown[] }

export const liveCatalogue = live as LiveFile | null;

/** Image URL by file stem (item code or article key), or undefined when the live folder has no such file. */
export const liveImage = (stem: string | null): string | undefined => (stem ? (liveImages as Record<string, string>)[stem] : undefined);
