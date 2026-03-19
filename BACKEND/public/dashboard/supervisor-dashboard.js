// ═══════════════════════════════════════════════════════════════
//  supervisor-dashboard.js
//  Connects to: /api/dashboard/stats, /api/interns,
//               /api/tasks, /api/dashboard/notifications
// ═══════════════════════════════════════════════════════════════
import { AuthService, DashboardService, InternsService, TasksService } from '../services/api.js';

let allInterns   = [];
let selectedStar = 5;
let activeTaskId = null;

document.addEventListener('DOMContentLoaded', async () => {

  // ── Auth guard ──────────────────────────────────────────────
  if (!AuthService.isLoggedIn()) {
    window.location.href = '../login/login.html';
    return;
  }

  // Redirect interns away from supervisor dashboard
  const user = AuthService.getCurrentUser();
  if (user?.role === 'intern') {
    window.location.href = '../dashboard/intern-dashboard.html';
    return;
  }

  // ── Theme ───────────────────────────────────────────────────
  const html   = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  toggle?.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  // ── Sidebar ─────────────────────────────────────────────────
  document.getElementById('hamburgerTop')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
  });
  document.getElementById('overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  });

  // ── Logout ──────────────────────────────────────────────────
  document.getElementById('logoutBtn')?.addEventListener('click', () => AuthService.logout());

  // ── Populate user info ──────────────────────────────────────
  const initials = AuthService.getInitials();
  setEl('sidebarAvatar', initials);
  setEl('topAvatar',     initials);
  setEl('sidebarName',   AuthService.getDisplayName());
  setEl('sidebarRole',   `Supervisor · ${user?.organization || 'InternHub'}`);

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  setEl('greetingText', `Good ${greet}, ${user?.first_name || 'there'} 👋`);

  // ── Load everything ─────────────────────────────────────────
  await Promise.all([
    loadStats(),
    loadInterns(),
    loadPendingReviews(),
    loadNotifications(),
    loadActivity(),
  ]);

  // ── Assign Task Modal ───────────────────────────────────────
  document.getElementById('openAssignModal')?.addEventListener('click', openAssignModal);
  document.getElementById('assignTaskBtn')?.addEventListener('click', openAssignModal);
  document.getElementById('closeModal')?.addEventListener('click', closeAssignModal);
  document.getElementById('cancelModal')?.addEventListener('click', closeAssignModal);
  document.getElementById('assignModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAssignModal();
  });
  document.getElementById('submitTask')?.addEventListener('click', handleAssignTask);

  // ── Review Modal ────────────────────────────────────────────
  document.getElementById('closeReviewModal')?.addEventListener('click', closeReviewModal);
  document.getElementById('reviewModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeReviewModal();
  });

  // Star rating
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      selectedStar = parseInt(star.dataset.val);
      updateStars(selectedStar);
    });
    star.addEventListener('mouseover', () => updateStars(parseInt(star.dataset.val)));
    star.addEventListener('mouseout',  () => updateStars(selectedStar));
  });

  // Review actions
  document.getElementById('approveBtn')?.addEventListener('click',  () => handleReview('approve'));
  document.getElementById('revisionBtn')?.addEventListener('click', () => handleReview('revision'));
  document.getElementById('rejectBtn')?.addEventListener('click',   () => handleReview('reject'));

  // ── Mark notifications read ─────────────────────────────────
  document.getElementById('markReadBtn')?.addEventListener('click', async () => {
    await DashboardService.markNotificationsRead();
    loadNotifications();
  });

});

// ── LOAD STATS ───────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await DashboardService.getStats();
    const rows = Array.isArray(data?.stats) ? data.stats : [];

    const totals = rows.reduce((acc, s) => ({
      total:    acc.total    + parseInt(s.total_tasks    || 0),
      approved: acc.approved + parseInt(s.approved       || 0),
      pending:  acc.pending  + parseInt(s.pending        || 0),
      submitted:acc.submitted+ parseInt(s.submitted      || 0),
    }), { total:0, approved:0, pending:0, submitted:0 });

    setEl('statInterns',  rows.length);
    setEl('statTasks',    totals.total);
    setEl('statPending',  totals.pending + totals.submitted);
    setEl('statApproved', totals.approved);

    // Review badge
    const reviewCount = totals.pending + totals.submitted;
    setEl('reviewBadge', reviewCount);
    setEl('reviewCount', reviewCount);
    document.getElementById('reviewBadge').style.display = reviewCount > 0 ? '' : 'none';

  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ── LOAD INTERNS ─────────────────────────────────────────────
