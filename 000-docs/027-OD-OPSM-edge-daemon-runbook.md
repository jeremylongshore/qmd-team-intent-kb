# 027-OD-OPSM — edge-daemon Operations Runbook

**Category:** OD — Operations & Deployment
**Type:** OPSM — Operations Manual
**Status:** Active
**Version:** 0.1.0
**Component:** `apps/edge-daemon`

---

## Overview

The edge-daemon is the local process that bridges Claude Code sessions to the
team knowledge-base control plane. It runs as a long-lived background service
on every developer machine or CI host that participates in a tenant.

Responsibilities:

- Poll the spool directory for new memory candidates written by
  `@qmd-team-intent-kb/claude-runtime`.
- Run each candidate through the governance policy pipeline.
- Promote approved candidates into the SQLite store.
- Trigger incremental git-export to `kb-export/`.
- Trigger qmd index updates so local search reflects new memories.
- Deprecate memories that have not been accessed within the staleness window.

The daemon is a single Node.js process. It uses a PID lock file to prevent
multiple concurrent instances. All state is local to the machine; there is no
peer-to-peer coordination between daemon instances.

---

## Install

### Prerequisites

- Node.js >= 20 (check with `node --version`)
- The monorepo built: `pnpm install && pnpm build`
  (or a Docker image — see the Docker section)
- A dedicated system user `edge-daemon` (Linux only; see below)

### Linux — systemd

1. Create a dedicated user and data directory:

   ```sh
   sudo useradd --system --no-create-home --shell /usr/sbin/nologin edge-daemon
   sudo mkdir -p /var/lib/edge-daemon/spool /var/lib/edge-daemon/kb-export
   sudo chown -R edge-daemon:edge-daemon /var/lib/edge-daemon
   ```

2. Create the environment file at `/etc/edge-daemon/env` (mode `0640`,
   owner `root:edge-daemon`). This file must contain at least:

   ```
   DAEMON_TENANT_ID=<your-tenant>
   ```

   Add any other variables from the Configuration section as needed.

3. Install and enable the unit:

   ```sh
   sudo cp apps/edge-daemon/deploy/edge-daemon.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now edge-daemon
   ```

4. Verify:

   ```sh
   systemctl status edge-daemon
   journalctl -u edge-daemon -f
   ```

### macOS — launchd

1. Edit `EnvironmentVariables` in the plist:

   ```sh
   nano apps/edge-daemon/deploy/com.intentsolutions.edge-daemon.plist
   # Set DAEMON_TENANT_ID and adjust APP_DIR / ProgramArguments paths.
   ```

2. Create the log directory:

   ```sh
   mkdir -p /usr/local/var/log/edge-daemon
   ```

3. Load the agent:

   ```sh
   cp apps/edge-daemon/deploy/com.intentsolutions.edge-daemon.plist \
      ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.intentsolutions.edge-daemon.plist
   ```

4. Verify:

   ```sh
   launchctl list | grep edge-daemon
   tail -f /usr/local/var/log/edge-daemon/stdout.log
   ```

### Docker

Build the image from the repo root (the Dockerfile uses a monorepo context):

```sh
docker build \
  -f apps/edge-daemon/deploy/Dockerfile \
  -t edge-daemon:latest \
  .
```

Run with the required environment variable mounted:

```sh
docker run -d \
  --name edge-daemon \
  --restart on-failure \
  -e DAEMON_TENANT_ID=my-team \
  -v /var/lib/edge-daemon:/var/lib/edge-daemon \
  edge-daemon:latest
```

For Kubernetes, map `DAEMON_TENANT_ID` from a Secret and mount a PersistentVolume
at `/var/lib/edge-daemon`.

---

## Configuration

All configuration is via environment variables. There are no CLI flags; the
only optional positional argument to the daemon is the subcommand (`start`,
`stop`, `status`, `run-once`), which defaults to `start`.

Source: `apps/edge-daemon/src/config.ts`

