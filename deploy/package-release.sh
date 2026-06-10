#!/usr/bin/env bash
# Build HintTalk and package a self-contained release tarball for Option 2
# (run as a bare Node.js process on a server — no node_modules needed at
# runtime because server.mjs only uses Node built-ins).
#
# Usage:        ./deploy/package-release.sh
# Output:       release/hinttalk-<timestamp>.tar.gz  (+ hinttalk-latest.tar.gz symlink)
# On the server: tar -xzf hinttalk-latest.tar.gz -C /opt/hinttalk && node /opt/hinttalk/server.mjs
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/web"
OUT="$ROOT/release"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARBALL="$OUT/hinttalk-$STAMP.tar.gz"

echo "==> Installing dependencies"
cd "$WEB"
npm ci

echo "==> Building (tsc + vite)"
npm run build

echo "==> Packaging release"
mkdir -p "$OUT"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp -R "$WEB/dist" "$STAGE/dist"
cp "$WEB/server.mjs" "$STAGE/server.mjs"
mkdir -p "$STAGE/deploy"
cp "$ROOT/deploy/hinttalk.service" "$STAGE/deploy/"
cp "$ROOT/deploy/ecosystem.config.cjs" "$STAGE/deploy/"

tar -czf "$TARBALL" -C "$STAGE" .
ln -sf "$(basename "$TARBALL")" "$OUT/hinttalk-latest.tar.gz"

echo "==> Done"
echo "Release: $TARBALL"
echo
echo "Deploy to a server:"
echo "  scp $TARBALL user@server:/tmp/"
echo "  ssh user@server 'sudo mkdir -p /opt/hinttalk && sudo tar -xzf /tmp/$(basename "$TARBALL") -C /opt/hinttalk'"
echo "  # then follow deploy/hinttalk.service (systemd) or deploy/ecosystem.config.cjs (PM2)"
