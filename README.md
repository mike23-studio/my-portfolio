# Portfolio site

A static portfolio site with a working admin panel — hosted entirely on
GitHub Pages, no server, no paid database.

## How it works

- `index.html` — the public site. Reads `data/projects.json` and renders it.
- `admin.html` — a private-ish admin page. You log in with a GitHub token,
  then add/edit/delete/reorder projects and upload images. Every change is
  committed straight to this repo via the GitHub API.
- `data/projects.json` — this **is** the database. It's just a JSON file
  that lives in your repo and gets updated by commits.
- `assets/images/` — where uploaded project images land.

There's no real backend, so "login" means pasting in a GitHub Personal
Access Token (PAT) that's allowed to write to this one repo. The token is
stored only in your browser's `localStorage` — it is never written into any
file or committed. Don't use this admin page on a shared/public computer,
and don't share the URL with the token attached (there isn't one — you type
it in each time you log in on a new browser).

## 1. Set up the repo

1. Create a new **public** GitHub repository (Pages requires public on free
   plans, or you'll need GitHub Pro/Team for a private Pages site).
2. Open this folder in VS Code, then push it:
   ```bash
   git init
   git add .
   git commit -m "Initial portfolio"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. In the repo on GitHub: **Settings → Pages → Source → Deploy from a
   branch → `main` / root**. Save. Your site will be live in a minute or
   two at `https://YOUR_USERNAME.github.io/YOUR_REPO/`.

## 2. Generate your access token

1. On GitHub: **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.**
2. Set **Resource owner** to your account, and **Repository access →
   Only select repositories** → pick this repo only.
3. Under **Permissions → Repository permissions**, set **Contents** to
   **Read and write**. Leave everything else as No access.
4. Generate, copy the token (starts with `github_pat_...`), and keep it
   somewhere safe — GitHub only shows it once.
5. Give it an expiration you're comfortable with; you can always generate a
   new one later.

## 3. Log in to the admin panel

Go to `https://YOUR_USERNAME.github.io/YOUR_REPO/admin.html` and enter:

- **Repo owner** — your GitHub username
- **Repository name** — the repo you created
- **Branch** — `main` (or whatever you deployed Pages from)
- **Token** — the one you just generated

From there you can add projects, upload a cover image for each, write a
description, add tags, link to the live site and source repo, and
drag-reorder cards — every action commits automatically and the public
site updates within a minute or so (GitHub Pages rebuild time).

## 4. Customize

- Replace "Your Name" and the intro copy in `index.html`.
- Swap the accent color / fonts in `css/style.css` (`:root` variables at
  the top).
- The two example projects in `data/projects.json` are placeholders —
  delete them from the admin panel once you've added real ones.
- Fonts are loaded from Google Fonts (Fraunces, Inter, JetBrains Mono); swap
  the `<link>` tags in the `<head>` of both HTML files if you want
  different ones.

## Notes / limits

- Images are committed directly into the repo, so keep them reasonably
  sized (a few hundred KB each) — this isn't meant for huge galleries.
- Because writes go through the GitHub API from the browser, only whoever
  has the token can edit. Anyone can view the public site.
- If you ever want a "real" backend later (multi-user auth, bigger media,
  etc.), the natural upgrade path is swapping `data/projects.json` for a
  proper database and a small API — but for a personal portfolio this
  git-backed approach is genuinely enough.
