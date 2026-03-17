import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { supabaseAdmin } from "../lib/supabase";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    next();
    return;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    next();
    return;
  }

  const meta = user.user_metadata || {};
  const authUser: AuthUser = {
    id: user.id,
    email: user.email ?? null,
    firstName: meta.firstName ?? meta.first_name ?? null,
    lastName: meta.lastName ?? meta.last_name ?? null,
    profileImageUrl: meta.avatar_url ?? null,
    emailVerified: !!user.email_confirmed_at,
    role: meta.role ?? null,
  };

  req.user = authUser;

  try {
    await db
      .insert(usersTable)
      .values({
        id: user.id,
        email: user.email ?? null,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        role: authUser.role,
        emailVerified: authUser.emailVerified,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          email: user.email ?? null,
          firstName: authUser.firstName,
          lastName: authUser.lastName,
          role: authUser.role,
          emailVerified: authUser.emailVerified,
          updatedAt: new Date(),
        },
      });
  } catch {
  }

  next();
}
