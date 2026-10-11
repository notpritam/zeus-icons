export type IconNode = readonly [string, Record<string, string | number>];
export interface IconEntry {
  id: string;
  name: string;
  exportName: string;
  categories: string[];
  sourceUrl: string;
  referenceUrl: string;
  localUrl: string;
  freeAvailable?: boolean;
}
export interface Category { id: string; name: string; expectedCount: number; actualCount: number; sourceUrl: string; }
export interface Catalog {
  generatedAt: string;
  packageVersion: string;
  sourceUrl: string;
  icons: IconEntry[];
  categories: Category[];
  coverage: { websiteCount: number; packageCount: number; mappedCount: number; missingFromPackage: string[]; missingFromWebsite: string[]; categoryMismatches: string[]; };
}
export interface SvgSettings { strokeWidth: number; scale: number; x: number; y: number; }
export interface Candidate { svg: string; filename: string; importedAt: string; }
export interface SavedIcon { preview?: { size: number; color: string }; referenceStroke?: number; imageReference?: { url: string; name: string }; candidate?: Candidate; settings: SvgSettings; reviewed: boolean; }
export interface ProjectState { version: 1; icons: Record<string, SavedIcon>; }
export const DEFAULT_SETTINGS: SvgSettings = { strokeWidth: 1.5, scale: 1, x: 0, y: 0 };
