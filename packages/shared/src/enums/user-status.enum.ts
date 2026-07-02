export const UserStatus = {
  ACTIVE : "ACTIVE",
  INACTIVE : "INACTIVE",
  INVITED : "INVITED",
} as const;
export type USerStatus = typeof UserStatus[keyof typeof UserStatus];