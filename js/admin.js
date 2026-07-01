const LS_KEY = "portfolio_admin_session";
const DATA_PATH = "data/projects.json";

const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");
const loginError = document.getElementById("login-error");
const repoLabel = document.getElementById("repo-label");
const statusPill = document.getElementById("status-pill");

const projectList = document.getElementById("project-list");
const projectCount = document.getElementById("project-count");
const form = document.getElementById("project-form");
const formHeading = document.getElementById("form-heading");
const formError = document.getElementById("form-error");
const imagePreview = document.getElementById("image-preview");

let session = null;       // { owner, repo, branch, token }
let projects = [];        // current in-memory project list
let dataSha = null;       // sha of data/projects.json, needed to update it
let editingId = null;     // id of project currently loaded in the form
let pendingImageFile = null;

// ---------------------------------------------------------------
// SESSION / LOGIN
// ---------------------------------------------------------------

function loadSession() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveSession(s) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function clearSession() {
  localStorage.removeItem(LS_KEY);
  session = null;
}

document.getElementById("btn-connect").addEventListener("click", async () => {
  const owner = document.getElementById("f-owner").value.trim();
  const repo = document.getElementById("f-repo").value.trim();
  const branch = document.getElementById("f-branch").value.trim() || "main";
  const token = document.getElementById("f-token").value.trim();

  loginError.hidden = true;

  if (!owner || !repo || !token) {
    loginError.textContent = "Fill in owner, repo, and token.";
    loginError.hidden = false;
    return;
  }

  const candidate = { owner, repo, branch, token };
  const ok = await verifySession(candidate);
  if (!ok.success) {
    loginError.textContent = ok.message;
    loginError.hidden = false;
    return;
  }

  session = candidate;
  saveSession(candidate);
  enterAdmin();
});

document.getElementById("btn-logout").addEventListener("click", () => {
  clearSession();
  location.reload();
});

async function verifySession(s) {
  try {
    const res = await fetch(`https://api.github.com/repos/${s.owner}/${s.repo}`, {
      headers: authHeaders(s.token)
    });
    if (res.status === 404) return { success: false, message: "Repo not found — check owner/repo name." };
    if (res.status === 401) return { success: false, message: "Token rejected — check it's valid and not expired." };
    if (!res.ok) return { success: false, message: `GitHub returned ${res.status}.` };
    return { success: true };
  } catch (e) {
    return { success: false, message: "Network error reaching GitHub API." };
  }
}

function authHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json"
  };
}

async function enterAdmin() {
  loginView.hidden = true;
  adminView.hidden = false;
  repoLabel.textContent = `${session.owner}/${session.repo} @ ${session.branch}`;
  await refreshProjects();
}

// ---------------------------------------------------------------
// STATUS PILL
// ---------------------------------------------------------------

function setStatus(state, text) {
  statusPill.className = `status-pill ${state}`;
  statusPill.textContent = text;
}

// ---------------------------------------------------------------
// LOAD / SAVE projects.json
// ---------------------------------------------------------------

async function refreshProjects() {
  setStatus("saving", "loading…");
  try {
    const res = await fetch(
      `https://api.github.com/repos/${session.owner}/${session.repo}/contents/${DATA_PATH}?ref=${session.branch}`,
      { headers: authHeaders(session.token) }
    );

    if (res.status === 404) {
      // file doesn't exist yet — start empty, it'll be created on first save
      projects = [];
      dataSha = null;
      setStatus("idle", "no data file yet");
      renderList();
      return;
    }
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);

    const json = await res.json();
    dataSha = json.sha;
    const decoded = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ""))));
    projects = JSON.parse(decoded || "[]");
    projects.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setStatus("saved", "up to date");
    renderList();
  } catch (e) {
    setStatus("error", "load failed");
    projectList.innerHTML = `<p class="error-msg">Couldn't load projects: ${e.message}</p>`;
  }
}

