import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import {
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  getSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";
import { sendVerificationEmail } from "../lib/email";

const SignupBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ResendVerificationBody = z.object({
  email: z.string().email(),
});

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function buildSessionUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    emailVerified: user.emailVerified,
    role: user.role,
  };
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as string | null,
    emailVerified: true,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { ...userData, updatedAt: new Date() },
    })
    .returning();
  return user;
}

router.post("/auth/signup", async (req: Request, res: Response): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input. Password must be at least 8 characters." });
    return;
  }

  const { firstName, lastName, email, password, role } = parsed.data;

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = generateVerificationToken();
  const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TTL_MS);

  let user: typeof usersTable.$inferSelect;
  try {
    [user] = await db
      .insert(usersTable)
      .values({ firstName, lastName, email, passwordHash, role, verificationToken, verificationTokenExpiry, emailVerified: false })
      .returning();
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    throw err;
  }

  try {
    await sendVerificationEmail(email, firstName, verificationToken, getOrigin(req));
  } catch (err) {
    console.error("Failed to send verification email:", err);
  }

  res.status(201).json({ needsVerification: true, email: user.email });
});

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input." });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  if (!user.emailVerified) {
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TTL_MS);
    await db.update(usersTable).set({ verificationToken, verificationTokenExpiry }).where(eq(usersTable.id, user.id));
    try {
      await sendVerificationEmail(email, user.firstName ?? "there", verificationToken, getOrigin(req));
    } catch (err) {
      console.error("Failed to resend verification email:", err);
    }
    res.status(403).json({ needsVerification: true, email });
    return;
  }

  const sessionData: SessionData = { user: buildSessionUser(user) };
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ user: sessionData.user });
});

router.get("/auth/verify-email", async (req: Request, res: Response): Promise<void> => {
  const token = req.query.token as string | undefined;
  const origin = getOrigin(req);

  if (!token) {
    res.redirect(`${origin}/login?error=invalid_token`);
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.verificationToken, token));

  if (!user) {
    res.redirect(`${origin}/login?error=invalid_token`);
    return;
  }

  if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
    res.redirect(`${origin}/login?error=token_expired`);
    return;
  }

  await db.update(usersTable).set({
    emailVerified: true,
    verificationToken: null,
    verificationTokenExpiry: null,
  }).where(eq(usersTable.id, user.id));

  const sessionData: SessionData = { user: buildSessionUser({ ...user, emailVerified: true }) };
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(`${origin}/dashboard`);
});

router.post("/auth/resend-verification", async (req: Request, res: Response): Promise<void> => {
  const parsed = ResendVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input." });
    return;
  }

  const { email } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || user.emailVerified) {
    res.json({ ok: true });
    return;
  }

  const verificationToken = generateVerificationToken();
  const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TTL_MS);
  await db.update(usersTable).set({ verificationToken, verificationTokenExpiry }).where(eq(usersTable.id, user.id));

  try {
    await sendVerificationEmail(email, user.firstName ?? "there", verificationToken, getOrigin(req));
  } catch (err) {
    console.error("Failed to resend verification email:", err);
  }

  res.json({ ok: true });
});

router.get("/auth/user", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.json({ user: null });
    return;
  }
  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (!freshUser) {
    res.json({ user: null });
    return;
  }
  res.json({ user: buildSessionUser(freshUser) });
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const returnTo = getSafeReturnTo(req.query.returnTo);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);
  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);
  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);
  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: buildSessionUser(dbUser),
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const origin = getOrigin(req);
  const sid = getSessionId(req);
  const session = sid ? await getSession(sid) : null;
  await clearSession(res, sid);

  if (session?.access_token) {
    try {
      const config = await getOidcConfig();
      const endSessionUrl = oidc.buildEndSessionUrl(config, {
        client_id: process.env.REPL_ID!,
        post_logout_redirect_uri: origin,
      });
      res.redirect(endSessionUrl.href);
      return;
    } catch {}
  }

  res.redirect(origin);
});

router.post("/mobile-auth/token-exchange", async (req: Request, res: Response) => {
  const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required parameters" });
    return;
  }

  const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

  try {
    const config = await getOidcConfig();
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);
    callbackUrl.searchParams.set("iss", ISSUER_URL);

    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: code_verifier,
      expectedNonce: nonce ?? undefined,
      expectedState: state,
      idTokenExpected: true,
    });

    const claims = tokens.claims();
    if (!claims) {
      res.status(401).json({ error: "No claims in ID token" });
      return;
    }

    const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);
    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: buildSessionUser(dbUser),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
    };

    const sid = await createSession(sessionData);
    res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
  } catch (err) {
    console.error("Mobile token exchange error:", err);
    res.status(500).json({ error: "Token exchange failed" });
  }
});

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) await deleteSession(sid);
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
