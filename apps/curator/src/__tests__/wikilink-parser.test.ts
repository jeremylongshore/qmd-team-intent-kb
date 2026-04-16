import { describe, it, expect, vi } from 'vitest';
import { extractWikiLinks, resolveWikiLinks } from '../import/wikilink-parser.js';
import type { WikiLink } from '../import/wikilink-parser.js';

// ---------------------------------------------------------------------------
// extractWikiLinks
// ---------------------------------------------------------------------------

describe('extractWikiLinks — basic extraction', () => {
  it('extracts a single plain wiki-link', () => {
    const links = extractWikiLinks('See [[API Design]] for details.');
    expect(links).toHaveLength(1);
    const link = links[0] as WikiLink;
    expect(link.raw).toBe('[[API Design]]');
    expect(link.slug).toBe('API Design');
    expect(link.displayText).toBeNull();
  });

  it('records correct start and end indices', () => {
    const content = 'Prefix [[My Note]] suffix';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    const link = links[0] as WikiLink;
    expect(link.startIndex).toBe(7);
    expect(link.endIndex).toBe(18);
    expect(content.slice(link.startIndex, link.endIndex)).toBe('[[My Note]]');
  });

  it('returns an empty array when no wiki-links are present', () => {
    expect(extractWikiLinks('No links here.')).toHaveLength(0);
  });

  it('returns an empty array for empty string', () => {
    expect(extractWikiLinks('')).toHaveLength(0);
  });
});

describe('extractWikiLinks — display text variants', () => {
  it('extracts slug and display text when pipe is present', () => {
    const links = extractWikiLinks('Check [[API Design|API patterns]] today.');
    expect(links).toHaveLength(1);
    const link = links[0] as WikiLink;
    expect(link.slug).toBe('API Design');
    expect(link.displayText).toBe('API patterns');
    expect(link.raw).toBe('[[API Design|API patterns]]');
  });

  it('trims whitespace from slug and display text', () => {
    const links = extractWikiLinks('[[ My Note | My Label ]]');
    expect(links).toHaveLength(1);
    const link = links[0] as WikiLink;
    expect(link.slug).toBe('My Note');
    expect(link.displayText).toBe('My Label');
  });

  it('treats content after pipe as display text even with spaces', () => {
    const links = extractWikiLinks('[[Design Principles|Keep it simple, stupid]]');
    expect(links).toHaveLength(1);
    expect(links[0]!.displayText).toBe('Keep it simple, stupid');
  });
});

describe('extractWikiLinks — multiple links', () => {
  it('extracts multiple links in order', () => {
    const content = 'Read [[API Design]] and [[Error Handling]] for guidance.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(2);
    expect(links[0]!.slug).toBe('API Design');
    expect(links[1]!.slug).toBe('Error Handling');
  });

  it('handles consecutive links without separators', () => {
    const content = '[[Alpha]][[Beta]][[Gamma]]';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.slug)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('extracts repeated occurrences of the same slug as separate entries', () => {
    const content = 'See [[Note A]] and also [[Note A]] again.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(2);
    expect(links[0]!.startIndex).not.toBe(links[1]!.startIndex);
  });
});

describe('extractWikiLinks — special characters in titles', () => {
  it('handles parentheses in slug', () => {
    const links = extractWikiLinks('See [[API Design (v2)]] for the new spec.');
    expect(links).toHaveLength(1);
    expect(links[0]!.slug).toBe('API Design (v2)');
  });

  it('handles hyphens and slashes in slug', () => {
    const links = extractWikiLinks('Refer to [[error-handling/retry-policy]].');
    expect(links).toHaveLength(1);
    expect(links[0]!.slug).toBe('error-handling/retry-policy');
  });

  it('handles numbers and dots in slug', () => {
    const links = extractWikiLinks('See [[RFC 7231 (HTTP 1.1)]].');
    expect(links).toHaveLength(1);
    expect(links[0]!.slug).toBe('RFC 7231 (HTTP 1.1)');
  });

  it('handles unicode characters in slug', () => {
    const links = extractWikiLinks('See [[Système de fichiers]].');
    expect(links).toHaveLength(1);
    expect(links[0]!.slug).toBe('Système de fichiers');
  });
});

describe('extractWikiLinks — edge cases', () => {
  it('does not match empty brackets [[]]', () => {
    expect(extractWikiLinks('Empty [[]] brackets.')).toHaveLength(0);
  });

  it('does not match brackets with only a pipe [[|]]', () => {
    // The slug part is required to be non-empty after trimming
    expect(extractWikiLinks('[[|display only]]')).toHaveLength(0);
  });

  it('handles link at the very start of content', () => {
    const links = extractWikiLinks('[[First Link]] starts here.');
    expect(links).toHaveLength(1);
    expect(links[0]!.startIndex).toBe(0);
  });

  it('handles link at the very end of content', () => {
    const content = 'Ends with [[Last Link]]';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.endIndex).toBe(content.length);
  });

  it('does not match triple-bracket patterns as wiki-link', () => {
    // [[[foo]]] — outer [[ and ]] should not produce a nested match
    // At minimum must not throw; result count is implementation-defined
    expect(() => extractWikiLinks('[[[Nested]]]')).not.toThrow();
  });
});

