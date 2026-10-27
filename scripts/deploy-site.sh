#!/usr/bin/env bash
# Builds the docs site, with Storybook under storybook/, from the checked-out
# tree and publishes it to the local server (deploy/orzui-site.service,
# http://127.0.0.1:6106).
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
root="$HOME/.local/share/orzui/site"
rev=$(git -C "$repo" rev-parse --short HEAD)
if [ -n "$(git -C "$repo" status --porcelain)" ]; then rev="$rev-dirty"; fi
release="$root/releases/$(date +%Y%m%d-%H%M%S)-$rev"

cd "$repo"
nix develop ./.nix --command pnpm install --frozen-lockfile
nix develop ./.nix --command pnpm -r --filter @orz/docs... build

mkdir -p "$root/releases"
cp -r apps/docs/dist "$release"
# Swapped via rename so a request never sees a missing `current`; the server
# resolves the symlink per request and needs no restart.
ln -sfn "$release" "$root/current.tmp"
mv -T "$root/current.tmp" "$root/current"

ls -1dt "$root"/releases/* | tail -n +4 | xargs -r rm -rf

# The unit this one replaced served Storybook alone on the same port.
old="$HOME/.config/systemd/user/orzui-storybook.service"
if [ -e "$old" ]; then
  systemctl --user disable --now orzui-storybook.service >/dev/null 2>&1 || true
  rm -f "$old"
  systemctl --user daemon-reload
fi

unit="$HOME/.config/systemd/user/orzui-site.service"
if ! cmp -s deploy/orzui-site.service "$unit"; then
  mkdir -p "$(dirname "$unit")"
  cp deploy/orzui-site.service "$unit"
  systemctl --user daemon-reload
  systemctl --user restart orzui-site.service
fi
systemctl --user enable --now orzui-site.service >/dev/null

for _ in $(seq 20); do
  if curl -fsS -o /dev/null http://127.0.0.1:6106/storybook/; then
    echo "deployed $rev → http://127.0.0.1:6106/"
    exit 0
  fi
  sleep 0.5
done
echo "server not answering on 127.0.0.1:6106" >&2
systemctl --user status orzui-site.service --no-pager >&2
exit 1
