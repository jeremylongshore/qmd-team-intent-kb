# npm Publishing Strategy

> Defines which workspace packages are reusable libraries suitable for public npm registry publication, which are deliberately kept private, and the mechanical workflow for cutting a registry release. This is infrastructure configuration — it does not commit the project to publishing on any specific timeline.

---

## Publishable Packages

The following packages expose stable, externally reusable surfaces and carry `publishConfig.access = public`:

| Package                             | Rationale                                                                                                     | External Deps        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------- |
| `@qmd-team-intent-kb/schema`        | Zod domain model and lifecycle state machine — consumers need these types to integrate with the control plane | `zod`                |
| `@qmd-team-intent-kb/common`        | Result type, hashing, freshness scoring — primitives useful beyond this project                               | none (node builtins) |
| `@qmd-team-intent-kb/repo-resolver` | Generic git repo context + tenant derivation utility                                                          | `zod`, `common`      |

Each of these package.json files now declares:

- `publishConfig.access = "public"` (explicit, even though scoped packages on unscoped-public orgs default to this)
- `files: ["dist", "README.md"]` — ship compiled output and docs only, no sources or tests
- `main` and `types` pointing into `dist/`
- No `private: true` flag
- A minimal README.md at the package root

## Private (Non-publishable) Packages

The following packages are kept private (`private: true`) and will be skipped by `pnpm publish -r`:

| Package                              | Reason                                                                                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@qmd-team-intent-kb/store`          | Uses `better-sqlite3` native binding and exposes repository internals tightly coupled to our schema                                                                                                              |
| `@qmd-team-intent-kb/qmd-adapter`    | Thin wrapper around the local qmd CLI; operational glue, not a reusable library                                                                                                                                  |
| `@qmd-team-intent-kb/claude-runtime` | Session capture and spool paths are tightly coupled to internal filesystem conventions                                                                                                                           |
| `@qmd-team-intent-kb/test-fixtures`  | Test-only helpers — no reason to publish                                                                                                                                                                         |
| `@qmd-team-intent-kb/policy-engine`  | Transitively depends on `claude-runtime` (secret detection, content classification). Cannot be published until that dependency is refactored behind an interface the engine itself owns. Tracked as a follow-up. |

All apps under `apps/*` are also `private: true` — they are deployables, not libraries.

## Known Blocker: policy-engine

`packages/policy-engine` is a strong candidate for publication in principle (deterministic governance pipeline, useful as a standalone package), but it currently imports:

- `classifyContent` from `@qmd-team-intent-kb/claude-runtime`
- `scanForSecrets` from `@qmd-team-intent-kb/claude-runtime`

Publishing it as-is would require also publishing `claude-runtime`, which exposes internal spool paths we want to keep unpublished. The refactor path is to define a small `ContentClassifier` / `SecretScanner` interface inside `policy-engine` (or `schema`) and inject implementations from `claude-runtime` at the app layer. Once that seam exists, `policy-engine` can be flipped to publishable in the same way as `schema` and `common`.

## Publishing Workflow

This repository does not publish on every release yet. When we decide to publish, the workflow is:

1. Ensure `pnpm validate` is green on the branch to be released.
2. Bump versions across the workspace (`pnpm version:bump X.Y.Z` when available, or edit the three publishable package.json files manually and keep them in lockstep with the root version per the single-version strategy in `008-OD-RELS-release-versioning-policy.md`).
3. Build all packages: `pnpm -r build`.
4. Dry run: `pnpm publish -r --filter='./packages/{schema,common,repo-resolver}' --dry-run --access public --no-git-checks`.
5. Publish: `pnpm publish -r --filter='./packages/{schema,common,repo-resolver}' --access public`.
   Packages with `private: true` are automatically skipped by pnpm.
6. Tag the release (`git tag vX.Y.Z && git push --tags`) and draft the GitHub Release from the `CHANGELOG.md` excerpt.

## Guardrails

- Root `package.json` stays `private: true` forever — the monorepo root is not a shippable artifact.
- A naive `pnpm -r publish` will not leak private packages because every non-publishable package explicitly carries `private: true`.
- The `files` allowlist on each publishable package ensures we never accidentally ship source, tests, tsbuildinfo, or internal scripts.
- Package READMEs are intentionally minimal. Do not backfill marketing content into them; the repository root `README.md` and `000-docs/` carry the narrative.

## Related Documents

- `008-OD-RELS-release-versioning-policy.md` — semver, changelog, and release cadence policy
- `020-OD-RELS-v1-release-checklist.md` — v1 release gating checklist
