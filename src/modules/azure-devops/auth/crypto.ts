import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptionKey = {
  id: string;
  bytes: Uint8Array;
};

const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

class SecretCryptoError extends Error {
  readonly code = 'SECRET_CRYPTO_FAILED';

  constructor() {
    super('Secret operation failed.');
    this.name = 'SecretCryptoError';
  }
}

function fail(): never {
  throw new SecretCryptoError();
}

function isByteArray(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) &&
    'BYTES_PER_ELEMENT' in value &&
    value.BYTES_PER_ELEMENT === 1
  );
}

function validateKey(key: unknown): asserts key is EncryptionKey {
  if (!key || typeof key !== 'object') fail();

  const candidate = key as Partial<EncryptionKey>;
  if (
    typeof candidate.id !== 'string' ||
    !KEY_ID_PATTERN.test(candidate.id) ||
    !isByteArray(candidate.bytes) ||
    candidate.bytes.byteLength !== KEY_BYTES
  ) {
    fail();
  }
}

function decodeBase64url(value: string): Buffer {
  if (!BASE64URL_PATTERN.test(value)) fail();

  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) fail();
  return decoded;
}

function envelopeHeader(encodedKeyId: string): Buffer {
  return Buffer.from(`v1.${encodedKeyId}`, 'ascii');
}

export function encryptSecret(plaintext: string, key: EncryptionKey): string {
  try {
    if (typeof plaintext !== 'string' || plaintext.length === 0) fail();
    validateKey(key);

    const iv = randomBytes(IV_BYTES);
    // Encoding keeps every approved key ID, including dotted IDs, in one segment.
    const encodedKeyId = Buffer.from(key.id, 'utf8').toString('base64url');
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key.bytes), iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    cipher.setAAD(envelopeHeader(encodedKeyId));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      'v1',
      encodedKeyId,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join('.');
  } catch {
    fail();
  }
}

export function decryptSecret(
  envelope: string,
  keys: readonly EncryptionKey[],
): string {
  try {
    if (typeof envelope !== 'string' || !Array.isArray(keys)) fail();

    const segments = envelope.split('.');
    if (segments.length !== 5) fail();

    const [version, encodedKeyId, encodedIv, encodedCiphertext, encodedTag] =
      segments;
    if (version !== 'v1') fail();

    const keyId = decodeBase64url(encodedKeyId ?? '').toString('utf8');
    if (!KEY_ID_PATTERN.test(keyId)) fail();

    const matchingKeys = keys.filter((key) => key?.id === keyId);
    if (matchingKeys.length !== 1) fail();
    const key = matchingKeys[0];
    validateKey(key);

    const iv = decodeBase64url(encodedIv ?? '');
    const ciphertext = decodeBase64url(encodedCiphertext ?? '');
    const tag = decodeBase64url(encodedTag ?? '');
    if (iv.byteLength !== IV_BYTES || tag.byteLength !== AUTH_TAG_BYTES) fail();

    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key.bytes),
      iv,
      { authTagLength: AUTH_TAG_BYTES },
    );
    decipher.setAAD(envelopeHeader(encodedKeyId ?? ''));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');

    if (plaintext.length === 0) fail();
    return plaintext;
  } catch {
    fail();
  }
}
