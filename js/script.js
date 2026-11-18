(function () {
  "use strict";

  const STORAGE_KEY = "studyspace.tasks.v1";
  const taskList = document.getElementById("task-list");
  const deadlineList = document.getElementById("deadline-list");
  const modal = document.getElementById("task-modal");
  const form = document.getElementById("task-form");
  const sidebar = document.getElementById("sidebar");
  const searchInput = document.getElementById("task-search");
  const subjectFilter = document.getElementById("subject-filter");
  const statusFilter = document.getElementById("status-filter");
  const today = startOfDay(new Date());
  let activeView = "overview";
  let toastTimer;
  let lastFocusedElement;

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(days) {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return date;
  }

  function dateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function createStarterTasks() {
    return [
      { id: createId(), title: "Complete algebra practice set", subject: "Mathematics", description: "Finish questions 1–12 from the practice worksheet.", dueDate: dateString(addDays(1)), status: "In Progress", createdAt: Date.now() - 3 },
      { id: createId(), title: "Read chapter 6: Ecosystems", subject: "Biology", description: "Take notes on food webs and energy transfer.", dueDate: dateString(addDays(2)), status: "Pending", createdAt: Date.now() - 2 },
      { id: createId(), title: "Write a short story analysis", subject: "English", description: "Choose a story and write a one-page analysis.", dueDate: dateString(addDays(4)), status: "Pending", createdAt: Date.now() - 1 },
      { id: createId(), title: "Review the French vocabulary list", subject: "French", description: "Practice the words from this week's lesson.", dueDate: dateString(addDays(6)), status: "Completed", createdAt: Date.now() }
    ];
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function loadTasks() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) {
        const starterTasks = createStarterTasks();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(starterTasks));
        return starterTasks;
      }
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Saved tasks are not a list.");
      return parsed.filter((task) =>
        task && typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.subject === "string" &&
        typeof task.dueDate === "string" &&
        ["Pending", "In Progress", "Completed"].includes(task.status)
      ).map((task) => ({
        id: task.id,
        title: task.title,
        subject: task.subject,
        description: typeof task.description === "string" ? task.description : "",
        dueDate: task.dueDate,
        status: task.status,
        createdAt: Number(task.createdAt) || Date.now()
      }));
    } catch (error) {
      console.error("Could not load saved tasks:", error);
      showToast("Saved tasks could not be loaded. Check your browser storage.");
      return [];
    }
  }

  let tasks = loadTasks();

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      console.error("Could not save tasks:", error);
      showToast("Changes could not be saved. Check your browser storage.");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function parseDate(value) {
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return dateString(date) === value ? date : null;
  }

  function formatDate(date, options) {
    return new Intl.DateTimeFormat("en-US", options).format(date);
  }

  function dayDifference(date) {
    return Math.round((startOfDay(date) - today) / 86400000);
  }

  function dueLabel(date) {
    const difference = dayDifference(date);
    if (difference < 0) return `${Math.abs(difference)}d overdue`;
    if (difference === 0) return "Today";
    if (difference === 1) return "Tomorrow";
    return formatDate(date, { month: "short", day: "numeric" });
  }

  function sortedByDue(list) {
    return list.slice().sort((first, second) => {
      const firstDate = parseDate(first.dueDate);
      const secondDate = parseDate(second.dueDate);
      return (firstDate ? firstDate.getTime() : Infinity) - (secondDate ? secondDate.getTime() : Infinity) ||
        (second.createdAt || 0) - (first.createdAt || 0);
    });
  }

  function statusClass(status) {
    return status.toLowerCase().replace(/\s+/g, "-");
  }

  function taskStatusFilter() {
    if (activeView === "pending") return "Pending";
    if (activeView === "completed") return "Completed";
    return "all";
  }

  function visibleTasks() {
    const searchTerm = searchInput.value.trim().toLocaleLowerCase();
    const subject = subjectFilter.value;
    const status = statusFilter.value;
    let result = tasks.filter((task) => {
      const matchesSearch = !searchTerm || `${task.title} ${task.subject} ${task.description}`.toLocaleLowerCase().includes(searchTerm);
      const matchesSubject = subject === "all" || task.subject === subject;
      const viewStatus = taskStatusFilter();
      const matchesView = viewStatus === "all" || task.status === viewStatus;
      const matchesStatus = status === "all" || task.status === status;
      return matchesSearch && matchesSubject && matchesView && matchesStatus;
    });
    if (activeView === "overview") result = sortedByDue(result);
    else result = result.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return activeView === "overview" ? result.slice(0, 5) : result;
  }

  function renderTask(task) {
    const dueDate = parseDate(task.dueDate);
    const overdue = dueDate && dayDifference(dueDate) < 0 && task.status !== "Completed";
    const isComplete = task.status === "Completed";
    const dueText = dueDate ? dueLabel(dueDate) : "No date";
    return `<article class="task-row" data-task-id="${escapeHTML(task.id)}">
      <div class="task-main">
        <button class="task-check${isComplete ? " checked" : ""}" type="button" data-action="toggle" aria-label="${isComplete ? "Mark incomplete" : "Mark complete"}: ${escapeHTML(task.title)}" aria-pressed="${isComplete}"><svg class="icon"><use href="#i-check"/></svg></button>
        <div class="task-copy">
          <p class="task-title${isComplete ? " is-done" : ""}" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</p>
          <div class="task-meta"><span class="subject-tag">${escapeHTML(task.subject)}</span><span class="task-due${overdue ? " overdue" : ""}"><svg class="icon"><use href="#i-calendar"/></svg>${escapeHTML(dueText)}</span></div>
        </div>
      </div>
      <div class="task-end">
        <span class="status-pill status-${statusClass(task.status)}">${escapeHTML(task.status)}</span>
        <div class="task-actions">
          <button class="task-action" type="button" data-action="edit" aria-label="Edit ${escapeHTML(task.title)}"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button class="task-action delete" type="button" data-action="delete" aria-label="Delete ${escapeHTML(task.title)}"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
      </div>
    </article>`;
  }

  function renderEmptyState() {
    const hasFilters = searchInput.value.trim() || subjectFilter.value !== "all" || statusFilter.value !== "all" || activeView !== "overview";
    const title = tasks.length === 0 ? "A fresh start" : hasFilters ? "No tasks found" : "Nothing on your list";
    const description = tasks.length === 0 ? "Add a task to start organizing your schoolwork." : hasFilters ? "Try a different search or adjust your filters." : "Enjoy the breathing room. You're all caught up.";
    return `<div class="empty-state"><span class="empty-state-icon"><svg class="icon"><use href="#i-sparkle"/></svg></span><strong>${title}</strong><p>${description}</p></div>`;
  }

  function renderTasks() {
    const filteredTasks = visibleTasks();
    taskList.innerHTML = filteredTasks.length ? filteredTasks.map(renderTask).join("") : renderEmptyState();
    document.getElementById("tasks-heading").textContent = activeView === "overview" ? "Your tasks" :
      activeView === "pending" ? "To do" : activeView === "completed" ? "Completed tasks" : "All tasks";
    document.getElementById("view-all-button").hidden = activeView !== "overview";
  }

  function renderDeadlines() {
    const upcoming = sortedByDue(tasks.filter((task) => task.status !== "Completed" && parseDate(task.dueDate) && dayDifference(parseDate(task.dueDate)) >= 0)).slice(0, 4);
    if (!upcoming.length) {
      deadlineList.innerHTML = '<div class="no-deadlines">No upcoming deadlines. You have room to breathe.</div>';
      return;
    }
    deadlineList.innerHTML = upcoming.map((task) => {
      const date = parseDate(task.dueDate);
      const when = dueLabel(date);
      const soon = dayDifference(date) <= 1;
      return `<div class="deadline-item">
        <div class="date-tile"><span>${formatDate(date, { month: "short" })}</span><strong>${formatDate(date, { day: "numeric" })}</strong></div>
        <div class="deadline-copy"><p class="deadline-title" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</p><span class="deadline-subject">${escapeHTML(task.subject)}</span></div>
        <span class="deadline-when${soon ? " soon" : ""}">${escapeHTML(when)}</span>
      </div>`;
    }).join("");
  }

  function renderStatistics() {
    const completed = tasks.filter((task) => task.status === "Completed").length;
    const inProgress = tasks.filter((task) => task.status === "In Progress").length;
    const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    const weekEnd = addDays(7);
    const dueThisWeek = tasks.filter((task) => {
      const date = parseDate(task.dueDate);
      return date && task.status !== "Completed" && date >= today && date < weekEnd;
    }).length;
    document.getElementById("stat-total").textContent = tasks.length;
    document.getElementById("stat-progress").textContent = inProgress;
    document.getElementById("stat-completed").textContent = completed;
    document.getElementById("stat-due").textContent = dueThisWeek;
    document.getElementById("all-count").textContent = tasks.length;
    document.getElementById("completion-note").textContent = tasks.length ? `${percent}% of tasks finished` : "A great place to begin";
    document.getElementById("progress-percent").textContent = `${percent}%`;
    document.getElementById("progress-ring").style.background = `conic-gradient(#6683ed ${percent * 3.6}deg, #e9edf7 ${percent * 3.6}deg)`;
    document.getElementById("progress-ring").setAttribute("aria-label", `${percent}% of tasks completed`);
    document.getElementById("legend-completed").textContent = completed;
    document.getElementById("legend-remaining").textContent = tasks.length - completed;
    document.getElementById("progress-message").textContent = tasks.length && completed === tasks.length ? "Look at you go — all done!" :
      completed ? "You're building great momentum." : "Every finished task is a win.";
  }

  function renderSubjects() {
    const currentValue = subjectFilter.value || "all";
    const subjects = [...new Set(tasks.map((task) => task.subject))].sort((a, b) => a.localeCompare(b));
    subjectFilter.innerHTML = '<option value="all">All subjects</option>' +
      subjects.map((subject) => `<option value="${escapeHTML(subject)}">${escapeHTML(subject)}</option>`).join("");
    subjectFilter.value = subjects.includes(currentValue) ? currentValue : "all";
  }

  function renderNavigation() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      if (button.classList.contains("nav-link")) {
        const selected = button.dataset.view === activeView;
        button.classList.toggle("active", selected);
        if (selected) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    const breadcrumb = activeView === "overview" ? "Overview" : activeView === "pending" ? "To do" :
      activeView === "completed" ? "Completed" : "All tasks";
    document.getElementById("breadcrumb-current").textContent = breadcrumb;
    document.getElementById("page-title").innerHTML = activeView === "overview" ?
      `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, Jamie <span class="wave">✦</span>` :
      `${breadcrumb} <span class="wave">✦</span>`;
    if (activeView !== "overview") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderAll() {
    renderStatistics();
    renderSubjects();
    renderNavigation();
    renderTasks();
    renderDeadlines();
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function openModal(task) {
    lastFocusedElement = document.activeElement;
    form.reset();
    document.getElementById("form-error").classList.remove("visible");
    document.getElementById("form-error").textContent = "";
    document.getElementById("task-id").value = task ? task.id : "";
    document.getElementById("task-title").value = task ? task.title : "";
    document.getElementById("task-subject").value = task ? task.subject : "";
    document.getElementById("task-description").value = task ? task.description : "";
    document.getElementById("task-due").value = task ? task.dueDate : "";
    document.getElementById("task-status").value = task ? task.status : "Pending";
    document.getElementById("modal-title").textContent = task ? "Edit task" : "Add a new task";
    document.getElementById("save-task-button").textContent = task ? "Save changes" : "Save task";
    modal.hidden = false;
    document.body.classList.add("modal-open");
    document.getElementById("task-title").focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
  }

  function setView(view) {
    activeView = view;
    sidebar.classList.remove("open");
    renderNavigation();
    renderTasks();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = document.getElementById("task-id").value;
    const title = document.getElementById("task-title").value.trim();
    const subject = document.getElementById("task-subject").value.trim();
    const dueDate = document.getElementById("task-due").value;
    const date = parseDate(dueDate);
    const error = document.getElementById("form-error");
    if (!title || !subject || !date) {
      error.textContent = "Add a title, subject, and valid due date before saving.";
      error.classList.add("visible");
      return;
    }
    const existing = tasks.find((task) => task.id === id);
    const updatedTask = {
      id: existing ? existing.id : createId(),
      title,
      subject,
      description: document.getElementById("task-description").value.trim(),
      dueDate,
      status: document.getElementById("task-status").value,
      createdAt: existing ? existing.createdAt : Date.now()
    };
    const nextTasks = existing ? tasks.map((task) => task.id === id ? updatedTask : task) : [updatedTask, ...tasks];
    tasks = nextTasks;
    if (!saveTasks()) {
      tasks = existing ? tasks.map((task) => task.id === id ? existing : task) : tasks.filter((task) => task.id !== updatedTask.id);
      return;
    }
    closeModal();
    renderAll();
    showToast(existing ? "Task updated." : "Task added to your list.");
  });

  taskList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const row = actionButton.closest("[data-task-id]");
    const task = tasks.find((item) => item.id === row.dataset.taskId);
    if (!task) return;
    const action = actionButton.dataset.action;
    if (action === "edit") openModal(task);
    if (action === "toggle") {
      const oldStatus = task.status;
      const updatedStatus = oldStatus === "Completed" ? "Pending" : "Completed";
      tasks = tasks.map((item) => item.id === task.id ? { ...item, status: updatedStatus } : item);
      if (!saveTasks()) tasks = tasks.map((item) => item.id === task.id ? { ...item, status: oldStatus } : item);
      else {
        renderAll();
        showToast(updatedStatus === "Completed" ? "Nice work — task completed!" : "Task moved back to pending.");
      }
    }
    if (action === "delete") {
      if (!window.confirm(`Delete "${task.title}"? This can't be undone.`)) return;
      const previousTasks = tasks;
      tasks = tasks.filter((item) => item.id !== task.id);
      if (!saveTasks()) tasks = previousTasks;
      else {
        renderAll();
        showToast("Task deleted.");
      }
    }
  });

  document.querySelectorAll("[data-open-modal]").forEach((button) => button.addEventListener("click", () => openModal()));
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    setView(button.dataset.view);
  }));
  document.getElementById("view-all-button").addEventListener("click", () => setView("all"));
  document.getElementById("notification-button").addEventListener("click", () => {
    document.getElementById("deadline-list").scrollIntoView({ behavior: "smooth", block: "center" });
    showToast("Here are your upcoming deadlines.");
  });
  document.querySelector(".profile-menu").addEventListener("click", () => showToast("You're signed in as Jamie Davis."));
  document.getElementById("menu-toggle").addEventListener("click", () => sidebar.classList.toggle("open"));
  document.addEventListener("click", (event) => {
    if (sidebar.classList.contains("open") && !sidebar.contains(event.target) && !event.target.closest("#menu-toggle")) sidebar.classList.remove("open");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
    if (event.key === "Escape") sidebar.classList.remove("open");
    if (event.key === "Tab" && !modal.hidden) {
      const focusable = [...modal.querySelectorAll("button, input, select, textarea")]
        .filter((element) => !element.disabled && element.type !== "hidden" && element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  searchInput.addEventListener("input", renderTasks);
  subjectFilter.addEventListener("change", renderTasks);
  statusFilter.addEventListener("change", renderTasks);

  const now = new Date();
  document.getElementById("today-label").textContent = formatDate(now, { weekday: "short", month: "short", day: "numeric" });
  document.getElementById("welcome-date").textContent = formatDate(now, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  document.getElementById("week-label").textContent = `Week of ${formatDate(weekStart, { month: "short", day: "numeric" })}`;
  renderAll();
})();