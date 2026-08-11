import { randomBytes } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  decryptSecret,
  encryptSecret,
  type EncryptionKey,
} from '@/modules/azure-devops/auth/crypto';

const key = (id: string, fill: number): EncryptionKey => ({
  id,
  bytes: new Uint8Array(Buffer.alloc(32, fill)),
});

const replaceSegment = (envelope: string, index: number, value: string) => {
  const segments = envelope.split('.');
  segments[index] = value;
  return segments.join('.');
};

describe('Azure DevOps secret encryption', () => {
  it('round trips UTF-8 plaintext through a versioned AES-GCM envelope', () => {
    const encryptionKey = key('current-key_1', 1);
    const envelope = encryptSecret('sensitive-token-✓', encryptionKey);
    const encodedKeyId = Buffer.from(encryptionKey.id, 'utf8').toString(
      'base64url',
    );

    expect(envelope).toMatch(
      new RegExp(
        `^v1\\.${encodedKeyId}\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$`,
      ),
    );
    expect(decryptSecret(envelope, [encryptionKey])).toBe('sensitive-token-✓');
  });

  it('encodes a dotted key id into one canonical envelope segment', () => {
    const encryptionKey = key('azure.devops.key-1', 12);
    const envelope = encryptSecret('secret', encryptionKey);

    expect(envelope.split('.')).toHaveLength(5);
    expect(envelope.split('.')[1]).toBe(
      Buffer.from(encryptionKey.id, 'utf8').toString('base64url'),
    );
    expect(decryptSecret(envelope, [encryptionKey])).toBe('secret');
  });

  it('uses a fresh 96-bit IV for repeated plaintext', () => {
    const encryptionKey = key('current', 2);
    const first = encryptSecret('same-secret', encryptionKey);
    const second = encryptSecret('same-secret', encryptionKey);

    expect(first).not.toBe(second);
    expect(first.split('.')[2]).not.toBe(second.split('.')[2]);
    expect(Buffer.from(first.split('.')[2]!, 'base64url')).toHaveLength(12);
    expect(Buffer.from(second.split('.')[2]!, 'base64url')).toHaveLength(12);
  });

  it('accepts Node Buffer key bytes as a Uint8Array implementation', () => {
    const encryptionKey = { id: 'buffer-key', bytes: randomBytes(32) };
    const envelope = encryptSecret('secret', encryptionKey);

    expect(decryptSecret(envelope, [encryptionKey])).toBe('secret');
  });

  it('rejects empty plaintext and invalid encryption keys', () => {
    expect(() => encryptSecret('', key('current', 3))).toThrow();
    expect(() =>
      encryptSecret('secret', { id: '.invalid', bytes: randomBytes(32) }),
    ).toThrow();
    expect(() =>
      encryptSecret('secret', { id: 'current', bytes: randomBytes(31) }),
    ).toThrow();
    expect(() =>
      encryptSecret('secret', { id: 'current', bytes: randomBytes(33) }),
    ).toThrow();
  });

  it.each([
    [
      'unsupported version',
      'v2.current.AAAAAAAAAAAAAAAA.YQ.AAAAAAAAAAAAAAAAAAAAAA',
    ],
    ['too few segments', 'v1.current.AAAAAAAAAAAAAAAA.YQ'],
    [
      'too many segments',
      'v1.current.AAAAAAAAAAAAAAAA.YQ.AAAAAAAAAAAAAAAAAAAAAA.extra',
    ],
    [
      'invalid key id base64url',
      'v1.***.AAAAAAAAAAAAAAAA.YQ.AAAAAAAAAAAAAAAAAAAAAA',
    ],
    [
      'noncanonical key id base64url',
      'v1.A.AAAAAAAAAAAAAAAA.YQ.AAAAAAAAAAAAAAAAAAAAAA',
    ],
    [
      'decoded invalid key id',
      `v1.${Buffer.from('.invalid', 'utf8').toString('base64url')}.AAAAAAAAAAAAAAAA.YQ.AAAAAAAAAAAAAAAAAAAAAA`,
    ],
    ['invalid IV base64url', 'v1.current.********.YQ.AAAAAAAAAAAAAAAAAAAAAA'],
    [
      'padded IV base64url',
      'v1.current.AAAAAAAAAAAAAAAA=.YQ.AAAAAAAAAAAAAAAAAAAAAA',
    ],
    ['noncanonical IV base64url', 'v1.current.A.YQ.AAAAAAAAAAAAAAAAAAAAAA'],
    ['short IV', 'v1.current.AAAAAAAAAAAAAAA.YQ.AAAAAAAAAAAAAAAAAAAAAA'],
    [
      'invalid ciphertext base64url',
      'v1.current.AAAAAAAAAAAAAAAA.***.AAAAAAAAAAAAAAAAAAAAAA',
    ],
    ['empty ciphertext', 'v1.current.AAAAAAAAAAAAAAAA..AAAAAAAAAAAAAAAAAAAAAA'],
    ['invalid tag base64url', 'v1.current.AAAAAAAAAAAAAAAA.YQ.***'],
    ['short tag', 'v1.current.AAAAAAAAAAAAAAAA.YQ.AAAAAAAAAAAAAAAAAAAA'],
  ])('rejects a malformed envelope with %s', (_name, envelope) => {
    expect(() => decryptSecret(envelope, [key('current', 4)])).toThrow();
  });

  it('rejects an unknown key id without trying another key', () => {
    const envelope = encryptSecret('secret', key('old', 5));

    expect(() => decryptSecret(envelope, [key('current', 5)])).toThrow();
  });

  it('rejects relabeling an envelope to another id with identical key bytes', () => {
    const originalKey = key('key-a', 13);
    const relabeledKey = key('key-b', 13);
    const envelope = encryptSecret('secret', originalKey);
    const relabeledEnvelope = replaceSegment(
      envelope,
      1,
      Buffer.from(relabeledKey.id, 'utf8').toString('base64url'),
    );

    expect(() => decryptSecret(relabeledEnvelope, [relabeledKey])).toThrow();
  });

  it('rejects a wrong selected key, tampered ciphertext, and tampered tag', () => {
    const envelope = encryptSecret('secret', key('current', 6));
    const ciphertext = Buffer.from(envelope.split('.')[3]!, 'base64url');
    const tag = Buffer.from(envelope.split('.')[4]!, 'base64url');
    ciphertext[0] ^= 1;
    tag[0] ^= 1;

    expect(() => decryptSecret(envelope, [key('current', 7)])).toThrow();
    expect(() =>
      decryptSecret(
        replaceSegment(envelope, 3, ciphertext.toString('base64url')),
        [key('current', 6)],
      ),
    ).toThrow();
    expect(() =>
      decryptSecret(replaceSegment(envelope, 4, tag.toString('base64url')), [
        key('current', 6),
      ]),
    ).toThrow();
  });

  it('rejects a selected non-256-bit decryption key', () => {
    const envelope = encryptSecret('secret', key('current', 8));

    expect(() =>
      decryptSecret(envelope, [
        { id: 'current', bytes: new Uint8Array(Buffer.alloc(31, 8)) },
      ]),
    ).toThrow();
  });

  it('does not expose plaintext, envelopes, key bytes, or provider details', () => {
    const plaintext = 'NEVER-LEAK-THIS-PLAINTEXT';
    const encryptionKey = key('current', 9);
    const envelope = encryptSecret(plaintext, encryptionKey);
    const ciphertext = Buffer.from(envelope.split('.')[3]!, 'base64url');
    ciphertext[0] ^= 1;
    const tampered = replaceSegment(
      envelope,
      3,
      ciphertext.toString('base64url'),
    );

    let thrown: unknown;
    try {
      decryptSecret(tampered, [encryptionKey]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const serialized = `${String(thrown)} ${JSON.stringify(thrown)}`;
    expect(serialized).not.toContain(plaintext);
    expect(serialized).not.toContain(tampered);
    expect(serialized).not.toContain(
      Buffer.from(encryptionKey.bytes).toString('hex'),
    );
    expect(serialized.toLowerCase()).not.toMatch(
      /aes|gcm|cipher|openssl|auth tag/,
    );
  });

  it('decrypts envelopes across key-ring versions using only the selected id', () => {
    const oldKey = key('old', 10);
    const newKey = key('new', 11);
    const oldEnvelope = encryptSecret('old-secret', oldKey);
    const newEnvelope = encryptSecret('new-secret', newKey);

    expect(decryptSecret(oldEnvelope, [newKey, oldKey])).toBe('old-secret');
    expect(decryptSecret(newEnvelope, [newKey, oldKey])).toBe('new-secret');
  });
});
