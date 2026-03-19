// ═══════════════════════════════════════════════════════════════
//  tasks.js  ─  Replaces inline <script> in tasks.html
//  Connects to: GET/POST /api/tasks  and  POST /api/tasks/:id/submit
// ═══════════════════════════════════════════════════════════════
import { AuthService, TasksService, ApiError } from '../services/api.js';


const html   = document.documentElement;
const toggle = document.getElementById('themeToggle');
html.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
toggle?.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// ── Sidebar ───────────────────────────────────────────────────
window.toggleSidebar = () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
};
window.closeSidebar = () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
};

// ── User info ─────────────────────────────────────────────────
const user     = AuthService.getCurrentUser();
const initials = AuthService.getInitials();
setEl('sidebarAvatar', initials);
setEl('topAvatar',     initials);
setEl('sidebarName',   AuthService.getDisplayName());
setEl('sidebarRole',   `${cap(user?.role || 'Intern')} · ${user?.organization || 'InternHub'}`);

// ── State ─────────────────────────────────────────────────────
let allTasks       = [];
let activeFilter   = 'all';
let selectedPriority = 'medium';
let attachedFiles  = [];

const catMap = {
  Design: 'cat-design', Development: 'cat-dev', 'Data Science': 'cat-data',
  Report: 'cat-report', Marketing: 'cat-marketing', Other: 'cat-report',
};
const stMap = {
  pending: 'st-pending', submitted: 'st-submitted',
  approved: 'st-approved', revision: 'st-revision',
};

// ── Load tasks on ready ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadTasks();

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderTasks();
    });
  });
});

// ── Fetch tasks from backend ──────────────────────────────────
async function loadTasks() {
  try {
    allTasks = await TasksService.getAll();
    renderTasks();
  } catch (err) {
    document.getElementById('tasksGrid').innerHTML =
      `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">Failed to load tasks: ${esc(err.message)}</div>
      </div>`;
  }
}

