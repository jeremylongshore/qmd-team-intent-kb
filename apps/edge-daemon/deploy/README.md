# edge-daemon deployment assets

This directory contains ready-to-use deployment artifacts for the
`@qmd-team-intent-kb/edge-daemon` process.

| File | Purpose |
|---|---|
| `edge-daemon.service` | systemd unit (Linux / server installs) |
| `com.intentsolutions.edge-daemon.plist` | launchd agent (macOS developer machines) |
| `Dockerfile` | Multi-stage container image (build context: repo root) |
| `.dockerignore` | Companion to Dockerfile; keeps build context minimal |

## Quick start

See the full operations runbook at
`000-docs/027-OD-OPSM-edge-daemon-runbook.md` for installation procedures,
all environment variables, health checks, log inspection, and rollback.

### systemd (Linux)

```sh
sudo cp edge-daemon.service /etc/systemd/system/
sudo mkdir -p /etc/edge-daemon
# Create /etc/edge-daemon/env (mode 0640, owner root:edge-daemon) with at least:
#   DAEMON_TENANT_ID=<your-team>
sudo systemctl daemon-reload
sudo systemctl enable --now edge-daemon
```

### launchd (macOS)

```sh
# Edit EnvironmentVariables in the plist — set DAEMON_TENANT_ID at minimum.
cp com.intentsolutions.edge-daemon.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.intentsolutions.edge-daemon.plist
```

### Docker

```sh
# Build from repo root:
docker build -f apps/edge-daemon/deploy/Dockerfile -t edge-daemon:latest .

# Run — DAEMON_TENANT_ID is required:
docker run -d \
  --name edge-daemon \
  -e DAEMON_TENANT_ID=my-team \
  -v /var/lib/edge-daemon:/var/lib/edge-daemon \
  edge-daemon:latest
```