async function loadInterns() {
  const tbody = document.getElementById('internBody');
  if (!tbody) return;

  try {
    allInterns = await InternsService.getAll();
    renderInterns(allInterns);

    // Populate assign task dropdown
    const select = document.getElementById('taskAssignTo');
    if (select) {
      select.innerHTML = '<option value="">Select intern...</option>' +
        allInterns.map(i => `<option value="${i.id}">${esc(i.full_name)} — ${esc(i.department || '—')}</option>`).join('');
    }

  } catch (err) {
    console.error('Interns error:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Could not load interns.</td></tr>';
  }
}

function renderInterns(data) {
  const tbody = document.getElementById('internBody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No interns found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(i => {
    const progress  = i.tasks_total ? Math.round((i.tasks_completed / i.tasks_total) * 100) : 0;
    const score     = parseFloat(i.overall_score ?? 0).toFixed(1);
    const label     = progress === 100 ? 'Active' : progress >= 50 ? 'Review' : 'Pending';
    const cls       = { Active:'sb-active', Review:'sb-review', Pending:'sb-pending' }[label];
    const initials  = `${(i.full_name||'').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}`;
    return `
      <tr>
        <td>
          <div class="intern-name-cell">
            <div class="intern-av">${initials}</div>
            ${esc(i.full_name)}
          </div>
        </td>
        <td style="color:var(--text2)">${esc(i.department || '—')}</td>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem">
            <div class="progress-mini">
              <div class="progress-mini-fill" style="width:${progress}%"></div>
            </div>
            <span style="font-size:.72rem;color:var(--text2)">${progress}%</span>
          </div>
        </td>
        <td style="font-weight:700;color:var(--orange)">${score}</td>
        <td><span class="status-badge ${cls}">${label}</span></td>
        <td>
          <button class="action-btn" onclick="viewIntern(${i.id})">View</button>
        </td>
      </tr>`;
  }).join('');
}

window.filterInterns = (val) => {
  const q = val.toLowerCase();
  renderInterns(allInterns.filter(i =>
    (i.full_name || '').toLowerCase().includes(q) ||
    (i.department || '').toLowerCase().includes(q)
  ));
};

window.viewIntern = (id) => {
  console.log('View intern:', id);
  // TODO: navigate to intern detail page
};

// ── LOAD PENDING REVIEWS ─────────────────────────────────────
async function loadPendingReviews() {
  const list = document.getElementById('reviewList');
  if (!list) return;

  try {
    const tasks = await TasksService.getAll({ status: 'submitted' });
    const inReview = await TasksService.getAll({ status: 'in_review' });
    const all = [...(tasks || []), ...(inReview || [])];

    if (!all.length) {
      list.innerHTML = '<div class="loading-state">No pending reviews 🎉</div>';
      return;
    }

    list.innerHTML = all.map(t => `
      <div class="review-item" onclick="openReviewModal(${t.id}, '${esc(t.title)}', '${esc(t.intern_name || '')}')">
        <div class="review-item-top">
          <span class="review-item-title">${esc(t.title)}</span>
          <span style="font-size:.65rem;font-weight:600;padding:.15rem .5rem;border-radius:100px;background:rgba(59,130,246,.12);color:#60a5fa">${t.status}</span>
        </div>
        <div class="review-item-intern">👤 ${esc(t.intern_name || '—')}</div>
        <div class="review-item-time">Submitted ${t.submitted_at ? timeAgo(t.submitted_at) : '—'}</div>
      </div>`).join('');

  } catch (err) {
    console.error('Reviews error:', err);
    list.innerHTML = '<div class="loading-state">Could not load reviews.</div>';
  }
}

// ── LEADERBOARD (load with interns) ──────────────────────────
async function loadLeaderboard() {
  const lb = document.getElementById('leaderboard');
  if (!lb || !allInterns.length) return;

  const sorted = [...allInterns].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  const medals = ['gold', 'silver', 'bronze'];

  lb.innerHTML = sorted.slice(0, 8).map((i, idx) => {
    const rankClass = medals[idx] || '';
    const initials  = (i.full_name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const score     = parseFloat(i.overall_score ?? 0).toFixed(1);
    return `
      <div class="lb-item">
        <div class="lb-rank ${rankClass}">${idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}</div>
        <div class="lb-avatar">${initials}</div>
        <div class="lb-info">
          <div class="lb-name">${esc(i.full_name)}</div>
          <div class="lb-dept">${esc(i.department || '—')}</div>
        </div>
        <div class="lb-score">${score}</div>
      </div>`;
  }).join('');
}

// ── LOAD NOTIFICATIONS ───────────────────────────────────────
async function loadNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;

  try {
    const notifs = await DashboardService.getNotifications();
    const unread = notifs?.filter(n => !n.is_read).length || 0;

    setEl('notifBadge', unread);
    document.getElementById('notifBadge').style.display = unread > 0 ? '' : 'none';
    document.getElementById('notifDot').style.display   = unread > 0 ? '' : 'none';

    if (!notifs?.length) {
      list.innerHTML = '<div class="loading-state">No notifications.</div>';
      return;
    }

    const typeIcons = { task_approved:'✅', task_assigned:'📋', task_revision:'🔄', system:'📢', feedback_given:'💬' };

    list.innerHTML = notifs.slice(0, 6).map(n => `
      <div class="notif-item ${!n.is_read ? 'unread' : ''}">
        <div class="notif-icon">${typeIcons[n.type] || '🔔'}</div>
        <div class="notif-content">
          <div class="notif-title">${esc(n.title)}</div>
          <div class="notif-msg">${esc(n.message)}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>`).join('');

  } catch (err) {
    console.error('Notifications error:', err);
  }
}

