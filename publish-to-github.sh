#!/usr/bin/env bash
# publish-to-github.sh — creates the GitHub repo for SlideForge and pushes it.
#
# One-time prerequisites (Git Bash on Windows is fine):
#   1. Git installed, with your identity set:
#        git config --global user.name  "Your Name"
#        git config --global user.email "you@example.com"
#   2. GitHub CLI installed:   winget install --id GitHub.cli
#   3. Logged in:              gh auth login
#
# Usage: unzip slideforge.zip, put this script inside the unzipped folder
# (next to index.html), open Git Bash there, and run:
#        bash publish-to-github.sh
#
# Safe to re-run: if the repo already exists it commits any new changes and
# pushes them instead of failing.

set -euo pipefail

# ---- Edit these if you reuse the script for another project ----------------
REPO_NAME="slideforge"
REPO_DESCRIPTION="Markdown-to-presentation editor with live preview, PDF export, Mermaid diagrams, and offline PWA support. No build step."
REPO_TOPICS="markdown,presentation,slides,pdf-export,mermaid,pwa,javascript"
VISIBILITY="public"        # "public" or "private"
BRANCH="main"
COMMIT_MESSAGE="SlideForge v1.1: sanitized rendering, PWA, Mermaid, autosave, SRI"
# -----------------------------------------------------------------------------

cd "$(dirname "$0")"
[ -f index.html ] || { echo "index.html not found. Put this script inside the SlideForge folder."; exit 1; }

echo "== Checking prerequisites =="
command -v git >/dev/null 2>&1 || { echo "git is not installed."; exit 1; }
command -v gh  >/dev/null 2>&1 || { echo "GitHub CLI is not installed: winget install --id GitHub.cli"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Not logged in to GitHub. Run: gh auth login"; exit 1; }
if [ -z "$(git config user.name || true)" ] || [ -z "$(git config user.email || true)" ]; then
    echo "Git doesn't know who you are yet. Run these two commands, then re-run this script:"
    echo '  git config --global user.name  "Your Name"'
    echo '  git config --global user.email "you@example.com"'
    exit 1
fi

GH_USER="$(gh api user --jq .login)"
echo "Logged in as: $GH_USER"

echo "== Tidying files downloaded individually =="
# Phone/browser downloads can't carry dotfiles or subfolders; restore them.
if [ ! -f .gitignore ] && [ -f gitignore.txt ]; then mv gitignore.txt .gitignore && echo "gitignore.txt -> .gitignore"; fi
if [ ! -f .github/dependabot.yml ] && [ -f dependabot.yml ]; then
    mkdir -p .github && mv dependabot.yml .github/dependabot.yml && echo "dependabot.yml -> .github/"
fi
if [ ! -d icons ]; then
    echo "WARNING: icons/ folder is missing. The app works, but it won't be installable until"
    echo "         icon-192.png, icon-512.png and icon-512-maskable.png are in icons/."
fi

echo "== Local git repo =="
if [ ! -d .git ]; then
    git init -b "$BRANCH"
else
    git checkout -B "$BRANCH" >/dev/null 2>&1 || true
fi

# Helper files from the chat are not part of the project.
git add -A -- . ':!codepen-html-panel.html' ':!publish-to-github.sh' ':!slideforge.zip' ':!icon-preview.png'
if git diff --cached --quiet; then
    echo "Nothing new to commit."
else
    git commit -m "$COMMIT_MESSAGE"
fi

echo "== GitHub repo =="
if gh repo view "$GH_USER/$REPO_NAME" >/dev/null 2>&1; then
    echo "$GH_USER/$REPO_NAME already exists; pushing to it."
    git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
else
    gh repo create "$REPO_NAME" "--$VISIBILITY" --description "$REPO_DESCRIPTION" --source=. --remote=origin
fi

echo "== Pushing =="
git push -u origin "$BRANCH"

echo "== Repo metadata =="
TOPIC_ARGS=()
IFS=',' read -ra TOPICS <<< "$REPO_TOPICS"
for t in "${TOPICS[@]}"; do TOPIC_ARGS+=(--add-topic "$t"); done
gh repo edit "$GH_USER/$REPO_NAME" --description "$REPO_DESCRIPTION" "${TOPIC_ARGS[@]}" \
    || echo "Could not set description/topics (the push itself succeeded)."

echo
echo "Done: https://github.com/$GH_USER/$REPO_NAME"
echo "Next: in Vercel, Add New > Project, import that repo, and deploy. No settings to change."
echo "Then add the live URL to the repo's website field (gh repo edit --homepage <url>)."
