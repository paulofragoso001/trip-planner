import "server-only";

import crypto from "node:crypto";

const algorithm = "aes-256-gcm";

export type EncryptedCalendarToken = {
  ciphertext: string;
  keyId: string;
  nonce: string;
};

export function encryptCalendarToken(token: string) {
  const encrypted = encryptCalendarTokenRecord(token);
  return ["v1", encrypted.nonce, encrypted.keyId, encrypted.ciphertext].join(".");
}

export function encryptCalendarTokenRecord(token: string): EncryptedCalendarToken {
  const key = getCalendarTokenKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: [authTag.toString("base64url"), encrypted.toString("base64url")].join("."),
    keyId: process.env.CALENDAR_TOKEN_KEY_ID || "default",
    nonce: iv.toString("base64url")
  };
}

export function decryptCalendarToken(encryptedToken: string) {
  const [version, nonce, keyId, ...ciphertextParts] = encryptedToken.split(".");
  const ciphertext = ciphertextParts.join(".");

  if (version !== "v1" || !nonce || !keyId || !ciphertext) {
    throw new Error("Unsupported calendar token format.");
  }

  return decryptCalendarTokenRecord({
    ciphertext,
    keyId,
    nonce
  });
}

export function decryptCalendarTokenRecord(encryptedToken: EncryptedCalendarToken) {
  const [authTag, encrypted] = encryptedToken.ciphertext.split(".");

  if (!authTag || !encrypted) {
    throw new Error("Unsupported calendar token ciphertext format.");
  }

  const decipher = crypto.createDecipheriv(
    algorithm,
    getCalendarTokenKey(),
    Buffer.from(encryptedToken.nonce, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function hasCalendarTokenEncryptionKey() {
  return Boolean(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY);
}

function getCalendarTokenKey() {
  const secret = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;

  if (!secret || secret.length < 32) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY must be set to at least 32 characters.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}
