# Branch Protection Checklist — qmd-team-intent-kb

**Doc ID**: 016-OD-OPSM
**Purpose**: Actionable checklist for configuring GitHub branch protection on `main`.

## Required Settings for `main`

### Pull Request Rules

- [ ] Require a pull request before merging
- [ ] Require at least 1 approval
- [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] Require review from code owners (CODEOWNERS)

### Status Checks

- [ ] Require status checks to pass before merging
- [ ] Require branches to be up to date before merging
- [ ] Required checks:
  - `validate` (CI workflow)
  - `review` (Gemini code review) — advisory, not blocking

### Branch Rules

- [ ] Require linear history (squash or rebase merges only)
- [ ] Do not allow bypassing the above settings (even for admins)
- [ ] Restrict who can push to matching branches (maintainers only)

### Optional but Recommended

- [ ] Require signed commits (when team uses GPG/SSH signing)
- [ ] Require deployments to succeed before merging (when deploy workflow exists)
- [ ] Automatically delete head branches after merge

## How to Apply

1. Go to **Settings → Branches → Branch protection rules**
2. Click **Add rule** for branch name pattern `main`
3. Check each box per this checklist
4. Save changes

## Verification

After applying, test by:

1. Pushing directly to `main` — should be rejected
2. Opening a PR without CI passing — should block merge
3. Opening a PR without approval — should block merge

## When to Revisit

- When adding new required CI checks
- When onboarding team members who need push access
- When enabling deploy-gated merges
