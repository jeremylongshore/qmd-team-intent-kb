# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Monorepo scaffolding with pnpm workspaces (apps/, packages/, kb-export/, tests/, scripts/, examples/)
- Architecture documentation and system thesis (000-docs/001-repo-blueprint)
- Security policy with project-specific threat model covering memory integrity, MCP risk, and tenant isolation
- Contribution guidelines with commit conventions, PR expectations, and review process
- CI pipeline with lint, format check, type check, and test validation via GitHub Actions
- Gemini code review via Workload Identity Federation on pull requests
- 12-document knowledge base in 000-docs/
- Release and versioning policy following Semantic Versioning
- Beads task tracking initialization with 10 epics spanning foundation through enterprise features
