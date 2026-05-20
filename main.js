let tasks = JSON.parse(localStorage.getItem("tick_tasks") || "[]");
let filter = "all";
let sort = "created";
let search = "";
let selectedPriority = "low";
let selectedIds = new Set();
let editingId = null;

const now = new Date();
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
document.getElementById("dayDisplay").textContent =
  days[now.getDay()].toUpperCase();
document.getElementById("dateDisplay").textContent =
  `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

const save = () => localStorage.setItem("tick_tasks", JSON.stringify(tasks));
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function getPriWeight(p) {
  return p === "high" ? 3 : p === "med" ? 2 : 1;
}

function dueCls(due) {
  if (!due) return "";
  const todayStr = today();
  if (due < todayStr) return "overdue";

  const [y, mo, d] = due.split("-").map(Number);
  const dueDate = new Date(y, mo - 1, d);
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const diff = (dueDate - todayDate) / 86400000;
  if (diff < 2) return "soon";
  return "";
}

function dueIcon(due) {
  if (!due) return "";
  const cls = dueCls(due);
  if (cls === "overdue") return "⚠ ";
  if (cls === "soon") return "◷ ";
  return "◷ ";
}

function getVisible() {
  const todayStr = today();
  return tasks
    .filter((t) => {
      if (filter === "active") return !t.done;
      if (filter === "done") return t.done;
      if (filter === "today") return t.due === todayStr;
      if (filter === "overdue") return t.due && t.due < todayStr && !t.done;
      return true;
    })
    .filter((t) => {
      if (!search) return true;
      return (
        t.text.toLowerCase().includes(search) ||
        (t.tag || "").toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      if (sort === "priority")
        return getPriWeight(b.priority) - getPriWeight(a.priority);
      if (sort === "due") {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      }
      if (sort === "alpha") return a.text.localeCompare(b.text);
      return b.created - a.created;
    });
}

function updateStats() {
  const todayStr = today();
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const overdue = tasks.filter(
    (t) => t.due && t.due < todayStr && !t.done,
  ).length;
  const todayT = tasks.filter((t) => t.due === todayStr).length;
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statDone").textContent = done;
  document.getElementById("statOverdue").textContent = overdue;
  document.getElementById("statToday").textContent = todayT;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("progressPct").textContent = pct + "%";
  document.getElementById("progressFill").style.width = pct + "%";
  const remaining = tasks.filter((t) => !t.done).length;
  document.getElementById("footerCount").textContent =
    `${remaining} task${remaining !== 1 ? "s" : ""} remaining`;
}

function render() {
  updateStats();
  const visible = getVisible();
  const list = document.getElementById("taskList");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";

  if (visible.length === 0) {
    empty.classList.add("visible");
  } else {
    empty.classList.remove("visible");
  }

  const active = visible.filter((t) => !t.done);
  const done = visible.filter((t) => t.done);

  function renderTask(t) {
    const item = document.createElement("div");
    item.className =
      "task-item" +
      (t.done ? " done" : "") +
      (selectedIds.has(t.id) ? " selected" : "");
    item.dataset.id = t.id;

    const dc = dueCls(t.due);
    const dueHtml = t.due
      ? `<span class="task-due ${dc}">${dueIcon(t.due)}${t.due}</span>`
      : "";
    const tagHtml = t.tag
      ? t.tag
          .split(" ")
          .filter(Boolean)
          .map((g) => `<span class="task-tag">${escHtml(g)}</span>`)
          .join("")
      : "";
    const priHtml = `<span class="task-pri ${t.priority}">${t.priority}</span>`;
    const createdDate = new Date(t.created).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    item.innerHTML = `
        <div class="task-check" title="Toggle done"><span class="checkmark">✓</span></div>
        <div class="task-body">
          <div class="task-text">${escHtml(t.text)}</div>
          <div class="task-details">
            ${priHtml}
            ${tagHtml}
            ${dueHtml}
            <span class="task-created">${createdDate}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action-btn edit-btn" title="Edit">✎</button>
          <button class="task-action-btn del" title="Delete">✕</button>
        </div>
      `;

    item.querySelector(".task-check").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDone(t.id);
    });

    item.querySelector(".del").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(t.id, item);
    });

    item.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      startEdit(t.id, item, t.text);
    });

    item.querySelector(".task-body").addEventListener("click", (e) => {
      e.stopPropagation();
      if (editingId === t.id) return;
      if (selectedIds.has(t.id)) {
        selectedIds.delete(t.id);
        item.classList.remove("selected");
      } else {
        selectedIds.add(t.id);
        item.classList.add("selected");
      }
      updateBulkBar();
    });

    list.appendChild(item);
  }

  if (filter === "all") {
    active.forEach(renderTask);
    if (done.length && active.length) {
      const div = document.createElement("div");
      div.className = "section-divider";
      div.innerHTML = `<div class="section-divider-line"></div><span class="section-title">Completed</span><div class="section-divider-line"></div>`;
      list.appendChild(div);
    }
    done.forEach(renderTask);
  } else {
    visible.forEach(renderTask);
  }

  updateBulkBar();
}

function escHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function addTask() {
  const input = document.getElementById("taskInput");
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  const isDuplicate = tasks.some(
    (t) => t.text.toLowerCase() === text.toLowerCase(),
  );
  if (isDuplicate) {
    input.classList.add("input-shake");
    setTimeout(() => input.classList.remove("input-shake"), 500);
    toast("⚠ Task already exists");
    return;
  }

  const tag = document.getElementById("tagInput").value.trim();
  const due = document.getElementById("dueInput").value;

  tasks.unshift({
    id: uid(),
    text,
    done: false,
    priority: selectedPriority,
    tag,
    due,
    created: Date.now(),
  });

  input.value = "";
  document.getElementById("tagInput").value = "";
  document.getElementById("dueInput").value = "";
  save();
  render();
  toast("Task added ✓");
}

function toggleDone(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  save();
  render();
}

function deleteTask(id, el) {
  el.classList.add("removing");
  setTimeout(() => {
    tasks = tasks.filter((x) => x.id !== id);
    selectedIds.delete(id);
    save();
    render();
  }, 250);
  toast("Task removed");
}

function startEdit(id, item, currentText) {
  if (editingId && editingId !== id) cancelEdit();
  editingId = id;
  item.classList.add("editing");
  const body = item.querySelector(".task-body");
  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "edit-input";
  inp.value = currentText;
  const hint = document.createElement("div");
  hint.className = "edit-hint";
  hint.textContent = "Enter to save · Esc to cancel";
  body.prepend(hint);
  body.prepend(inp);
  inp.focus();
  inp.select();

  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commitEdit(id, inp.value, item, inp, hint);
    if (e.key === "Escape") cancelEdit(item, inp, hint);
  });

  inp.addEventListener("blur", () => {
    setTimeout(() => commitEdit(id, inp.value, item, inp, hint), 150);
  });
}

function commitEdit(id, val, item, inp, hint) {
  if (!editingId) return;
  editingId = null;
  const text = val.trim();
  if (text) {
    const t = tasks.find((x) => x.id === id);

    const isDuplicate = tasks.some(
      (x) => x.id !== id && x.text.toLowerCase() === text.toLowerCase(),
    );
    if (isDuplicate) {
      toast("⚠ A task with that name already exists");
    } else if (t) {
      t.text = text;
      save();
    }
  }
  inp && inp.remove();
  hint && hint.remove();
  item && item.classList.remove("editing");
  render();
}

function cancelEdit(item, inp, hint) {
  editingId = null;
  inp && inp.remove();
  hint && hint.remove();
  item && item.classList.remove("editing");
}

function updateBulkBar() {
  const bar = document.getElementById("bulkBar");
  const cnt = selectedIds.size;
  document.getElementById("bulkCount").textContent = `${cnt} selected`;
  bar.classList.toggle("visible", cnt > 0);
}

document.getElementById("bulkDeselect").addEventListener("click", () => {
  selectedIds.clear();
  render();
});

document.getElementById("bulkComplete").addEventListener("click", () => {
  selectedIds.forEach((id) => {
    const t = tasks.find((x) => x.id === id);
    if (t) t.done = true;
  });
  selectedIds.clear();
  save();
  render();
  toast("Marked complete");
});

document.getElementById("bulkDelete").addEventListener("click", () => {
  tasks = tasks.filter((x) => !selectedIds.has(x.id));
  selectedIds.clear();
  save();
  render();
  toast("Deleted selected");
});

document.getElementById("addBtn").addEventListener("click", addTask);
document.getElementById("taskInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
});

document.querySelectorAll(".pri-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".pri-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedPriority = btn.dataset.p;
  });
});

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.f;
    render();
  });
});

document.querySelectorAll(".sort-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".sort-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    sort = btn.dataset.s;
    render();
  });
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  search = e.target.value.toLowerCase().trim();
  render();
});

document.getElementById("clearDoneBtn").addEventListener("click", () => {
  const n = tasks.filter((t) => t.done).length;
  if (!n) return;
  tasks = tasks.filter((t) => !t.done);
  save();
  render();
  toast(`Cleared ${n} completed task${n > 1 ? "s" : ""}`);
});

document.addEventListener("keydown", (e) => {
  if (
    e.key === "n" &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    document.getElementById("taskInput").focus();
  }
});

render();
