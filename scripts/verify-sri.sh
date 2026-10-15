#!/usr/bin/env bash
# verify-sri.sh — checks every integrity="..." hash in index.html against the
# file the CDN actually serves right now. Run it after changing a library
# version, and any time you want proof the hashes still match.
#
# Needs: bash, curl, openssl (all ship with Git for Windows' Git Bash).
#
# Usage:
#   bash scripts/verify-sri.sh              # checks index.html in the repo root
#   bash scripts/verify-sri.sh other.html   # checks a different HTML file
#
# Exit code is 0 only if every hash matches.

set -uo pipefail

HTML="${1:-$(dirname "$0")/../index.html}"
[ -f "$HTML" ] || { echo "Cannot find $HTML"; exit 2; }
command -v curl    >/dev/null 2>&1 || { echo "curl is required";    exit 2; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required"; exit 2; }

checked=0
failed=0

# Pull each tag that has both a URL and an integrity attribute, one per line.
while IFS= read -r tag; do
    url="$(printf '%s' "$tag" | sed -n 's/.*\(src\|href\)="\([^"]*\)".*/\2/p')"
    integ="$(printf '%s' "$tag" | sed -n 's/.*integrity="\([^"]*\)".*/\1/p')"
    [ -n "$url" ] && [ -n "$integ" ] || continue

    algo="${integ%%-*}"          # sha384 or sha512
    expected="${integ#*-}"
    case "$algo" in
        sha256|sha384|sha512) ;;
        *) echo "SKIP  $url (unsupported algorithm: $algo)"; continue ;;
    esac

    checked=$((checked + 1))
    tmp="$(mktemp)"
    if ! curl -fsSL --max-time 60 "$url" -o "$tmp"; then
        echo "FAIL  $url (download failed)"
        failed=$((failed + 1)); rm -f "$tmp"; continue
    fi

    actual="$(openssl dgst -"$algo" -binary "$tmp" | openssl base64 -A)"
    rm -f "$tmp"

    if [ "$actual" = "$expected" ]; then
        echo "OK    $url"
    else
        echo "FAIL  $url"
        echo "        in index.html: $algo-$expected"
        echo "        CDN serves:    $algo-$actual"
        failed=$((failed + 1))
    fi
done < <(grep -E 'integrity="' "$HTML")

echo
echo "Checked $checked, failed $failed."
[ "$checked" -gt 0 ] && [ "$failed" -eq 0 ]
