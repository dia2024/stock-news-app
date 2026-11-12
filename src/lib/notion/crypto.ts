import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// 노션 토큰과 OAuth 쿠키를 AES-256-GCM으로 암호화한다.
// 형식: v1.<iv>.<tag>.<암호문> (각 부분은 base64url)
// node:crypto를 쓰므로 브라우저 번들에 들어갈 수 없다. scripts/에서도 쓰려고 "server-only"는 두지 않는다.

const VERSION = "v1";

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.");
  // 32바이트 키를 base64(url) 또는 64자리 hex로 받는다.
  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64url");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY는 32바이트(base64 43~44자 또는 hex 64자)여야 합니다.");
  }
  return key;
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, data]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

/** 형식이 틀렸거나 키가 다르거나 변조되었으면 예외를 던진다. */
export function decrypt(value: string) {
  const [version, iv, tag, data] = value.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) {
    throw new Error("암호문 형식이 올바르지 않습니다.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
