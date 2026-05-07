# Submissions

This directory contains all student assignment submissions.

## Submission Directory Convention

Each student's submission lives at `submissions/<學號-姓名>/` (e.g., `submissions/M11234567-王小明/`).

**Required files per submission:**

| File | Description | Limit |
|------|-------------|-------|
| `thumbnail.png` *(建議)* 或 `thumbnail.jpg` | 作業截圖（PNG 較佳，JPG 亦可） | ≤ 500 KB |
| `index.html` **(擇一)** | Static HTML assignment entry point; must include a `<title>` tag | — |
| `url.txt` **(擇一)** | External deployment URL (Vercel / Netlify / GitHub Pages) | — |

截圖必填（`thumbnail.png` 或 `thumbnail.jpg`）。作業主檔選 **`index.html`** 或 **`url.txt`** 其中一個即可。

Additional assets (CSS, JS, images) may be placed inside the same directory alongside `index.html`.

### url.txt 格式

```
https://your-app.vercel.app
作品標題（選填，顯示於 gallery 卡片）
```

- **第一行**：`https://` 開頭的完整網址（必填）
- 按 Enter 換行
- **第二行**：作品標題（選填；沒有填則顯示目錄名稱）

### thumbnail 格式

- 建議使用 **PNG**（`thumbnail.png`）：畫質較好、壓縮率高
- 亦接受 **JPG**（`thumbnail.jpg` 或 `thumbnail.jpeg`），CI 會顯示提醒但不擋關
- 檔名大小寫需完全一致

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
