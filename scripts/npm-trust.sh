#!/usr/bin/env bash
# Binds npm trusted publishers to .github/workflows/publish.yml in the GitHub mirror, for the
# packages named (`ui-hex`, …) or, with no arguments, for every package. Run by a package owner
# after each package's first version is on npm (npm only trusts a package that already exists),
# with npm >= 11.15 and 2FA on the account. npm refuses a second binding for a package, so a new
# package is bound by naming it alone.
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
if [ $# -eq 0 ]; then set -- $(ls "$repo/packages"); fi
for dir in "$@"; do
  name=$(node -p "require('$repo/packages/$dir/package.json').name")
  npm trust github "$name" --repo orzFly/ui --file publish.yml --env npm --allow-publish --yes
  # npm asks for 2FA on the first call and waives it for the next five minutes; its docs ask for
  # a pause between calls made in bulk.
  sleep 2
done