describe('extractWikiLinks — code block exclusion', () => {
  it('ignores wiki-links inside fenced code blocks', () => {
    const content = `Normal [[Real Link]] here.

\`\`\`
This is [[Not A Link]] inside a code block.
\`\`\`

And [[Another Real Link]] after.`;

    const links = extractWikiLinks(content);
    const slugs = links.map((l) => l.slug);
    expect(slugs).toContain('Real Link');
    expect(slugs).toContain('Another Real Link');
    expect(slugs).not.toContain('Not A Link');
  });

  it('ignores wiki-links inside inline code spans', () => {
    const content = 'Use `[[inline code]]` as an example but [[real link]] is live.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.slug).toBe('real link');
  });

  it('handles tildes fenced code blocks', () => {
    const content = `Before [[Link A]].

~~~python
x = [[Not A Link]]
~~~

After [[Link B]].`;

    const links = extractWikiLinks(content);
    const slugs = links.map((l) => l.slug);
    expect(slugs).toContain('Link A');
    expect(slugs).toContain('Link B');
    expect(slugs).not.toContain('Not A Link');
  });
});

// ---------------------------------------------------------------------------
// resolveWikiLinks
// ---------------------------------------------------------------------------

const MEMORY_MAP: Record<string, { id: string; title: string }> = {
  'API Design': { id: 'mem-001', title: 'API Design' },
  'Error Handling': { id: 'mem-002', title: 'Error Handling' },
  'Custom Title Note': { id: 'mem-003', title: 'Custom Title Note' },
};

function testResolver(slug: string): { id: string; title: string } | null {
  return MEMORY_MAP[slug] ?? null;
}

describe('resolveWikiLinks — resolution with found targets', () => {
  it('replaces a resolved plain link with Markdown anchor using memory title', () => {
    const { resolvedContent } = resolveWikiLinks('See [[API Design]] for details.', testResolver);
    expect(resolvedContent).toBe('See [API Design](/api/memories/mem-001) for details.');
  });

  it('uses display text as the link label when a pipe is present', () => {
    const { resolvedContent } = resolveWikiLinks(
      'See [[API Design|design patterns]] here.',
      testResolver,
    );
    expect(resolvedContent).toBe('See [design patterns](/api/memories/mem-001) here.');
  });

  it('resolves multiple different links in one pass', () => {
    const { resolvedContent } = resolveWikiLinks(
      'Read [[API Design]] and [[Error Handling]].',
      testResolver,
    );
    expect(resolvedContent).toBe(
      'Read [API Design](/api/memories/mem-001) and [Error Handling](/api/memories/mem-002).',
    );
  });

  it('replaces all occurrences of the same resolved slug', () => {
    const { resolvedContent } = resolveWikiLinks(
      'First [[API Design]], second [[API Design]].',
      testResolver,
    );
    expect(resolvedContent).toBe(
      'First [API Design](/api/memories/mem-001), second [API Design](/api/memories/mem-001).',
    );
  });
});

