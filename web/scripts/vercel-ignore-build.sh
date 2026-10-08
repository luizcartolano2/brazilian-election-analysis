#!/bin/sh
# Vercel's Ignored Build Step, run in web/: exit 0 skips the build, any other code builds.
# It compares against the branch's last successful deployment, so a push of several commits
# counts each one. When it cannot tell, it builds.
set -u

previous="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$previous" ]; then
  echo "No earlier deployment on this branch: building."
  exit 1
fi
# Vercel clones ten commits deep, so an older deployment's commit can be missing.
if ! git cat-file -e "${previous}^{commit}" 2>/dev/null; then
  echo "Commit ${previous} is not in the clone: building."
  exit 1
fi
if git diff --quiet "${previous}" HEAD -- .; then
  echo "Nothing under web/ changed since ${previous}: skipping the build."
  exit 0
fi
echo "web/ changed since ${previous}: building."
exit 1
