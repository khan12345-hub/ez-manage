import "express-session";
import { SessionUser } from "src/auth/types/session-user.type";

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}