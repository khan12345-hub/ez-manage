export const WorkspacePermission = {
  VIEW : "VIEW",

  UPDATE : "UPDATE",

  DELETE : "DELETE",

  CREATE_BOARD : "CREATE_BOARD",

  INVITE_MEMBERS : "INVITE_MEMBERS",

  REMOVE_MEMBERS : "REMOVE_MEMBERS",

  CHANGE_MEMBER_ROLE : "CHANGE_MEMBER_ROLE",

  MANAGE_SETTINGS : "MANAGE_SETTINGS",

  VIEW_ACTIVITY : "VIEW_ACTIVITY",

} as const
export type WorkspacePermission = typeof WorkspacePermission[keyof typeof WorkspacePermission];