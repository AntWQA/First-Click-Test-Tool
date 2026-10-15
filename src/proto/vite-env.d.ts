/// <reference types="vite/client" />

declare module "virtual:live-catalogue" {
  export const liveCatalogue: { products: unknown[]; articles: unknown[] } | null;
  export const liveImages: Record<string, string>;
}
