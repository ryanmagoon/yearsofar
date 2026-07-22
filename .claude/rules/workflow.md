# Workflow

The agent writes the code; Ryan reviews it. PRs are the review surface — not
ceremony. Direct pushes to main skip the only validation layer this project
has.

- **Every change goes through a branch and PR.** Branch from latest main,
  granular commits, push immediately. Never push to main directly (branch
  protection enforces this).
- **PR descriptions document the work and carry evidence.** What changed and
  why, test results, and proof the change works: screenshots for anything
  visual (UI states, OG images, both themes when styling changed), curl output
  or logs for API behavior, before/after for bug fixes. If a reviewer can't
  see the result in the PR, the PR isn't done.
- **Vercel preview deployments are the validation environment.** Verify the
  change on the preview URL before requesting review — production deploys only
  on merge.
- **Wait for Ryan's review before merging** unless he explicitly says to
  merge. Squash merge (`gh pr merge --squash`).
