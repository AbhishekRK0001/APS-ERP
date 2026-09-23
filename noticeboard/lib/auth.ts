import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from .env");
}

const secret = new TextEncoder().encode(JWT_SECRET);

export type SessionUser = {
  userId: string;
  name: string;
  email: string;
  role: "STUDENT" | "TEACHER" | "HOD" | "PRINCIPAL" | "ADMIN";
};

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);

    if (
      !payload.sub ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role as SessionUser["role"],
    };
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("college_session")?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}
