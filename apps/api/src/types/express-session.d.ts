import "express-session";
import { SessionUser } from "src/auth/types/session-user.type";
import type { MfaPending } from "src/auth/mfa/mfa.service";

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
    /** set after the password step when a second factor is still required */
    mfaPending?: MfaPending;
  }
}