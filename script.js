/* global document, localStorage */
(() => {
  const STORAGE_KEY = "todo_app_v1";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const nowIso = () => new Date().toISOString();
  const fmt = (iso) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(d);
    } catch {
      return iso;
    }
  };
  const uid = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `t_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`;
  };

  /** @type {{id:string,title:string,done:boolean,createdAt:string,updatedAt:string}[]} */
  let tasks = [];
  let filter = "all"; // all | active | done
  let query = "";
  let editingId = null;

  const el = {
    addForm: $("[data-add-form]"),
    addInput: $("[data-add-form] input[name='title']"),
    bucketActive: $("[data-bucket-active]"),
    bucketDone: $("[data-bucket-done]"),
    listActive: $("[data-list-active]"),
    listDone: $("[data-list-done]"),
    emptyAll: $("[data-empty-all]"),
    emptyActive: $("[data-empty-active]"),
    emptyDone: $("[data-empty-done]"),
    listCaption: $("[data-list-caption]"),
    bucketActiveCount: $("[data-bucket-active-count]"),
    bucketDoneCount: $("[data-bucket-done-count]"),
    statTotal: $("[data-stat-total]"),
    statActive: $("[data-stat-active]"),
    statDone: $("[data-stat-done]"),
    segs: $$("[data-filter]"),
    search: $("[data-search]"),
    clearDone: $("[data-clear-done]"),
    clearAll: $("[data-clear-all]"),
    modal: $("[data-edit-modal]"),
    editForm: $("[data-edit-form]"),
    editInput: $("[data-edit-form] input[name='title']"),
    editCancel: $("[data-edit-cancel]"),
    toast: $("[data-toast]"),
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      tasks = parsed
        .filter((t) => t && typeof t.id === "string")
        .map((t) => ({
          id: t.id,
          title: typeof t.title === "string" ? t.title : "",
          done: Boolean(t.done),
          createdAt: typeof t.createdAt === "string" ? t.createdAt : nowIso(),
          updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : nowIso(),
        }))
        .filter((t) => t.title.trim().length > 0);
    } catch {
      // ignore
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function toast(msg) {
    if (!el.toast) return;
    el.toast.hidden = false;
    el.toast.textContent = msg;
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => {
      el.toast.hidden = true;
    }, 1600);
  }

  function setFilter(next) {
    filter = next;
    for (const btn of el.segs) {
      btn.setAttribute("aria-selected", btn.dataset.filter === filter ? "true" : "false");
    }
    render();
  }

  function setQuery(q) {
    query = (q || "").trim().toLowerCase();
    render();
  }

  function stats() {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const active = total - done;
    el.statTotal.textContent = String(total);
    el.statActive.textContent = String(active);
    el.statDone.textContent = String(done);
  }

  function getVisibleTasks() {
    let items = tasks.slice();
    if (query) items = items.filter((t) => t.title.toLowerCase().includes(query));

    const byUpdatedDesc = (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    const active = items.filter((t) => !t.done).sort(byUpdatedDesc);
    const done = items.filter((t) => t.done).sort(byUpdatedDesc);

    if (filter === "active") return { active, done: [] };
    if (filter === "done") return { active: [], done };
    return { active, done };
  }

  function render() {
    stats();
    const visible = getVisibleTasks();
    const totalVisible = visible.active.length + visible.done.length;
    el.listCaption.textContent = `${totalVisible} task`;

    el.bucketActiveCount.textContent = `${visible.active.length}`;
    el.bucketDoneCount.textContent = `${visible.done.length}`;

    el.emptyAll.hidden = totalVisible !== 0;
    el.emptyActive.hidden = visible.active.length !== 0;
    el.emptyDone.hidden = visible.done.length !== 0;

    el.bucketActive.hidden = filter === "done";
    el.bucketDone.hidden = filter === "active";

    el.listActive.innerHTML = "";
    el.listDone.innerHTML = "";

    const fragA = document.createDocumentFragment();
    for (const t of visible.active) fragA.appendChild(renderItem(t));
    el.listActive.appendChild(fragA);

    const fragD = document.createDocumentFragment();
    for (const t of visible.done) fragD.appendChild(renderItem(t));
    el.listDone.appendChild(fragD);
  }

  function renderItem(t) {
    const li = document.createElement("li");
    li.className = `item${t.done ? " done" : ""}`;
    li.dataset.id = t.id;

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check";
    check.ariaLabel = t.done ? "Bỏ hoàn thành" : "Đánh dấu hoàn thành";
    check.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 7L10 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
    check.addEventListener("click", () => toggleDone(t.id));

    const content = document.createElement("div");
    content.className = "content";

    const titleLine = document.createElement("div");
    titleLine.className = "title-line";

    const title = document.createElement("div");
    title.className = "task-title";
    title.title = t.title;
    title.textContent = t.title;
    title.addEventListener("dblclick", () => openEdit(t.id));

    const pill = document.createElement("span");
    pill.className = `pill ${t.done ? "ok" : "warn"}`;
    pill.textContent = t.done ? "Done" : "Doing";

    titleLine.appendChild(title);
    titleLine.appendChild(pill);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Cập nhật: ${fmt(t.updatedAt)}`;

    content.appendChild(titleLine);
    content.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-btn";
    editBtn.ariaLabel = "Sửa task";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", () => openEdit(t.id));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-btn danger";
    delBtn.ariaLabel = "Xóa task";
    delBtn.textContent = "🗑";
    delBtn.addEventListener("click", () => removeTask(t.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(check);
    li.appendChild(content);
    li.appendChild(actions);
    return li;
  }

  function addTask(title) {
    const clean = (title || "").trim();
    if (!clean) return;
    const t = { id: uid(), title: clean, done: false, createdAt: nowIso(), updatedAt: nowIso() };
    tasks.unshift(t);
    save();
    render();
    toast("Đã thêm task");
  }

  function toggleDone(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.updatedAt = nowIso();
    save();
    render();
  }

  function removeTask(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const ok = window.confirm(`Xóa task "${t.title}"?`);
    if (!ok) return;
    tasks = tasks.filter((x) => x.id !== id);
    save();
    render();
    toast("Đã xóa task");
  }

  function clearDone() {
    const doneCount = tasks.filter((t) => t.done).length;
    if (doneCount === 0) return toast("Không có task done để xóa");
    const ok = window.confirm(`Xóa ${doneCount} task đã hoàn thành?`);
    if (!ok) return;
    tasks = tasks.filter((t) => !t.done);
    save();
    render();
    toast("Đã clear done");
  }

  function clearAll() {
    if (tasks.length === 0) return toast("Danh sách đang trống");
    const ok = window.confirm("Xóa toàn bộ task?");
    if (!ok) return;
    tasks = [];
    save();
    render();
    toast("Đã xóa tất cả");
  }

  function openEdit(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    editingId = id;
    el.editInput.value = t.title;
    if (typeof el.modal.showModal === "function") {
      el.modal.showModal();
      window.setTimeout(() => el.editInput.focus(), 0);
      el.editInput.select();
    } else {
      const next = window.prompt("Sửa task:", t.title);
      if (next == null) return;
      commitEdit(next);
    }
  }

  function closeEdit() {
    editingId = null;
    if (el.modal.open) el.modal.close();
  }

  function commitEdit(nextTitle) {
    const id = editingId;
    if (!id) return;
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const clean = (nextTitle || "").trim();
    if (!clean) return toast("Task không được để trống");
    t.title = clean;
    t.updatedAt = nowIso();
    save();
    render();
    toast("Đã lưu");
  }

  // Events
  el.addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = el.addInput.value;
    addTask(title);
    el.addInput.value = "";
    el.addInput.focus();
  });

  for (const btn of el.segs) {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter));
  }

  el.search.addEventListener("input", (e) => setQuery(e.target.value));
  el.clearDone.addEventListener("click", clearDone);
  el.clearAll.addEventListener("click", clearAll);

  el.editCancel.addEventListener("click", () => closeEdit());
  el.modal.addEventListener("close", () => {
    if (el.modal.returnValue === "cancel") {
      editingId = null;
    }
  });
  el.editForm.addEventListener("submit", (e) => {
    e.preventDefault();
    commitEdit(el.editInput.value);
    closeEdit();
  });

  // Modal keyboard niceties
  el.modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      editingId = null;
    }
  });

  // Seed (optional) if empty
  load();
  if (tasks.length === 0) {
    tasks = [
      { id: uid(), title: "Thêm task mới ở ô phía trên", done: false, createdAt: nowIso(), updatedAt: nowIso() },
      { id: uid(), title: "Double‑click để sửa task", done: false, createdAt: nowIso(), updatedAt: nowIso() },
      { id: uid(), title: "Đánh dấu Done và thử Clear done", done: true, createdAt: nowIso(), updatedAt: nowIso() },
    ];
    save();
  }
  render();
})();