// ── LOAD ACTIVITY ────────────────────────────────────────────
async function loadActivity() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  try {
    const rows = await DashboardService.getActivity();

    if (!rows?.length) {
      feed.innerHTML = '<div class="loading-state">No recent activity.</div>';
      // Still load leaderboard
      setTimeout(loadLeaderboard, 500);
      return;
    }

    const actionIcons  = { task_submitted:'📋', task_approved:'✅', task_revision:'🔄', logged_in:'🔑', feedback_given:'💬' };
    const actionColors = { task_submitted:'var(--orange-glow)', task_approved:'rgba(39,201,63,.15)', task_revision:'rgba(255,60,60,.12)', logged_in:'rgba(59,130,246,.12)' };

    feed.innerHTML = rows.map(a => `
      <div class="activity-item">
        <div class="activity-icon" style="background:${actionColors[a.action] || 'rgba(255,107,0,.1)'}">
          ${actionIcons[a.action] || '📌'}
        </div>
        <div class="activity-content">
          <div class="activity-text">
            <strong>${esc(a.user_name)}</strong> ${esc(a.action.replace(/_/g, ' '))}
          </div>
          <div class="activity-time">${timeAgo(a.created_at)}</div>
        </div>
      </div>`).join('');

    // Load leaderboard after interns are ready
    setTimeout(loadLeaderboard, 500);

  } catch (err) {
    console.error('Activity error:', err);
    setTimeout(loadLeaderboard, 500);
  }
}

// ── ASSIGN TASK MODAL ────────────────────────────────────────
function openAssignModal() {
  document.getElementById('assignModal').classList.add('open');
}
function closeAssignModal() {
  document.getElementById('assignModal').classList.remove('open');
  document.getElementById('modalError').style.display = 'none';
  document.getElementById('taskTitle').value       = '';
  document.getElementById('taskCategory').value    = '';
  document.getElementById('taskAssignTo').value    = '';
  document.getElementById('taskDescription').value = '';
}

async function handleAssignTask() {
  const title      = document.getElementById('taskTitle').value.trim();
  const category   = document.getElementById('taskCategory').value;
  const assigned_to= document.getElementById('taskAssignTo').value;
  const priority   = document.getElementById('taskPriority').value;
  const due_date   = document.getElementById('taskDueDate').value;
  const description= document.getElementById('taskDescription').value.trim();
  const errEl      = document.getElementById('modalError');

  if (!title || !category || !assigned_to) {
    errEl.textContent   = 'Please fill in Title, Category and Assign To.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('submitTask');
  btn.disabled    = true;
  btn.textContent = 'Assigning…';

  try {
    await TasksService.create({ title, description, category, priority, assigned_to: parseInt(assigned_to), due_date: due_date || undefined });
    closeAssignModal();
    await Promise.all([loadStats(), loadPendingReviews()]);
    showToast('✅ Task assigned successfully!');
  } catch (err) {
    errEl.textContent   = err.message || 'Failed to assign task.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Assign Task →';
  }
}

// ── REVIEW MODAL ─────────────────────────────────────────────
window.openReviewModal = (taskId, title, internName) => {
  activeTaskId = taskId;
  selectedStar = 5;
  updateStars(5);
  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewError').style.display = 'none';
  document.getElementById('reviewTaskInfo').innerHTML = `
    <strong>Task:</strong> ${esc(title)}<br>
    <strong>Intern:</strong> ${esc(internName)}
  `;
  document.getElementById('reviewModal').classList.add('open');
};

function closeReviewModal() {
  document.getElementById('reviewModal').classList.remove('open');
  activeTaskId = null;
}

async function handleReview(action) {
  const comment = document.getElementById('reviewComment').value.trim();
  const errEl   = document.getElementById('reviewError');

  if (action !== 'approve' && !comment) {
    errEl.textContent   = 'Please provide a comment for revision or rejection.';
    errEl.style.display = 'block';
    return;
  }

  try {
    await TasksService.review(activeTaskId, {
      action,
      rating:  selectedStar,
      comment: comment || `Task ${action}d.`,
    });
    closeReviewModal();
    await Promise.all([loadStats(), loadPendingReviews()]);
    showToast(`✅ Task ${action}d successfully!`);
  } catch (err) {
    errEl.textContent   = err.message || 'Review failed.';
    errEl.style.display = 'block';
  }
}

function updateStars(val) {
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
  });
}

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `position:fixed;bottom:2rem;right:2rem;z-index:9999;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1rem 1.3rem;box-shadow:0 20px 60px rgba(0,0,0,.3);font-size:.88rem;transform:translateY(100px);opacity:0;transition:all .4s cubic-bezier(.34,1.56,.64,1);`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  setTimeout(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; }, 10);
  setTimeout(() => { toast.style.transform = 'translateY(100px)'; toast.style.opacity = '0'; }, 3500);
}

// ── HELPERS ──────────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}