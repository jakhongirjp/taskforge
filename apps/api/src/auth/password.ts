import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// OWASP-recommended scrypt parameters (N=2^17, r=8, p=1) need ~128 MiB.
// Tests lower the cost through the environment to stay fast.
const N = Number(process.env.SCRYPT_N ?? 2 ** 17);
const params: ScryptOptions = { N, r: 8, p: 1, maxmem: 256 * N * 8 };
const KEY_LEN = 32;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Returns a self-describing hash: scrypt$N$r$p$salt$key (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !n || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const opts = { N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * Number(n) * Number(r) };
  const actual = await derive(password, Buffer.from(salt, "base64url"), opts);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A valid hash of a random value, used to equalize timing for unknown users. */
export const DUMMY_HASH_PROMISE = hashPassword(randomBytes(16).toString("hex"));
