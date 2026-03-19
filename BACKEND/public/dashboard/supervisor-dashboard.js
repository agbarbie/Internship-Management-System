// ═══════════════════════════════════════════════════════════════
//  supervisor-dashboard.js
//  viewIntern() opens an inline detail modal — no page navigation
// ═══════════════════════════════════════════════════════════════
import { AuthService, DashboardService, InternsService, TasksService } from '../services/api.js';

let allInterns   = [];
let selectedStar = 5;
let activeTaskId = null;

document.addEventListener('DOMContentLoaded', async () => {

  if (!AuthService.isLoggedIn()) {
    window.location.href = '../login/login.html';
    return;
  }

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

  // ── User info ────────────────────────────────────────────────
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

  document.getElementById('approveBtn')?.addEventListener('click',  () => handleReview('approve'));
  document.getElementById('revisionBtn')?.addEventListener('click', () => handleReview('revision'));
  document.getElementById('rejectBtn')?.addEventListener('click',   () => handleReview('reject'));

  document.getElementById('markReadBtn')?.addEventListener('click', async () => {
    await DashboardService.markNotificationsRead();
    loadNotifications();
  });

  // ── Intern Detail Modal ─────────────────────────────────────
  document.getElementById('closeInternDetailModal')?.addEventListener('click', closeInternDetailModal);
  document.getElementById('internDetailModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeInternDetailModal();
  });
});

// ── LOAD STATS ───────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await DashboardService.getStats();
    const rows = Array.isArray(data?.stats) ? data.stats : [];

    const totals = rows.reduce((acc, s) => ({
      total:     acc.total     + parseInt(s.total_tasks || 0),
      approved:  acc.approved  + parseInt(s.approved    || 0),
      pending:   acc.pending   + parseInt(s.pending     || 0),
      submitted: acc.submitted + parseInt(s.submitted   || 0),
    }), { total:0, approved:0, pending:0, submitted:0 });

    setEl('statInterns',  rows.length);
    setEl('statTasks',    totals.total);
    setEl('statPending',  totals.pending + totals.submitted);
    setEl('statApproved', totals.approved);

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

    const select = document.getElementById('taskAssignTo');
    if (select) {
      select.innerHTML = '<option value="">Select intern...</option>' +
        allInterns.map(i =>
          `<option value="${i.id}">${esc(i.full_name)} — ${esc(i.department || '—')}</option>`
        ).join('');
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
    // Use live task counts from v_intern_overview.
    // Guard against tasks_total = 0 (no tasks assigned yet) vs tasks_total = NULL.
    const total     = parseInt(i.tasks_total    ?? 0);
    const completed = parseInt(i.tasks_completed ?? 0);
    const pending   = parseInt(i.tasks_pending   ?? 0);
    const submitted = parseInt(i.tasks_submitted ?? 0);
    const progress  = total > 0 ? Math.round((completed / total) * 100) : 0;
    const score     = parseFloat(i.overall_score ?? 0).toFixed(1);

    // Status badge:
    // "Active"  — all assigned tasks are approved (100% done)
    // "Review"  — at least one task is submitted/in-review awaiting supervisor
    // "On Track"— has tasks, making progress (>0% but not all done)
    // "Pending" — no tasks assigned yet OR all tasks are still pending/revision
    let label, cls;
    if (total === 0) {
      label = 'Pending'; cls = 'sb-pending';
    } else if (completed === total) {
      label = 'Active';  cls = 'sb-active';
    } else if (submitted > 0) {
      label = 'Review';  cls = 'sb-review';
    } else if (completed > 0 || progress > 0) {
      label = 'On Track'; cls = 'sb-review';
    } else {
      label = 'Pending'; cls = 'sb-pending';
    }

    const av = (i.full_name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return `
      <tr>
        <td>
          <div class="intern-name-cell">
            <div class="intern-av">${av}</div>
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
          <!-- FIX #4: use data attribute, listener attached below -->
          <button class="action-btn view-intern-btn" data-internid="${i.id}">View</button>
        </td>
      </tr>`;
  }).join('');

  // FIX #4: attach event listeners after render — no inline onclick
  tbody.querySelectorAll('.view-intern-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewIntern(parseInt(btn.dataset.internid));
    });
  });
}

window.filterInterns = (val) => {
  const q = val.toLowerCase();
  renderInterns(allInterns.filter(i =>
    (i.full_name   || '').toLowerCase().includes(q) ||
    (i.department  || '').toLowerCase().includes(q)
  ));
};