async function commitProjects(message) {
  setStatus("saving", "saving…");
  // re-normalize order 1..n before every save
  projects.forEach((p, i) => { p.order = i + 1; });

  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(projects, null, 2)))),
    branch: session.branch
  };
  if (dataSha) body.sha = dataSha;

  const res = await fetch(
    `https://api.github.com/repos/${session.owner}/${session.repo}/contents/${DATA_PATH}`,
    {
      method: "PUT",
      headers: { ...authHeaders(session.token), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    setStatus("error", "save failed");
    throw new Error(err.message || `GitHub returned ${res.status}`);
  }

  const json = await res.json();
  dataSha = json.content.sha;
  setStatus("saved", "saved");
  renderList();
}

async function uploadImage(file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const slug = (document.getElementById("f-title").value || "project")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const path = `assets/images/${slug || "project"}-${Date.now()}.${ext}`;

  const base64 = await fileToBase64(file);

  const res = await fetch(
    `https://api.github.com/repos/${session.owner}/${session.repo}/contents/${path}`,
    {
      method: "PUT",
      headers: { ...authHeaders(session.token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add image for ${slug}`,
        content: base64,
        branch: session.branch
      })
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Image upload failed (${res.status})`);
  }

  return path; // relative path stored on the project, used directly as <img src>
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------
// PROJECT LIST (left panel, drag to reorder)
// ---------------------------------------------------------------

function renderList() {
  projectCount.textContent = `(${projects.length})`;
  if (projects.length === 0) {
    projectList.innerHTML = `<p class="field-hint">No projects yet — add your first one.</p>`;
    return;
  }

  projectList.innerHTML = "";
  projects.forEach((p) => {
    const row = document.createElement("div");
    row.className = "project-row";
    row.draggable = true;
    row.dataset.id = p.id;
    row.innerHTML = `
      <span class="grip">⠿</span>
      <span class="row-title">${escapeHtml(p.title)}</span>
      <div class="row-actions">
        <button class="icon-btn" data-action="edit" title="Edit">✎</button>
        <button class="icon-btn" data-action="delete" title="Delete">✕</button>
      </div>
    `;

    row.addEventListener("dragstart", () => row.classList.add("dragging"));
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      persistOrderFromDOM();
    });

    row.querySelector('[data-action="edit"]').addEventListener("click", () => loadIntoForm(p.id));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteProject(p.id));

    projectList.appendChild(row);
  });
}

projectList.addEventListener("dragover", (e) => {
  e.preventDefault();
  const dragging = projectList.querySelector(".dragging");
  if (!dragging) return;
  const after = getRowAfter(projectList, e.clientY);
  if (after == null) {
    projectList.appendChild(dragging);
  } else {
    projectList.insertBefore(dragging, after);
  }
});

function getRowAfter(container, y) {
  const rows = [...container.querySelectorAll(".project-row:not(.dragging)")];
  return rows.reduce((closest, row) => {
    const box = row.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: row };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

async function persistOrderFromDOM() {
  const ids = [...projectList.querySelectorAll(".project-row")].map(r => r.dataset.id);
  const reordered = ids.map(id => projects.find(p => p.id === id)).filter(Boolean);
  projects = reordered;
  try {
    await commitProjects("Reorder projects");
  } catch (e) {
    formError.textContent = e.message;
    formError.hidden = false;
  }
}

// ---------------------------------------------------------------
// FORM (right panel)
// ---------------------------------------------------------------

document.getElementById("f-image-file").addEventListener("change", (e) => {
  pendingImageFile = e.target.files[0] || null;
  if (pendingImageFile) {
    const reader = new FileReader();
    reader.onload = () => { imagePreview.innerHTML = `<img src="${reader.result}" alt="preview" />`; };
    reader.readAsDataURL(pendingImageFile);
  }
});

document.getElementById("btn-new").addEventListener("click", () => resetForm());
document.getElementById("btn-cancel").addEventListener("click", () => resetForm());

function resetForm() {
  editingId = null;
  pendingImageFile = null;
  form.reset();
  imagePreview.innerHTML = "no image selected";
  formHeading.textContent = "New project";
  document.getElementById("btn-delete").hidden = true;
  formError.hidden = true;
}

function loadIntoForm(id) {
  const p = projects.find(p => p.id === id);
  if (!p) return;
  editingId = id;
  pendingImageFile = null;
  formHeading.textContent = `Edit — ${p.title}`;
  document.getElementById("f-title").value = p.title || "";
  document.getElementById("f-tagline").value = p.tagline || "";
  document.getElementById("f-description").value = p.description || "";
  document.getElementById("f-tags").value = (p.tags || []).join(", ");
  document.getElementById("f-live").value = p.liveUrl || "";
  document.getElementById("f-repo-url").value = p.repoUrl || "";
  document.getElementById("f-date").value = p.date || "";
  imagePreview.innerHTML = p.image ? `<img src="${p.image}" alt="current image" />` : "no image selected";
  document.getElementById("btn-delete").hidden = false;
  formError.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;

  const title = document.getElementById("f-title").value.trim();
  if (!title) {
    formError.textContent = "Title is required.";
    formError.hidden = false;
    return;
  }

  const btnSave = document.getElementById("btn-save");
  btnSave.disabled = true;

  try {
    let imagePath = editingId ? (projects.find(p => p.id === editingId)?.image || "") : "";
    if (pendingImageFile) {
      setStatus("saving", "uploading image…");
      imagePath = await uploadImage(pendingImageFile);
    }

    const tags = document.getElementById("f-tags").value
      .split(",").map(t => t.trim()).filter(Boolean);

    const payload = {
      id: editingId || slugify(title) + "-" + Date.now(),
      title,
      tagline: document.getElementById("f-tagline").value.trim(),
      description: document.getElementById("f-description").value.trim(),
      tags,
      image: imagePath,
      liveUrl: document.getElementById("f-live").value.trim(),
      repoUrl: document.getElementById("f-repo-url").value.trim(),
      date: document.getElementById("f-date").value || new Date().toISOString().slice(0, 10)
    };

    if (editingId) {
      const idx = projects.findIndex(p => p.id === editingId);
      payload.order = projects[idx].order;
      projects[idx] = payload;
    } else {
      payload.order = projects.length + 1;
      projects.push(payload);
    }

    await commitProjects(editingId ? `Update project: ${title}` : `Add project: ${title}`);
    resetForm();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
    setStatus("error", "save failed");
  } finally {
    btnSave.disabled = false;
  }
});

document.getElementById("btn-delete").addEventListener("click", () => {
  if (editingId) deleteProject(editingId);
});

async function deleteProject(id) {
  const p = projects.find(p => p.id === id);
  if (!p) return;
  if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;

  projects = projects.filter(p => p.id !== id);
  try {
    await commitProjects(`Delete project: ${p.title}`);
    if (editingId === id) resetForm();
  } catch (e) {
    formError.textContent = e.message;
    formError.hidden = false;
  }
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------

(function boot() {
  const existing = loadSession();
  if (existing) {
    session = existing;
    document.getElementById("f-owner").value = existing.owner;
    document.getElementById("f-repo").value = existing.repo;
    document.getElementById("f-branch").value = existing.branch;
    verifySession(existing).then(ok => {
      if (ok.success) enterAdmin();
    });
  }
})();
