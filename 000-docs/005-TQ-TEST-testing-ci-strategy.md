# Testing and CI Strategy

## Testing Philosophy

Test at the boundary, not every implementation detail. Tests should verify behavior visible to consumers of a module — its public API, its side effects, its error handling. Internal implementation details are free to change without breaking tests. This approach keeps tests maintainable, reduces coupling to implementation, and catches the bugs that actually matter.

## Test Types

### Unit Tests

- **Runner**: Vitest
- **Location**: Co-located with source code in `__tests__/` directories within each package and app.
- **Characteristics**: Fast, isolated, no external dependencies. Each test file runs independently. Mocks and stubs replace external systems (qmd CLI, file system, network).
- **Naming**: `<module>.test.ts` matching the source file being tested.
- **Scope**: Individual functions, classes, and modules. Schema validation. Rule evaluation. Data transformation. Error handling.

### Integration Tests

- **Location**: `tests/` directory at the repository root.
- **Characteristics**: Test cross-package interactions. Verify that packages compose correctly. May use real file system operations but avoid network dependencies where possible.
- **Scope**: Policy engine evaluating a real MemoryCandidate through a real rule pipeline. Curator processing a candidate through validation, dedup, and promotion. qmd adapter interacting with a real qmd instance (gated on qmd availability).

### End-to-End Tests

- **Status**: Planned for Phase 5+ when the control plane API exists.
- **Scope**: Full request-response cycles through the API. Memory capture → policy evaluation → promotion → search workflows. Multi-tenant isolation verification.
- **Infrastructure**: Will require a running API instance and qmd installation.

## Coverage Targets

| Scope              | Target | Rationale                                                                                                                                                            |
| ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/schema`  | 80%    | Schemas are the foundation; high coverage ensures type safety and validation correctness across the entire system.                                                   |
| Other `packages/*` | 70%    | Libraries are widely consumed; solid coverage catches integration issues early.                                                                                      |
| `apps/*`           | 60%    | Applications have more infrastructure glue code (server setup, config loading) that is lower-value to unit test. Integration and E2E tests cover app-level behavior. |

These targets will evolve as the codebase matures. They are starting points, not ceilings.

## CI Pipeline

### Platform

GitHub Actions.

### Triggers

- Push to `main` or `develop` branches.
- Pull requests targeting `main`.

### Pipeline Jobs

```
install → lint → format:check → typecheck → test → (Gemini review on PRs)
```

1. **Install**: `pnpm install --frozen-lockfile`. Ensures reproducible dependency resolution. Fails if lockfile is out of date.
2. **Lint**: `pnpm lint`. ESLint 9 flat config with TypeScript rules. Catches code quality issues, unused imports, type errors detectable by lint rules.
3. **Format check**: `pnpm format:check`. Prettier verification. Ensures consistent formatting without modifying files. Fails if any file would be reformatted.
4. **Typecheck**: `pnpm typecheck`. TypeScript compiler in `--noEmit` mode with strict settings. Catches type errors across the entire monorepo.
5. **Test**: `pnpm test`. Vitest with workspace-aware configuration. Runs all unit and integration tests across all packages and apps.
6. **Gemini code review** (PR-only): Automated code review via `google-github-actions/run-gemini-cli` with Workload Identity Federation (WIF) authentication. Provides AI-assisted review comments on pull requests.

### Fail Fast

Any job failure blocks merge. The pipeline is configured with `fail-fast: true` — if lint fails, subsequent jobs are cancelled. This provides fast feedback and prevents wasting CI minutes on a known-broken state.

## Quality Gate

All pull requests must pass the `pnpm validate` script before merge. This script runs the complete validation suite:

```
pnpm validate = format:check + lint + typecheck + test
```

Branch protection rules on `main` require:

- All CI checks passing.
- At least one approving review (CODEOWNERS).
- No unresolved review comments.

## Gemini Code Review

Automated PR review is provided by Gemini via the `google-github-actions/run-gemini-cli` GitHub Action. Authentication uses Workload Identity Federation (WIF) — no long-lived service account keys.

Gemini reviews cover:

- Code quality and style issues.
- Potential bugs and logic errors.
- Security concerns (secret exposure, injection risks).
- Adherence to project conventions.

Gemini reviews are advisory — they do not block merge on their own. Human reviewers make the final decision.

## Tooling Details

### Vitest

- Workspace-aware configuration: each package can define its own `vitest.config.ts` while inheriting shared settings from the root.
- Watch mode for local development: `pnpm test -- --watch`.
- Coverage reporting: `pnpm test -- --coverage` (v8 provider).
- Snapshot testing available for schema validation output.

### ESLint 9

- Flat config format (`eslint.config.js`).
- TypeScript-aware rules via `@typescript-eslint/eslint-plugin`.
- No legacy `.eslintrc` files.
- Shared config at monorepo root; packages can extend with local overrides.

### Prettier

- Consistent formatting across all TypeScript, JSON, Markdown, and YAML files.
- Configuration at monorepo root (`.prettierrc`).
- Integrated with ESLint via `eslint-config-prettier` to avoid rule conflicts.
- Pre-commit formatting enforcement planned (lint-staged + husky).

### TypeScript

- Strict mode enabled: `strict: true` in `tsconfig.json`.
- Project references for monorepo package boundaries.
- `noEmit` mode for type checking (bundling handled separately if needed).
- Path aliases configured per-package for clean imports.

## Current State (Phase 0)

The CI pipeline runs `pnpm validate`, but there are no application tests yet. The pipeline currently validates:

- ESLint rules pass (no lint errors).
- Prettier formatting is consistent (no format drift).
- TypeScript compiles without errors (no type errors).
- Test runner executes successfully (no test files exist yet, but the runner works).

This establishes the quality gate infrastructure before any application code is written, ensuring that the first line of application code enters a repo with working CI.

## Future Enhancements

As the project progresses through implementation phases, the testing strategy will expand:

- **Phase 1**: Schema validation tests (unit tests for all Zod schemas).
- **Phase 2**: Capture pipeline tests (session hook, secret detection, spool operations).
- **Phase 3**: qmd adapter tests (CLI wrapper, search scope enforcement). Integration tests gated on qmd availability.
- **Phase 4**: Policy engine tests (rule evaluation, composition pipeline, configuration loading).
- **Phase 5**: API endpoint tests (HTTP-level integration tests). E2E test infrastructure.
- **Phase 6+**: Full pipeline integration tests (capture → policy → promotion → search).
- **Coverage enforcement**: CI will fail if coverage drops below configured thresholds per package.
- **Mutation testing**: Planned evaluation of mutation testing tools (e.g., Stryker) for critical packages (schema, policy-engine) to verify test quality beyond line coverage.
- **Performance testing**: Load testing for API and search endpoints once they exist.
- **Pre-commit hooks**: lint-staged + husky for format and lint checks before commit.
