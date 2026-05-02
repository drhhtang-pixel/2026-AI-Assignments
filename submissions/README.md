# Submissions

This directory contains all student assignment submissions.

## Submission Directory Convention

Each student's submission lives at `submissions/<學號-姓名>/` (e.g., `submissions/M11234567-王小明/`).

**Required files per submission:**

| File | Description | Limit |
|------|-------------|-------|
| `thumbnail.png` | Screenshot of the assignment | ≤ 500 KB |
| `index.html` **(擇一)** | Static HTML assignment entry point; must include a `<title>` tag | — |
| `url.txt` **(擇一)** | External deployment URL (Vercel / Netlify / GitHub Pages); one `https://` URL on the first line | — |

`thumbnail.png` is always required. Include **either** `index.html` **or** `url.txt` — not necessarily both.

Additional assets (CSS, JS, images) may be placed inside the same directory alongside `index.html`.

## Branch Protection Setup

Enable branch protection on `main` so students cannot push directly and every PR requires your approval before merging.

**GitHub UI steps:**

1. Go to the repo → **Settings** → **Branches**.
2. Under "Branch protection rules", click **Add rule**.
3. In "Branch name pattern", type `main`.
4. Enable **Require a pull request before merging** → set "Required approving reviews" to **1**.
5. Under "Require status checks to pass before merging", enable it and search for **`validate-submission`** — add it as a required check.
6. Enable **Restrict who can push to matching branches** and leave the list empty (only admins can push directly).
7. Click **Save changes**.

After this setup:
- Students cannot push to `main` directly.
- A PR without your approval cannot be merged.
- A PR where the `validate-submission` check fails cannot be merged even with approval.

---

## Instructor Review Checklist

When reviewing a student PR, follow these steps in order:

1. Confirm the directory name follows the `<學號>-<姓名>` convention (no spaces, hyphen separator).
2. Open the student's `index.html` preview link (via the Netlify/Pages deploy preview or by downloading the file).
3. Verify `thumbnail.png` accurately represents the assignment and is ≤ 500 KB.
4. Check that the PR only touches files inside `submissions/<學號-姓名>/` — no edits to shared files.
5. Confirm the `validate-submission` status check is green.
6. Approve the PR and merge if all the above pass.
