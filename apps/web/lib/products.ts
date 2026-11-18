/*
 * Product names shown to people. Routes and code ids stay the same (/workspace, /work, /ceo, "boards" | "work").
 * Rename a product here and in the few marketing strings that spell it out.
 */
export const PRODUCT_NAME = {
  boards: "Accounts & Invoices",
  work: "Company Work",
  ceo: "Executive Hub",
  vault: "EZ Vault",
} as const;

/** short form for tight places (badges, rail tiles) */
export const PRODUCT_SHORT = {
  boards: "Accounts",
  work: "Work",
  ceo: "Executive",
  vault: "Vault",
} as const;

export const productName = (source: "boards" | "work") => PRODUCT_NAME[source];
