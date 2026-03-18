# Security and Governance

## Threat Model

This section enumerates the specific threats relevant to a governed team memory platform that captures, evaluates, curates, and distributes knowledge from Claude Code sessions.

### 1. Secret Leakage into Memory

**Threat**: Memory candidates extracted from Claude Code sessions may contain API keys, tokens, passwords, connection strings, private keys, or other secrets. If these pass through the governance pipeline and enter the curated store, they become searchable, exportable, and distributed to team members and git repositories.

**Attack surface**: Claude Code sessions routinely interact with configuration files, environment variables, API responses, and deployment scripts that contain secrets. A memory proposal about "how to configure the database connection" might include the actual connection string with credentials.

**Secret patterns to detect**:

- Environment variable values (especially from `.env` files)
- JWT tokens (`eyJ...` prefix)
- API keys (provider-specific prefixes: `sk-`, `AKIA`, `ghp_`, `gho_`, `xoxb-`, etc.)
- Connection strings (containing `://` with credentials)
- PEM-encoded private keys (`-----BEGIN.*PRIVATE KEY-----`)
- Base64-encoded credentials in authorization headers
- Cloud provider credentials (GCP service account JSON, AWS access keys)

**Mitigation**: Pre-policy secret detection in the capture layer (Phase 2) scans candidates before they enter the governance pipeline. The policy engine (Phase 4) applies configurable secret detection rules as a critical-failure gate — any detected secret blocks promotion. Secret patterns are configurable and version-controlled.

### 2. Untrusted MCP Content

**Threat**: Model Context Protocol (MCP) servers can inject content into Claude Code sessions. This content may be inaccurate, misleading, or maliciously crafted to pollute the team knowledge base. Memory candidates derived from MCP-sourced context carry inherent trust uncertainty.

**Attack surface**: A compromised or poorly implemented MCP server could inject false architectural guidance, incorrect API usage patterns, or subtly wrong configuration advice. If this content is captured and promoted to curated status, it becomes trusted team knowledge.

**Mitigation**: Memory candidates sourced from MCP context must be tagged with their provenance (Phase 2). The policy engine (Phase 4) can apply differential trust scoring — MCP-sourced candidates may require higher relevance thresholds or manual review flags. Provenance metadata is preserved in curated memories for auditability.

### 3. Prompt/Hook Over-Trust

**Threat**: Claude Code hooks or automation that auto-approve or auto-promote memory candidates bypass the deterministic governance pipeline. If a hook can write directly to the curated store without policy evaluation, the entire governance model is undermined.

**Attack surface**: Custom Claude Code hooks, pre/post-session scripts, or plugins that interact with the memory system. A misconfigured hook could invoke the API's promotion endpoint directly, skipping the curator's policy evaluation step.

**Mitigation**: All promotion must flow through the curator engine's policy evaluation pipeline (Phase 6). The control plane API (Phase 5) does not expose a "direct promote" endpoint — promotion is exclusively a curator operation. API authorization (Phase 5) restricts write access to authorized roles. Audit logging (Phase 9) records the source of every promotion for forensic analysis.

### 4. Inbox/Archive Pollution of Search Results

**Threat**: Raw, unvetted memory candidates in the inbox or archived/deprecated content appearing in default search results. This pollutes the developer experience with untrusted or outdated information, eroding confidence in the knowledge base.

**Attack surface**: A bug in the qmd adapter, search endpoint, or edge daemon that fails to enforce the curated-only default scope. An API consumer that does not properly set scope parameters.

**Mitigation**: Curated-only default search is enforced at the qmd adapter layer (Phase 3), not just at the API layer. The adapter rejects queries without explicit scope unless they target curated content. Integration tests verify that inbox and archive content is excluded from default search results. The edge daemon (Phase 8) maintains separate index segments or uses qmd's filtering to enforce scope isolation.

### 5. Cross-Project Contamination

**Threat**: A memory from Project A appearing in Project B's search results, recommendations, or exports. This violates tenant isolation and could expose confidential project details, proprietary approaches, or client-specific information to unauthorized teams.

**Attack surface**: Incorrect tenant tagging during capture. Missing tenant filter in search queries. Edge daemon syncing the wrong project's content to a local index. Git exporter writing to the wrong target repository.

**Mitigation**: Tenant isolation is enforced at every layer:

- **Capture** (Phase 2): Repo-resolver assigns tenant identifiers at extraction time.
- **Policy** (Phase 4): Tenant isolation rule validates identifiers against expected boundaries.
- **Storage** (Phase 5): Canonical store partitions data by tenant.
- **Search** (Phase 3/5): Tenant filter is required on all queries; the adapter enforces this.
- **Edge sync** (Phase 8): Per-project qmd indexes; the daemon never cross-pollinates.
- **Export** (Phase 7): Per-project/team git targets with tenant-scoped filtering.

### 6. Local Index Isolation

**Threat**: qmd indexes on a developer's machine containing content from projects they should not have access to. The edge daemon accidentally syncs another project's curated memories to the local index.

**Attack surface**: Daemon configuration error, tenant ID collision, or a bug in the sync engine's project scoping logic.

**Mitigation**: The edge daemon (Phase 8) maintains strictly separate qmd indexes per project/tenant. Index creation includes the tenant identifier in the index name/path. The daemon validates tenant scoping before every sync operation. Integration tests verify index isolation with multi-tenant test scenarios.

### 7. Curated vs. Raw Governance

**Threat**: Memory content entering the curated store without passing through the deterministic policy evaluation pipeline. This could happen through API bypass, direct database manipulation, or a bug in the curator engine.