| Variable                        | Required | Default                            | Description                                                                             |
| ------------------------------- | -------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| `DAEMON_TENANT_ID`              | Yes      | —                                  | Tenant identifier. Used to scope memory retrieval and qmd index namespacing.            |
| `DAEMON_POLL_INTERVAL`          | No       | `10000`                            | Milliseconds between spool poll cycles.                                                 |
| `DAEMON_MAX_CANDIDATES`         | No       | `100`                              | Maximum candidates processed per cycle.                                                 |
| `DAEMON_MAX_SPOOL_SIZE`         | No       | `10485760`                         | Maximum spool file size in bytes (10 MB). Files larger than this are skipped.           |
| `DAEMON_ENABLE_EXPORT`          | No       | `true`                             | Enable incremental git-export after each cycle.                                         |
| `DAEMON_ENABLE_INDEX`           | No       | `true`                             | Enable qmd index update after each cycle.                                               |
| `DAEMON_ENABLE_STALENESS`       | No       | `true`                             | Enable automatic staleness sweep (deprecation of old memories).                         |
| `DAEMON_STALE_DAYS`             | No       | `90`                               | Days after last access before a memory is auto-deprecated.                              |
| `DAEMON_SPOOL_DIR`              | No       | `~/.qmd-team-intent-kb/spool`      | Directory watched for incoming candidate files.                                         |
| `DAEMON_EXPORT_DIR`             | No       | `kb-export/`                       | Output directory for git-exporter Markdown files.                                       |
| `DAEMON_EXPORT_TARGET`          | No       | `kb-export-default`                | Export target identifier passed to git-exporter.                                        |
| `DAEMON_SUPERSESSION_THRESHOLD` | No       | `0.6`                              | Jaccard similarity threshold above which a new candidate supersedes an existing memory. |
| `DAEMON_PID_FILE`               | No       | `~/.qmd-team-intent-kb/daemon.pid` | Path of the PID lock file. Must be writable by the daemon user.                         |

`DAEMON_TENANT_ID` is the only required variable. The daemon exits immediately
with code 1 if it is absent.

Boolean variables accept only the literal strings `true` or `false`. Any other
value falls back to the default.

---

## Health Check

The edge-daemon does not expose an HTTP health endpoint; it is a single-process
local daemon. Use the PID lock file and `status` subcommand to determine whether
it is running.

### Quick status check

```sh
# Returns JSON: {"status":"running","pid":12345} or {"status":"stopped"}
node apps/edge-daemon/dist/main.js status
```

### PID lock file inspection

```sh
# Default path (adjust to DAEMON_PID_FILE if overridden):
PID_FILE="${HOME}/.qmd-team-intent-kb/daemon.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "daemon running (PID $PID)"
  else
    echo "stale lock file — daemon not running"
  fi
else
  echo "no lock file — daemon not running"
fi
```

### systemd health (Linux)

```sh
systemctl is-active edge-daemon   # prints "active" or "inactive"
systemctl status edge-daemon      # shows last log lines and restart count
```

### launchd health (macOS)

```sh
# Exit code 0 = running, non-zero = not loaded or stopped
launchctl list com.intentsolutions.edge-daemon
```

### Docker health

```sh
docker inspect --format='{{.State.Status}}' edge-daemon
# Expected: "running"
```

---

## Log Inspection

### systemd (Linux)

```sh
# Follow live:
journalctl -u edge-daemon -f

# Last 100 lines:
journalctl -u edge-daemon -n 100

# Since a specific time:
journalctl -u edge-daemon --since "2026-04-14 00:00:00"

# Filter by priority (errors only):
journalctl -u edge-daemon -p err
```

### launchd (macOS)

```sh
tail -f /usr/local/var/log/edge-daemon/stdout.log
tail -f /usr/local/var/log/edge-daemon/stderr.log
```

### Docker

```sh
docker logs -f edge-daemon
docker logs --tail 100 edge-daemon
```

### Log format

The daemon uses `ConsoleDaemonLogger` (structured text, not JSON). Each line
is prefixed with the ISO-8601 timestamp and severity level:

```
2026-04-14T12:00:00.000Z [info]  edge-daemon: cycle complete (3 promoted, 0 rejected)
2026-04-14T12:00:10.000Z [error] edge-daemon: policy pipeline error: ...
```

---

## Common Failure Modes

### Daemon fails to start: "DAEMON_TENANT_ID environment variable is required"

The environment file was not loaded or is missing the required variable.

- systemd: confirm `/etc/edge-daemon/env` exists and contains `DAEMON_TENANT_ID=`.
  Check `systemctl status edge-daemon` for "EnvironmentFile" errors.
- launchd: confirm the plist `EnvironmentVariables` dict has `DAEMON_TENANT_ID`.
- Docker: confirm `-e DAEMON_TENANT_ID=...` is present in the run command or
  that an env-file is mounted.

### Daemon fails to start: "lock already held"

Another instance is running, or a stale PID file exists from a previous crash.

Run the stop subcommand which cleans up stale locks automatically:

```sh
node apps/edge-daemon/dist/main.js stop
```

If stop reports "daemon not running" but the daemon still fails to start, manually
remove the stale lock file:

