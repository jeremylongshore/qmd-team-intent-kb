# v1 Release Checklist

## Pre-Release Gates

### Code Quality

- [ ] `pnpm validate` passes (format + lint + typecheck + test)
- [ ] `pnpm build` completes without errors
- [ ] No `TODO` placeholders in release-scope packages (edge-daemon and repo-resolver are excluded)
- [ ] All test suites green (776+ tests)

### Documentation

- [ ] README.md reflects implemented features accurately
- [ ] CHANGELOG.md has entries for all changes since last release
- [ ] CLAUDE.md synced with current architecture
- [ ] Phase plan doc reflects completion status

### Security

- [ ] SECURITY.md current and accurate
- [ ] No secrets in tracked files (CI secret scan passing)
- [ ] Dependency audit clean at `high` severity (`pnpm audit --audit-level=high`)

### Version

- [ ] All implemented package versions bumped appropriately
- [ ] Scaffolded packages remain at 0.0.0
- [ ] Root package.json version matches release

### CI/CD

- [ ] All GitHub Actions workflows passing on main
- [ ] Gemini code review active on PRs
- [ ] No stale PRs or branches

## Release-Blocking Issues

Issues that must be resolved before tagging a release:

- Failing `pnpm validate`
- Secrets detected in tracked files
- README claiming unimplemented features
- CHANGELOG missing entries for shipped changes

## Non-Blocking Issues

Issues tracked but not gating release:

- Dependabot PRs for minor/patch updates
- Scaffolded packages not yet implemented
- Missing integration test coverage for edge cases
- qmd binary not available in CI (tests correctly skipped)

## Prerelease (0.x) vs Stable (1.x)

**Current: 0.1.0 (prerelease)**

During 0.x:

- API contracts may change between minor versions
- Schema migrations are not guaranteed backward-compatible
- Breaking changes documented in CHANGELOG but not gated by major version

**1.0 criteria (not yet met):**

- Edge daemon implemented and tested
- Repo resolver implemented and tested
- API contract stability committed
- Schema migration tooling in place
- Production deployment tested
