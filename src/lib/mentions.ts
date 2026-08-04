export type Mentionable = { userId: string; displayName: string };

/**
 * Matches literal "@Display Name" substrings against a known set of org
 * members — not a generic @word regex, since display names can contain
 * spaces. Longest name first so "Eshan Employee" doesn't get shadowed by
 * a shorter name that happens to be a prefix of it.
 */
function sortedByNameLength(members: Mentionable[]): Mentionable[] {
  return [...members].sort(
    (a, b) => b.displayName.length - a.displayName.length,
  );
}

export function extractMentionedUserIds(
  body: string,
  members: Mentionable[],
): string[] {
  const lowerBody = body.toLowerCase();
  const matched = new Set<string>();

  for (const member of sortedByNameLength(members)) {
    const needle = `@${member.displayName}`.toLowerCase();
    if (lowerBody.includes(needle)) {
      matched.add(member.userId);
    }
  }

  return Array.from(matched);
}

export type MentionToken =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; userId: string };

/** Tokenizes a comment body into plain-text and @mention segments for rendering. */
export function tokenizeMentions(
  body: string,
  members: Mentionable[],
): MentionToken[] {
  const candidates = sortedByNameLength(members).map((member) => ({
    member,
    needle: `@${member.displayName}`,
  }));

  const tokens: MentionToken[] = [];
  let cursor = 0;

  while (cursor < body.length) {
    let matchedAt = -1;
    let matchedCandidate: (typeof candidates)[number] | null = null;

    for (const candidate of candidates) {
      const index = body
        .toLowerCase()
        .indexOf(candidate.needle.toLowerCase(), cursor);
      if (index !== -1 && (matchedAt === -1 || index < matchedAt)) {
        matchedAt = index;
        matchedCandidate = candidate;
      }
    }

    if (matchedAt === -1 || !matchedCandidate) {
      tokens.push({ type: 'text', value: body.slice(cursor) });
      break;
    }

    if (matchedAt > cursor) {
      tokens.push({ type: 'text', value: body.slice(cursor, matchedAt) });
    }

    tokens.push({
      type: 'mention',
      value: matchedCandidate.needle,
      userId: matchedCandidate.member.userId,
    });
    cursor = matchedAt + matchedCandidate.needle.length;
  }

  return tokens;
}
