export const UserRole = {
  OWNER : "OWNER",
  USER : "USER",
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];