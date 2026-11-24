import { SignJWT, jwtVerify } from "jose";
import { unauthorized } from "../errors.js";

const ISSUER = "taskforge";
const AUDIENCE = "taskforge-api";

export interface TokenService {
  sign(userId: string): Promise<string>;
  verify(token: string): Promise<{ userId: string }>;
}

export function createTokenService(secret: string, ttlSeconds: number): TokenService {
  if (secret.length < 32) throw new Error("JWT secret must be at least 32 characters");
  const key = new TextEncoder().encode(secret);
  return {
    sign: (userId) =>
      new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${ttlSeconds}s`)
        .sign(key),
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
        if (!payload.sub) throw new Error("missing subject");
        return { userId: payload.sub };
      } catch {
        throw unauthorized("Invalid or expired token");
      }
    },
  };
}
