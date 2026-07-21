#!/usr/bin/env bash
# Publish blkpvnthr.com to the Oracle VM via a zero-downtime, atomic release
# swap — the same pattern os.blkpvnthr.com uses on this box. Each deploy lands in
# /var/www/blkpvnthr.com/releases/<ts> and the /var/www/blkpvnthr.com/current
# symlink is flipped in a single mv; nginx serves `root /var/www/blkpvnthr.com/current`.
#
# This is a static site with no build step, so the only pre-flight is the same
# verification CI runs: formatting, link/claim validation, and a guard that no
# private document ever reaches the publish set. Run from anywhere:
#   bash deploy/deploy.sh
#
# Override the target if needed:
#   VM=1.2.3.4 KEY=~/.ssh/other bash deploy/deploy.sh
set -euo pipefail

VM="${VM:-150.136.62.159}"
KEY="${KEY:-$HOME/.ssh/oracle}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO}"

# ── Pre-flight: verify exactly what CI verifies, before anything ships ────────
echo ">> Verifying (formatting, links, claim safety)"
npm run --silent format:check
node scripts/validate.mjs site

# ── Guard: private records must never enter the publish set ───────────────────
# This repo also holds docs/ (operating agreement, EIN, financials). site/ is the
# only thing shipped, but assert it carries no document files regardless.
if find site -type f \( -name '*.pdf' -o -name '*.xlsx' -o -name '*.csv' \) | grep -q .; then
  echo "!! Document files found under site/ — refusing to publish." >&2
  exit 1
fi

echo ">> Packaging site/ (no macOS resource-fork files)"
COPYFILE_DISABLE=1 tar --no-mac-metadata -czf /tmp/blkpvnthr-www.tgz -C site . 2>/dev/null \
  || COPYFILE_DISABLE=1 tar -czf /tmp/blkpvnthr-www.tgz -C site .

echo ">> Uploading + atomic release swap on ${VM}"
scp -i "${KEY}" /tmp/blkpvnthr-www.tgz "ubuntu@${VM}:/tmp/blkpvnthr-www.tgz"
ssh -i "${KEY}" "ubuntu@${VM}" 'sudo bash -s' <<'REMOTE'
set -euo pipefail
BASE=/var/www/blkpvnthr.com
KEEP=5                                     # releases to retain for rollback
TS=$(date +%Y%m%d-%H%M%S)
REL="${BASE}/releases/${TS}"

mkdir -p "${REL}"
tar -xzf /tmp/blkpvnthr-www.tgz -C "${REL}"
rm -f /tmp/blkpvnthr-www.tgz

# Static files are not writable by the web-server process: owned root:root,
# world-readable (dirs 755, files 644). www-data (nginx) reads, never writes.
chown -R root:root "${REL}"
find "${REL}" -type d -exec chmod 755 {} +
find "${REL}" -type f -exec chmod 644 {} +

# Atomic swap: build the new symlink beside the old, then rename over it. mv -T
# is atomic on one filesystem, so no request ever sees a missing document root.
ln -sfn "${REL}" "${BASE}/current.tmp"
mv -Tf "${BASE}/current.tmp" "${BASE}/current"

# nginx resolves the symlink per request; the reload just clears cached fds.
nginx -t && systemctl reload nginx

# Prune old releases, keeping the most recent KEEP.
ls -1dt "${BASE}"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf || true

echo ">> Released ${TS} ($(ls -1d "${BASE}"/releases/*/ | wc -l) release(s) retained)"
REMOTE
rm -f /tmp/blkpvnthr-www.tgz
echo ">> Deployed to https://blkpvnthr.com"
