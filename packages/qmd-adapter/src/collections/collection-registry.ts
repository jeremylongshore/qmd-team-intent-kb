/** Definition of a known collection */
export interface CollectionDef {
  name: string;
  description: string;
  includeInDefaultSearch: boolean;
}

/** The 5 known collections with their default search inclusion */
export const KNOWN_COLLECTIONS: CollectionDef[] = [
  {
    name: 'kb-curated',
    description: 'Curated, governance-approved team knowledge',
    includeInDefaultSearch: true,
  },
  {
    name: 'kb-decisions',
    description: 'Architectural and design decisions',
    includeInDefaultSearch: true,
  },
  {
    name: 'kb-guides',
    description: 'How-to guides and onboarding documentation',
    includeInDefaultSearch: true,
  },
  {
    name: 'kb-inbox',
    description: 'Unreviewed memory candidates awaiting governance',
    includeInDefaultSearch: false,
  },
  {
    name: 'kb-archive',
    description: 'Deprecated, superseded, or archived memories',
    includeInDefaultSearch: false,
  },
];

/** Get collection names included in default (curated) search */
export function getDefaultSearchCollections(): string[] {
  return KNOWN_COLLECTIONS.filter((c) => c.includeInDefaultSearch).map((c) => c.name);
}

/** Get all known collection names */
export function getAllCollectionNames(): string[] {
  return KNOWN_COLLECTIONS.map((c) => c.name);
}

/** Check if a collection name is known */
export function isKnownCollection(name: string): boolean {
  return KNOWN_COLLECTIONS.some((c) => c.name === name);
}

/** Check if a collection is included in default search */
export function isDefaultSearchCollection(name: string): boolean {
  return KNOWN_COLLECTIONS.some((c) => c.name === name && c.includeInDefaultSearch);
}
