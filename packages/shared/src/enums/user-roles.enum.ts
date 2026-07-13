export const UserRole = {
  OWNER : "OWNER",
  ADMIN : "ADMIN",
  MEMBER : "MEMBER",
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];