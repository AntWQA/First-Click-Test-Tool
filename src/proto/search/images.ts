import abode from "./data/images/abode.png";
import capsules from "./data/images/capsules.png";
import eoMega from "./data/images/eo-mega.png";
import pbRestore from "./data/images/pb-restore.png";
import shelf from "./data/images/shelf.png";
import vmgPlus from "./data/images/vmg-plus.png";
import { liveImage } from "./data/liveCatalogue";

/** Dummy imagery exported from the Figma Search designs (product shots only, reused across the dummy catalogue). */
const images: Record<string, string> = { abode, capsules, "eo-mega": eoMega, "pb-restore": pbRestore, shelf, "vmg-plus": vmgPlus };

export const imageFor = (key: string | null): string => (key ? liveImage(key) ?? images[key] : undefined) ?? eoMega;
