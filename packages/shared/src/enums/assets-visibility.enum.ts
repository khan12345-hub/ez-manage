export const AssetVisibility = {
  PUBLIC : "PUBLIC",
  PRIVATE : "PRIVATE",
} as const;
export type AssetVisibility = typeof AssetVisibility[keyof typeof AssetVisibility];