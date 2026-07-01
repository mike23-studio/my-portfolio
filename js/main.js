document.getElementById("year").textContent = new Date().getFullYear();

const grid = document.getElementById("grid");
const logCount = document.getElementById("log-count");
const terminalCount = document.getElementById("terminal-count");

const modalBackdrop = document.getElementById("modal-backdrop");
const modalClose = document.getElementById("modal-close");
const modalImageWrap = document.getElementById("modal-image-wrap");
const modalTitle = document.getElementById("modal-title");
const modalTagline = document.getElementById("modal-tagline");
const modalDescription = document.getElementById("modal-description");
const modalTags = document.getElementById("modal-tags");
const modalLinks = document.getElementById("modal-links");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function shortHash(str) {
  // deterministic fake-commit-hash from the project id, purely decorative
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 7).padEnd(7, "0");
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} yr ago`;
}

function renderCard(project) {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `View details for ${project.title}`);

  card.innerHTML = `
    <div class="card-image">
      ${project.image ? `<img src="${escapeHtml(project.image)}" alt="${escapeHtml(project.title)} preview" loading="lazy" />` : `<span>// no preview image</span>`}
    </div>
    <div class="card-body">
      <h3>${escapeHtml(project.title)}</h3>
      <p class="tagline">${escapeHtml(project.tagline || "")}</p>
      <div class="tags">
        ${(project.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
      </div>
      <div class="commit-line">
        <span class="hash">#${shortHash(project.id || project.title)}</span>
        <span>${timeAgo(project.date)}</span>
      </div>
    </div>
  `;

  const open = () => openModal(project);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });

  return card;
}

function openModal(project) {
  modalImageWrap.innerHTML = project.image
    ? `<img src="${escapeHtml(project.image)}" alt="${escapeHtml(project.title)} preview" />`
    : "";
  modalTitle.textContent = project.title;
  modalTagline.textContent = project.tagline || "";
  modalDescription.textContent = project.description || "No description yet.";
  modalTags.innerHTML = (project.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");

  const links = [];
  if (project.liveUrl) links.push(`<a class="btn btn-primary" href="${escapeHtml(project.liveUrl)}" target="_blank" rel="noopener">view live ↗</a>`);
  if (project.repoUrl) links.push(`<a class="btn" href="${escapeHtml(project.repoUrl)}" target="_blank" rel="noopener">source ↗</a>`);
  modalLinks.innerHTML = links.join("");

  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  modalClose.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalBackdrop.hidden) closeModal();
});

async function loadProjects() {
  try {
    const res = await fetch(`data/projects.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Could not load project data (${res.status})`);
    const projects = await res.json();

    const sorted = [...projects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (sorted.length === 0) {
      grid.innerHTML = `<div class="empty-state">No projects published yet. Head to <a href="admin.html">/admin</a> to add your first one.</div>`;
      logCount.textContent = "";
      terminalCount.textContent = "0 commits — nothing published yet";
      return;
    }

    grid.innerHTML = "";
    sorted.forEach(p => grid.appendChild(renderCard(p)));
    logCount.textContent = `${sorted.length} project${sorted.length === 1 ? "" : "s"}`;
    terminalCount.textContent = `${sorted.length} project${sorted.length === 1 ? "" : "s"} published`;
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Couldn't load projects.json — ${escapeHtml(err.message)}</div>`;
    terminalCount.textContent = "error loading history";
  }
}

loadProjects();