// ── Render with filter + search ───────────────────────────────
function renderTasks() {
  const search   = (document.getElementById('taskSearch')?.value || '').toLowerCase();
  const filtered = allTasks.filter(t => {
    const matchFilter = activeFilter === 'all' || t.status === activeFilter;
    const matchSearch = !search ||
      (t.title  || '').toLowerCase().includes(search) ||
      (t.category || '').toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });

  const grid = document.getElementById('tasksGrid');
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">📭</div>
        <div class="empty-text">No tasks found.</div>
        <button class="btn-primary" style="margin:0 auto" onclick="openModal()">+ Submit New Task</button>
      </div>`;
    return;
  }

  grid.innerHTML = '';
  filtered.forEach(t => {
    const catClass  = catMap[t.category] || 'cat-report';
    const stClass   = stMap[t.status]    || 'st-pending';
    const stLabel   = { pending: 'Pending', submitted: 'Submitted', approved: 'Approved', revision: 'Needs Revision' }[t.status] || t.status;
    const prioColor = { low: '#27c93f', medium: 'var(--orange)', high: '#ff4444' }[t.priority] || 'var(--orange)';
    const dueLabel  = t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : 'No deadline';
    const fileCount = parseInt(t.file_count || 0);
    const subCount  = parseInt(t.submission_count || 0);

    const card = document.createElement('div');
    card.className = 'task-card';
    card.innerHTML = `
      <div class="task-card-top">
        <span class="task-cat ${catClass}">${esc(t.category)}</span>
        <span class="task-card-status ${stClass}">${stLabel}</span>
      </div>
      <h3>${esc(t.title)}</h3>
      <div class="task-card-desc">${esc(t.description || 'No description provided.')}</div>
      <div class="task-progress">
        <div class="task-prog-label"><span>Progress</span><span>${t.progress_pct ?? 0}%</span></div>
        <div class="prog-bar"><div class="prog-fill" style="width:${t.progress_pct ?? 0}%"></div></div>
      </div>
      <div class="task-card-meta">
        <div class="task-assigned-by">
          <div class="mini-av">${initials2(t.supervisor_name)}</div>
          ${esc(t.supervisor_name || 'Supervisor')}
        </div>
        <div style="display:flex;align-items:center;gap:.7rem">
          <span style="font-size:.65rem;font-weight:700;color:${prioColor};padding:.15rem .4rem;border-radius:4px;background:${prioColor}22">${(t.priority||'medium').toUpperCase()}</span>
          <span class="task-due-label">${dueLabel}</span>
        </div>
      </div>
      <div style="margin-top:.8rem;padding-top:.6rem;border-top:1px solid var(--border)">
        <div class="task-files">📎 ${fileCount} file${fileCount !== 1 ? 's' : ''} · ${subCount} submission${subCount !== 1 ? 's' : ''}</div>
      </div>
      ${t.status === 'pending' || t.status === 'revision' ? `
        <button class="btn-primary" style="width:100%;margin-top:.8rem;padding:.5rem" onclick="quickSubmit(${t.id}, '${esc(t.title)}')">
          Submit Task →
        </button>` : ''}
    `;
    grid.appendChild(card);
  });
}

// Exposed for inline oninput
window.filterTasks = () => renderTasks();

// ── Quick submit from card ────────────────────────────────────
window.quickSubmit = function(taskId, taskTitle) {
  // Pre-fill the modal for this specific task
  const titleInput = document.getElementById('taskTitle');
  if (titleInput) titleInput.value = taskTitle;
  // Store the task id to submit against
  document.getElementById('modalBackdrop').dataset.taskId = taskId;
  openModal();
};

// ── Modal ─────────────────────────────────────────────────────
window.openModal  = () => document.getElementById('modalBackdrop').classList.add('open');
window.closeModal = () => {
  document.getElementById('modalBackdrop').classList.remove('open');
  document.getElementById('modalBackdrop').dataset.taskId = '';
  document.getElementById('taskTitle').value      = '';
  document.getElementById('taskCat').value        = '';
  document.getElementById('taskDesc').value       = '';
  document.getElementById('taskDue').value        = '';
  document.getElementById('taskSupervisor').value = '';
  document.getElementById('taskProgress').value   = 100;
  document.getElementById('progressLabel').textContent = '100%';
  document.getElementById('modalError').style.display  = 'none';
  attachedFiles = [];
  document.getElementById('fileList').innerHTML = '';
};
document.getElementById('modalBackdrop')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) window.closeModal();
});

// ── Priority ──────────────────────────────────────────────────
window.setPriority = (p) => {
  selectedPriority = p;
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.className = 'priority-btn';
    if (btn.dataset.p === p) btn.classList.add(`selected-${p === 'medium' ? 'med' : p}`);
  });
};

// ── File handling ─────────────────────────────────────────────
window.handleFiles = (files) => {
  const icons = { PDF:'📄',DOCX:'📝',XLSX:'📊',PNG:'🖼️',JPG:'🖼️',ZIP:'🗜️',PPTX:'📊' };
  Array.from(files).forEach(f => {
    if (attachedFiles.find(x => x.name === f.name)) return;
    attachedFiles.push(f);
    const ext  = f.name.split('.').pop().toUpperCase();
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span class="file-item-icon">${icons[ext] || '📎'}</span>
      <span class="file-item-name">${esc(f.name)}</span>
      <span class="file-item-size">${(f.size / 1024).toFixed(1)}KB</span>
      <button class="file-remove" onclick="removeFile('${esc(f.name)}', this.parentElement)">✕</button>`;
    document.getElementById('fileList').appendChild(item);
  });
};
window.removeFile = (name, el) => { attachedFiles = attachedFiles.filter(f => f.name !== name); el.remove(); };
window.dragOver   = (e) => { e.preventDefault(); document.getElementById('fileDrop').classList.add('dragover'); };
window.dragLeave  = ()  => document.getElementById('fileDrop').classList.remove('dragover');
window.dropFile   = (e) => { e.preventDefault(); window.dragLeave(); window.handleFiles(e.dataTransfer.files); };

// ── Submit task to backend ────────────────────────────────────
window.submitTask = async function() {
  const title    = document.getElementById('taskTitle').value.trim();
  const category = document.getElementById('taskCat').value;
  const content  = document.getElementById('taskDesc').value.trim();
  const progress = parseInt(document.getElementById('taskProgress').value);
  const errEl    = document.getElementById('modalError');
  const submitBtn = document.querySelector('.btn-submit-modal');

  if (!title || !category) {
    errEl.textContent   = 'Please fill in Task Title and Category.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const existingTaskId = document.getElementById('modalBackdrop').dataset.taskId;

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Submitting…';

  try {
    if (existingTaskId) {
      // Intern submitting an existing assigned task
      await TasksService.submit(existingTaskId, {
        content,
        progress_pct:    progress,
        submission_type: 'initial',
      });
    } else {
      // Supervisor creating a new task (needs assigned_to — show error if intern)
      if (user?.role === 'intern') {
        errEl.textContent   = 'Interns can only submit tasks that have been assigned to them.';
        errEl.style.display = 'block';
        return;
      }
      // Supervisor flow — basic create (extend as needed)
      await TasksService.create({
        title,
        description: content,
        category,
        priority:    selectedPriority,
      });
    }

    window.closeModal();
    showToast('Task submitted successfully! 🎉');
    await loadTasks(); // Refresh from backend

  } catch (err) {
    errEl.textContent   = err instanceof ApiError ? err.message : 'Submission failed.';
    errEl.style.display = 'block';
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit Task →';
  }
};

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  setEl('toastMsg', msg);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Helpers ───────────────────────────────────────────────────
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function initials2(name) {
  if (!name) return '??';
  return name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2);
}