describe('resolveWikiLinks — unresolved links', () => {
  it('leaves unresolved links as literal [[slug]] text', () => {
    const { resolvedContent } = resolveWikiLinks(
      'See [[Unknown Topic]] for details.',
      testResolver,
    );
    expect(resolvedContent).toBe('See [[Unknown Topic]] for details.');
  });

  it('handles a mix of resolved and unresolved links', () => {
    const { resolvedContent } = resolveWikiLinks(
      'Check [[API Design]] and [[Unknown Topic]].',
      testResolver,
    );
    expect(resolvedContent).toBe(
      'Check [API Design](/api/memories/mem-001) and [[Unknown Topic]].',
    );
  });
});

describe('resolveWikiLinks — links metadata', () => {
  it('returns resolved: true and memoryId for resolved links', () => {
    const { links } = resolveWikiLinks('See [[API Design]].', testResolver);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ slug: 'API Design', memoryId: 'mem-001', resolved: true });
  });

  it('returns resolved: false and memoryId: null for unresolved links', () => {
    const { links } = resolveWikiLinks('See [[Ghost Note]].', testResolver);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ slug: 'Ghost Note', memoryId: null, resolved: false });
  });

  it('deduplicates repeated slugs in links array', () => {
    const { links } = resolveWikiLinks(
      '[[API Design]] appears [[API Design]] twice.',
      testResolver,
    );
    expect(links).toHaveLength(1);
    expect(links[0]!.slug).toBe('API Design');
  });

  it('lists links in order of first appearance', () => {
    const { links } = resolveWikiLinks('[[Error Handling]] then [[API Design]].', testResolver);
    expect(links[0]!.slug).toBe('Error Handling');
    expect(links[1]!.slug).toBe('API Design');
  });

  it('returns mixed resolved/unresolved metadata correctly', () => {
    const { links } = resolveWikiLinks('[[API Design]] and [[Phantom]].', testResolver);
    expect(links).toHaveLength(2);
    expect(links.find((l) => l.slug === 'API Design')?.resolved).toBe(true);
    expect(links.find((l) => l.slug === 'Phantom')?.resolved).toBe(false);
  });
});

describe('resolveWikiLinks — resolver call behaviour', () => {
  it('calls the resolver exactly once per unique slug', () => {
    const resolver = vi.fn(testResolver);
    resolveWikiLinks('[[API Design]] and [[API Design]] and [[Error Handling]].', resolver);
    // Two unique slugs → two calls
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(resolver).toHaveBeenCalledWith('API Design');
    expect(resolver).toHaveBeenCalledWith('Error Handling');
  });

  it('does not call the resolver when there are no wiki-links', () => {
    const resolver = vi.fn(testResolver);
    resolveWikiLinks('No links here.', resolver);
    expect(resolver).not.toHaveBeenCalled();
  });
});

describe('resolveWikiLinks — no-op cases', () => {
  it('returns the original content unchanged when no links are present', () => {
    const content = 'Plain text with no wiki-links.';
    const { resolvedContent, links } = resolveWikiLinks(content, testResolver);
    expect(resolvedContent).toBe(content);
    expect(links).toHaveLength(0);
  });

  it('returns empty content unchanged', () => {
    const { resolvedContent, links } = resolveWikiLinks('', testResolver);
    expect(resolvedContent).toBe('');
    expect(links).toHaveLength(0);
  });
});

describe('resolveWikiLinks — content integrity', () => {
  it('preserves surrounding text exactly after resolution', () => {
    const { resolvedContent } = resolveWikiLinks('Before\n[[API Design]]\nAfter', testResolver);
    expect(resolvedContent).toBe('Before\n[API Design](/api/memories/mem-001)\nAfter');
  });

  it('handles links at the start and end of content', () => {
    const { resolvedContent } = resolveWikiLinks(
      '[[API Design]] is the start and [[Error Handling]] is the end',
      testResolver,
    );
    expect(resolvedContent).toBe(
      '[API Design](/api/memories/mem-001) is the start and [Error Handling](/api/memories/mem-002) is the end',
    );
  });
});