// ── INTERN DETAIL MODAL ───────────────────────────────────────
window.viewIntern = async (id) => {
  const modal = document.getElementById('internDetailModal');
  if (!modal) return;

  // Reset to loading state
  document.getElementById('idmLoading').style.display = '';
  document.getElementById('idmContent').style.display = 'none';
  document.getElementById('idmError').style.display   = 'none';
  modal.classList.add('open');

  try {
    const data = await InternsService.getById(id);
    const { intern, tasks, feedback } = data;

    const fullName  = `${intern.first_name} ${intern.last_name}`.trim();
    const av        = `${(intern.first_name||'')[0]}${(intern.last_name||'')[0]}`.toUpperCase();
    const score     = parseFloat(intern.overall_score ?? 0).toFixed(1);
    // Prefer live counts from the tasks array returned by the API —
    // intern_profiles.tasks_total may lag if approve_task() didn't update it.
    const completed = tasks?.filter(t => t.status === 'approved').length
                   ?? parseInt(intern.tasks_completed ?? 0);
    const total     = tasks?.filter(t => t.status !== 'rejected').length
                   ?? parseInt(intern.tasks_total ?? 0);
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Hero
    document.getElementById('idmAvatar').textContent   = av;
    document.getElementById('idmName').textContent     = fullName;
    document.getElementById('idmEmail').textContent    = intern.email         || '';
    document.getElementById('idmDept').textContent     = intern.department    || '—';
    document.getElementById('idmOrg').textContent      = intern.organization  || '—';
    document.getElementById('idmUni').textContent      = intern.university    || '—';
    document.getElementById('idmSup').textContent      = intern.supervisor_name || '—';

    // Score & progress
    document.getElementById('idmScore').textContent     = score;
    document.getElementById('idmPct').textContent       = `${pct}%`;
    document.getElementById('idmProgFill').style.width  = `${pct}%`;
    document.getElementById('idmCompleted').textContent = `${completed} of ${total} task${total !== 1 ? 's' : ''} approved`;

    // Internship dates
    const fmtDate = d => d
      ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : '—';
    document.getElementById('idmDates').textContent =
      `${fmtDate(intern.start_date)} → ${fmtDate(intern.end_date)}`;

    // Tasks list
    const stLabel = { pending:'Pending', submitted:'Submitted', approved:'Approved', revision:'Revision', rejected:'Rejected' };
    const stColor = { pending:'var(--text2)', submitted:'#60a5fa', approved:'#27c93f', revision:'var(--orange)', rejected:'#ff4444' };
    const taskEl  = document.getElementById('idmTasks');
    if (!tasks?.length) {
      taskEl.innerHTML = '<div style="color:var(--text3);font-size:.82rem;padding:.5rem 0">No tasks assigned yet.</div>';
    } else {
      taskEl.innerHTML = tasks.map(t => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:.65rem 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-size:.85rem;font-weight:600">${esc(t.title || t.task_title || '—')}</div>
            <div style="font-size:.72rem;color:var(--text3)">${esc(t.category || '—')}</div>
          </div>
          <span style="font-size:.72rem;font-weight:700;color:${stColor[t.status]||'var(--text2)'}">
            ${stLabel[t.status] || t.status || '—'}
          </span>
        </div>`).join('');
    }

    // Feedback list
    const fbEl = document.getElementById('idmFeedback');
    if (!feedback?.length) {
      fbEl.innerHTML = '<div style="color:var(--text3);font-size:.82rem;padding:.5rem 0">No feedback given yet.</div>';
    } else {
      fbEl.innerHTML = feedback.map(f => {
        const stars = Math.round(f.rating || 0);
        return `
          <div style="background:var(--bg3);border-radius:10px;padding:.8rem;margin-bottom:.6rem">
            <div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
              <span style="font-size:.82rem;font-weight:600">${esc(f.task_title || '—')}</span>
              <span style="color:#f59e0b;font-size:.9rem">${'★'.repeat(stars)}${'☆'.repeat(5-stars)}</span>
            </div>
            <div style="font-size:.78rem;color:var(--text2);font-style:italic">"${esc(f.comment || 'No comment.')}"</div>
            <div style="font-size:.68rem;color:var(--text3);margin-top:.3rem">
              by ${esc(f.given_by_name || '—')} · ${f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : ''}
            </div>
          </div>`;
      }).join('');
    }

    document.getElementById('idmLoading').style.display = 'none';
    document.getElementById('idmContent').style.display = '';

  } catch (err) {
    console.error('Intern detail error:', err);
    document.getElementById('idmLoading').style.display  = 'none';
    document.getElementById('idmError').style.display    = '';
    document.getElementById('idmErrorMsg').textContent   = err.message || 'Could not load intern details.';
  }
};

function closeInternDetailModal() {
  document.getElementById('internDetailModal').classList.remove('open');
}

// ── LOAD PENDING REVIEWS ─────────────────────────────────────
async function loadPendingReviews() {
  const list = document.getElementById('reviewList');
  if (!list) return;

  try {
    const tasks    = await TasksService.getAll({ status: 'submitted' });
    const inReview = await TasksService.getAll({ status: 'in_review' });
    const all      = [...(tasks || []), ...(inReview || [])];

    if (!all.length) {
      list.innerHTML = '<div class="loading-state">No pending reviews 🎉</div>';
      return;
    }

    list.innerHTML = all.map(t => `
      <div class="review-item" data-taskid="${t.id}"
           data-title="${esc(t.title)}" data-intern="${esc(t.intern_name || '')}">
        <div class="review-item-top">
          <span class="review-item-title">${esc(t.title)}</span>
          <span style="font-size:.65rem;font-weight:600;padding:.15rem .5rem;border-radius:100px;
                       background:rgba(59,130,246,.12);color:#60a5fa">${t.status}</span>
        </div>
        <div class="review-item-intern">👤 ${esc(t.intern_name || '—')}</div>
        <div class="review-item-time">Submitted ${t.submitted_at ? timeAgo(t.submitted_at) : '—'}</div>
      </div>`).join('');

    // Attach listeners — no inline onclick
    list.querySelectorAll('.review-item').forEach(item => {
      item.addEventListener('click', () => {
        openReviewModal(
          parseInt(item.dataset.taskid),
          item.dataset.title,
          item.dataset.intern
        );
      });
    });

  } catch (err) {
    console.error('Reviews error:', err);
    list.innerHTML = '<div class="loading-state">Could not load reviews.</div>';
  }
}

// ── LEADERBOARD ───────────────────────────────────────────────
async function loadLeaderboard() {
  const lb = document.getElementById('leaderboard');
  if (!lb || !allInterns.length) return;

  const sorted  = [...allInterns].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  const medals  = ['gold', 'silver', 'bronze'];

  lb.innerHTML = sorted.slice(0, 8).map((i, idx) => {
    const av    = (i.full_name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const score = parseFloat(i.overall_score ?? 0).toFixed(1);
    return `
      <div class="lb-item">
        <div class="lb-rank ${medals[idx] || ''}">${idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}</div>
        <div class="lb-avatar">${av}</div>
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

    const typeIcons = {
      task_approved: '✅', task_assigned: '📋',
      task_revision: '🔄', system: '📢', feedback_given: '💬',
    };

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
      setTimeout(loadLeaderboard, 500);
      return;
    }

    const actionIcons  = { task_submitted:'📋', task_approved:'✅', task_revision:'🔄', logged_in:'🔑', feedback_given:'💬' };
    const actionColors = {
      task_submitted: 'var(--orange-glow)',
      task_approved:  'rgba(39,201,63,.15)',
      task_revision:  'rgba(255,60,60,.12)',
      logged_in:      'rgba(59,130,246,.12)',
    };

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
  document.getElementById('taskTitle').value          = '';
  document.getElementById('taskCategory').value       = '';
  document.getElementById('taskAssignTo').value       = '';
  document.getElementById('taskDescription').value    = '';
}

async function handleAssignTask() {
  const title       = document.getElementById('taskTitle').value.trim();
  const category    = document.getElementById('taskCategory').value;
  const assigned_to = document.getElementById('taskAssignTo').value;
  const priority    = document.getElementById('taskPriority').value;
  const due_date    = document.getElementById('taskDueDate').value;
  const description = document.getElementById('taskDescription').value.trim();
  const errEl       = document.getElementById('modalError');

  if (!title || !category || !assigned_to) {
    errEl.textContent   = 'Please fill in Title, Category and Assign To.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('submitTask');
  btn.disabled    = true;
  btn.textContent = 'Assigning…';

  try {
    await TasksService.create({
      title, description, category, priority,
      assigned_to: parseInt(assigned_to),
      due_date: due_date || undefined,
    });
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
  document.getElementById('reviewComment').value       = '';
  document.getElementById('reviewError').style.display = 'none';
  document.getElementById('reviewTaskInfo').innerHTML  = `
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
    toast.style.cssText = `
      position:fixed;bottom:2rem;right:2rem;z-index:9999;
      background:var(--card);border:1px solid var(--border);
      border-radius:12px;padding:1rem 1.3rem;
      box-shadow:0 20px 60px rgba(0,0,0,.3);font-size:.88rem;
      transform:translateY(100px);opacity:0;
      transition:all .4s cubic-bezier(.34,1.56,.64,1);`;
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