```sh
rm "${DAEMON_PID_FILE:-$HOME/.qmd-team-intent-kb/daemon.pid}"
```

### Daemon exits immediately after starting (exit code 1)

Check the logs for a configuration or database error. Common causes:

- SQLite database path not writable by the daemon user.
- `DAEMON_SPOOL_DIR` does not exist and cannot be created (permissions).
- A dependency package (`better-sqlite3`, `qmd-adapter`) is missing from the
  production install tree — ensure `pnpm install` completed cleanly.

### Spool files not processed

- Verify `DAEMON_SPOOL_DIR` points to the same directory that `claude-runtime`
  is writing to. If `DAEMON_SPOOL_DIR` is unset on both sides, both will use
  the `common` package default (`resolveTeamKbPath`), which should agree.
- Check that the daemon user can read files in the spool directory.

### qmd index not updating

- Confirm `DAEMON_ENABLE_INDEX=true` (the default).
- Verify the `qmd` CLI is on `PATH` as seen by the daemon process. On systemd,
  PATH is not inherited from the user shell — add it explicitly in the
  environment file if needed.

### High CPU or tight restart loop (systemd)

The `RestartSec=5s` guard in the unit file prevents spinning. If the daemon is
restarting repeatedly, check for a hard configuration error (see above).
Temporarily disable auto-restart while diagnosing:

```sh
sudo systemctl stop edge-daemon
# investigate, fix env, then:
sudo systemctl start edge-daemon
```

---

## Recovery Procedures

### Full restart

```sh
# systemd
sudo systemctl restart edge-daemon

# launchd
launchctl unload ~/Library/LaunchAgents/com.intentsolutions.edge-daemon.plist
launchctl load  ~/Library/LaunchAgents/com.intentsolutions.edge-daemon.plist

# Docker
docker restart edge-daemon
```

### Manual single cycle (bypass daemon loop)

Run exactly one cycle without starting the long-running loop. Useful for
diagnosing spool processing issues:

```sh
DAEMON_TENANT_ID=my-team \
  node apps/edge-daemon/dist/main.js run-once
```

### Wipe stale PID lock

```sh
node apps/edge-daemon/dist/main.js stop
# If stop exits non-zero, remove manually:
rm "${DAEMON_PID_FILE:-$HOME/.qmd-team-intent-kb/daemon.pid}"
```

### Recover from corrupted SQLite database

The SQLite database (`teamkb.db`) is managed by `packages/store`. If it is
corrupted:

1. Stop the daemon.
2. Back up the database: `cp teamkb.db teamkb.db.$(date +%Y%m%d%H%M%S).bak`
3. Delete or rename the corrupted file.
4. Restart the daemon — `createDatabase()` will create a fresh schema on start.
5. Memories are re-seeded from the git-export directory (`kb-export/`) or from
   spool files that have not yet been processed.

---

## Upgrade Procedure

1. Stop the daemon:

   ```sh
   sudo systemctl stop edge-daemon   # systemd
   # or: launchctl unload ~/Library/LaunchAgents/com.intentsolutions.edge-daemon.plist
   ```

2. Pull and build the new version:

   ```sh
   git pull origin main
   pnpm install --frozen-lockfile
   pnpm build
   ```

3. If the systemd unit file changed, reinstall it:

   ```sh
   sudo cp apps/edge-daemon/deploy/edge-daemon.service /etc/systemd/system/
   sudo systemctl daemon-reload
   ```

4. Start the daemon:

   ```sh
   sudo systemctl start edge-daemon
   ```

5. Verify health (see Health Check section).

For Docker, rebuild the image and redeploy:

```sh
docker build -f apps/edge-daemon/deploy/Dockerfile -t edge-daemon:<new-version> .
docker stop edge-daemon && docker rm edge-daemon
docker run -d --name edge-daemon ... edge-daemon:<new-version>
```

---

## Rollback

1. Stop the running daemon.

2. Check out the previous release tag or commit:

   ```sh
   git checkout v<previous-version>
   pnpm install --frozen-lockfile
   pnpm build
   ```

3. Restore the previous unit file if it changed:

   ```sh
   sudo cp apps/edge-daemon/deploy/edge-daemon.service /etc/systemd/system/
   sudo systemctl daemon-reload
   ```

4. Start the daemon and verify health.

For Docker, roll back by running the previous image tag:

```sh
docker stop edge-daemon && docker rm edge-daemon
docker run -d --name edge-daemon ... edge-daemon:<previous-version>
```

If the SQLite schema was migrated in the rolled-back release, restore the
database from a backup taken before the upgrade (see Recovery Procedures).