**Mitigation**: The promotion path is: inbox → policy evaluation → curator promotion → curated store. There is no alternative path. The control plane API does not expose a "write directly to curated" endpoint. Database-level access controls (when a persistent store is implemented) restrict direct writes. Audit logging (Phase 9) detects any curated memories that lack a corresponding policy evaluation record.

### 8. Enterprise Managed Settings

**Threat**: The memory platform overriding or ignoring organization-level Claude Code managed settings. Enterprise administrators set policies for their organization; the memory platform must respect these constraints.

**Attack surface**: The capture layer (Phase 2) interacting with Claude Code in ways that contradict enterprise-managed hook restrictions, memory policies, or MCP trust settings.

**Mitigation**: Phase 10 includes explicit integration with enterprise managed settings. The capture layer checks for and respects organization-level policies before capturing memory candidates. Enterprise settings take precedence over project-level configuration.

### 9. Plugin/Hook Policy Risk

**Threat**: Third-party Claude Code plugins or hooks compromising memory integrity by injecting false candidates, bypassing governance, or exfiltrating curated knowledge.

**Attack surface**: Plugins run in the Claude Code environment and may have access to session context, hook execution, and local file system. A malicious plugin could write directly to the inbox spool, craft candidates that bypass secret detection, or read curated knowledge for exfiltration.

**Mitigation**: Hook execution is sandboxed from memory operations (Phase 10). The spool directory has restricted write access. Candidates include provenance metadata indicating their source (direct session vs. hook vs. plugin). The policy engine can apply differential trust based on provenance. File system permissions protect qmd indexes and canonical store data.

### 10. Release Artifact Integrity

**Threat**: Tampered build artifacts or release packages being deployed. A supply chain attack that modifies the memory platform's code between build and deployment.

**Mitigation**: Phase 10 includes signed releases and reproducible builds. Build artifacts are signed with a verifiable key. Deployment processes verify signatures before installation. Dependency pinning (pnpm lockfile with `--frozen-lockfile` in CI) prevents dependency substitution attacks. GitHub Dependabot monitors for known vulnerabilities in dependencies.

### 11. Audit Trail Integrity

**Threat**: Audit logs being modified, deleted, or made unavailable, preventing forensic analysis of memory operations.

**Attack surface**: Access to the storage layer where audit logs reside. A compromised administrator account deleting inconvenient audit entries.

**Mitigation**: Every memory promotion, demotion, supersession, and deletion is logged with timestamp, actor, and reason (Phase 9). Audit logs are append-only at the application level. Access to audit log storage is restricted to read-only for most roles. Phase 10 adds integrity checks (hash chains or similar) for audit log tamper detection.

### 12. Retention and Compliance

**Threat**: Curated knowledge retained beyond regulatory or organizational retention limits, or deleted before retention requirements are met.

**Attack surface**: Lack of automated retention enforcement. Manual deletion without compliance checks.

**Mitigation**: Phase 10 adds configurable retention policies per tenant, content type, and lifecycle state. Automated purge processes enforce retention limits with audit logging. Compliance holds can prevent deletion of specific memories regardless of retention policy. Retention configuration is version-controlled and auditable.

---

## Security Controls — Current (Phase 0)

The following security controls are in place today:

| Control                 | Implementation                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Secret exclusion        | `.gitignore` excludes `.env` files, `secrets/` directories, and common credential file patterns.             |
| Dependency monitoring   | GitHub Dependabot enabled for automated vulnerability scanning of npm dependencies.                          |
| Automated code review   | Gemini code review via `google-github-actions/run-gemini-cli` catches security issues in pull request diffs. |
| Vulnerability reporting | `SECURITY.md` documents the process for reporting security vulnerabilities.                                  |
| Code ownership          | `CODEOWNERS` requires review from the maintainer for all changes.                                            |
| Lockfile integrity      | CI uses `pnpm install --frozen-lockfile` to prevent dependency substitution.                                 |
| Branch protection       | `main` branch requires passing CI checks and approving review before merge.                                  |

---

## Security Controls — Planned

The following controls will be implemented in future phases:

| Control                        | Phase | Description                                                                                                   |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------- |
| Secret scanning in capture     | 2     | Pre-policy pattern-based scanning of memory candidates for secrets before they enter the governance pipeline. |
| MCP trust tagging              | 2     | Provenance tagging for MCP-sourced content with differential trust scoring.                                   |
| Tenant isolation at storage    | 5     | Data partitioning by tenant in the canonical store with access controls.                                      |
| API authentication             | 5     | Token-based authentication for control plane API access.                                                      |
| API authorization              | 5     | Role-based access control (admin, curator, reader) with tenant scoping.                                       |
| Promotion pipeline enforcement | 6     | All promotion flows through policy evaluation; no direct-write bypass.                                        |
| Audit logging                  | 9     | Append-only logging of all memory operations with actor, timestamp, reason.                                   |
| Enterprise managed settings    | 10    | Integration with organization-level Claude Code policies.                                                     |
| MCP trust boundaries           | 10    | Formalized trust model for MCP-sourced content.                                                               |
| Plugin/hook sandboxing         | 10    | Isolation of hook execution from memory operations.                                                           |
| Signed releases                | 10    | Cryptographic signing of build artifacts and release packages.                                                |
| Reproducible builds            | 10    | Deterministic, verifiable build process.                                                                      |
| Retention policies             | 10    | Configurable retention with automated enforcement and compliance holds.                                       |
| Audit log integrity            | 10    | Tamper detection for audit log entries.                                                                       |
