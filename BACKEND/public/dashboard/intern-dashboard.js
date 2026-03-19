// ═══════════════════════════════════════════════════════════════
//  intern-dashboard.js
//  Connects to: /api/dashboard/stats, /api/dashboard/activity,
//               /api/dashboard/notifications, /api/tasks,
//               /api/tasks/:id (for feedback via getById)
//
//  FIXES vs previous version:
//   • loadFeedback() implemented — was missing entirely
//   • task-item clicks use addEventListener, not inline onclick
//     (prevents SyntaxError when task title has apostrophes)
//   • Auth redirects use consistent relative paths
// ═══════════════════════════════════════════════════════════════
import { AuthService, DashboardService, TasksService } from '../services/api.js';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Auth guard ──────────────────────────────────────────────
  if (!AuthService.isLoggedIn()) {
    window.location.href = '../login/login.html';
    return;
  }

  const user = AuthService.getCurrentUser();
  if (user?.role === 'supervisor' || user?.role === 'admin') {
    window.location.href = '../dashboard/supervisor-dashboard.html';
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
  const initials    = AuthService.getInitials();
  const displayName = AuthService.getDisplayName();
  setEl('sidebarAvatar', initials);
  setEl('topAvatar',     initials);
  setEl('welcomeAvatar', initials);
  setEl('sidebarName',   displayName);
  setEl('welcomeName',   `${user?.first_name || ''} ${user?.last_name || ''}`.trim());
  setEl('sidebarRole',   `Intern · ${user?.organization || 'InternHub'}`);
  setEl('welcomeMeta',   `${user?.department || 'Intern'} · ${user?.organization || 'InternHub'}`);

  // Skills tags
  if (user?.skills?.length) {
    document.getElementById('welcomeTags').innerHTML =
      user.skills.slice(0, 4).map(s => `<span class="welcome-tag">${esc(s)}</span>`).join('');
  }

  // Greeting
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  setEl('greetingText', `Good ${greet}, ${user?.first_name || 'there'} 👋`);

  // ── Load everything in parallel ─────────────────────────────
  await Promise.all([
    loadStats(),
    loadTasks('all'),
    loadNotifications(),
    loadActivity(),
    loadFeedback(),   // ← was missing before
  ]);

  // ── Task filter tabs ────────────────────────────────────────
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadTasks(tab.dataset.status);
    });
  });

  // ── Mark notifications read ─────────────────────────────────
  document.getElementById('markReadBtn')?.addEventListener('click', async () => {
    await DashboardService.markNotificationsRead();
    loadNotifications();
  });
});

// ── LOAD STATS ───────────────────────────────────────────────
async function loadStats() {
  try {
    const data    = await DashboardService.getStats();
    const s       = data?.stats || {};
    const profile = data?.profile || {};

    setEl('statTotal',    s.total_tasks ?? '0');
    setEl('statApproved', s.approved    ?? '0');
    setEl('statPending',  s.pending     ?? '0');
    setEl('statScore',    parseFloat(s.avg_rating ?? 0).toFixed(1));

    // Pending badge
    const pending = parseInt(s.pending ?? 0);
    setEl('pendingBadge', pending);
    const badgeEl = document.getElementById('pendingBadge');
    if (badgeEl) badgeEl.style.display = pending > 0 ? '' : 'none';

    // Score arc animation
    const score = parseFloat(s.avg_rating ?? 0);
    const arc   = Math.round((score / 5) * 100);
    const arcEl = document.getElementById('scoreArc');
    if (arcEl) {
      setTimeout(() => {
        arcEl.setAttribute('stroke-dasharray', `${arc} ${100 - arc}`);
      }, 300);
    }
    setEl('scoreText', score.toFixed(1));

    // Score breakdown
    setEl('sbApproved',  s.approved  ?? 0);
    setEl('sbSubmitted', s.submitted ?? 0);
    setEl('sbPending',   s.pending   ?? 0);
    setEl('sbOverdue',   s.overdue   ?? 0);

    // Internship progress bar
    const completed = parseInt(s.approved     ?? 0);
    const total     = parseInt(s.total_tasks  ?? 1);
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    setEl('progressPct', `${pct}%`);
    const fill = document.getElementById('progressFill');
    if (fill) setTimeout(() => { fill.style.width = `${pct}%`; }, 300);

    // Dates from profile
    if (profile.start_date && profile.end_date) {
      const fmt  = d => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
      setEl('welcomeDates', `${fmt(profile.start_date)} → ${fmt(profile.end_date)}${profile.university ? ' · ' + profile.university : ''}`);
    }

  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ── LOAD TASKS ───────────────────────────────────────────────
async function loadTasks(statusFilter = 'all') {
  const list = document.getElementById('myTaskList');
  if (!list) return;
  list.innerHTML = '<div class="loading-state">Loading tasks...</div>';

  try {
    const params = statusFilter !== 'all' ? { status: statusFilter } : {};
    const tasks  = await TasksService.getAll(params);

    if (!tasks?.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-text">No ${statusFilter !== 'all' ? statusFilter : ''} tasks found.</div>
        </div>`;
      return;
    }

    const catIcons = {
      Design: '🎨', Development: '💻', 'Data Science': '📊',
      Report: '📝', Marketing: '📣', Finance: '💰', Other: '📌',
    };

    // FIX: build elements, attach listeners — no inline onclick (avoids apostrophe crash)
    list.innerHTML = '';
    tasks.forEach(t => {
      const icon      = catIcons[t.category] || '📌';
      const stClass   = `sb-${t.status}`;
      const stLabel   = {
        pending:   'Pending',
        submitted: 'Submitted',
        approved:  'Approved',
        revision:  'Revision',
        in_review: 'In Review',
      }[t.status] || t.status;

      const dueDate   = t.due_date ? new Date(t.due_date) : null;
      const isOverdue = dueDate && dueDate < new Date() && !['approved','rejected'].includes(t.status);
      const isSoon    = dueDate && !isOverdue && (dueDate - new Date()) < 86400000 * 3;
      const dueStr    = dueDate ? dueDate.toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '';
      const dueClass  = isOverdue ? 'due-late' : isSoon ? 'due-soon' : '';

      const item = document.createElement('div');
      item.className = 'task-item';
      item.innerHTML = `
        <div class="task-item-icon">${icon}</div>
        <div class="task-item-content">
          <div class="task-item-title">${esc(t.title)}</div>
          <div class="task-item-meta">${esc(t.category)} · ${esc(t.supervisor_name || 'Supervisor')}</div>
        </div>
        <div class="task-item-right">
          <span class="status-badge ${stClass}">${stLabel}</span>
          ${dueStr ? `<span class="due-label ${dueClass}">${isOverdue ? '⚠ ' : ''}${dueStr}</span>` : ''}
        </div>`;

      // Safe click — no inline onclick string interpolation
      item.addEventListener('click', () => {
        window.location.href = '../Tasks/tasks.html';
      });

      list.appendChild(item);
    });

  } catch (err) {
    console.error('Tasks error:', err);
    list.innerHTML = '<div class="empty-state"><div class="empty-text">Could not load tasks.</div></div>';
  }
}

// ── LOAD FEEDBACK ─────────────────────────────────────────────
// Fetches all intern's tasks then collects feedback from approved ones.
// Falls back gracefully if the backend doesn't return feedback on the
// list endpoint — in that case it shows a friendly empty state.
async function loadFeedback() {
  const feedbackList = document.getElementById('feedbackList');
  if (!feedbackList) return;

  try {
    // Get all approved tasks for this intern
    const tasks = await TasksService.getAll({ status: 'approved' });

    if (!tasks?.length) {
      feedbackList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-text">No feedback yet. Keep submitting tasks!</div>
        </div>`;
      return;
    }

    // Fetch details for up to 5 most recent approved tasks to get feedback
    const detailPromises = tasks.slice(0, 5).map(t =>
      TasksService.getById(t.id).catch(() => null)
    );
    const details = await Promise.all(detailPromises);

    // Flatten all feedback entries
    const allFeedback = details
      .filter(Boolean)
      .flatMap(d => (d.feedback || []).map(f => ({ ...f, task_title: d.task?.title || '—' })));

    if (!allFeedback.length) {
      feedbackList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-text">No feedback received yet.</div>
        </div>`;
      return;
    }

    // Sort newest first
    allFeedback.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    feedbackList.innerHTML = allFeedback.slice(0, 6).map(f => {
      const stars    = Math.round(f.rating || 0);
      const starStr  = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      const dateStr  = f.created_at
        ? new Date(f.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
        : '';
      return `
        <div class="feedback-item">
          <div class="feedback-top">
            <span class="feedback-task">${esc(f.task_title)}</span>
            <span class="feedback-stars">${starStr}</span>
          </div>
          <div class="feedback-comment">"${esc(f.comment || 'No comment provided.')}"</div>
          <div class="feedback-by">by ${esc(f.given_by_name || f.given_by || 'Supervisor')}${dateStr ? ' · ' + dateStr : ''}</div>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('Feedback error:', err);
    feedbackList.innerHTML = `
      <div class="empty-state">
        <div class="empty-text">Could not load feedback.</div>
      </div>`;
  }
}

// ── LOAD NOTIFICATIONS ───────────────────────────────────────
async function loadNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;

  try {
    const notifs = await DashboardService.getNotifications();
    const unread = notifs?.filter(n => !n.is_read).length || 0;

    setEl('notifBadge', unread);
    const badgeEl = document.getElementById('notifBadge');
    const dotEl   = document.getElementById('notifDot');
    if (badgeEl) badgeEl.style.display = unread > 0 ? '' : 'none';
    if (dotEl)   dotEl.style.display   = unread > 0 ? '' : 'none';

    if (!notifs?.length) {
      list.innerHTML = '<div class="loading-state">No notifications yet.</div>';
      return;
    }

    const typeIcons = {
      task_approved:    '✅',
      task_assigned:    '📋',
      task_revision:    '🔄',
      task_rejected:    '❌',
      feedback_given:   '💬',
      deadline_reminder:'⏰',
      system:           '📢',
    };

    list.innerHTML = notifs.slice(0, 8).map(n => `
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
    list.innerHTML = '<div class="loading-state">Could not load notifications.</div>';
  }
}

// ── LOAD ACTIVITY ────────────────────────────────────────────
async function loadActivity() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  try {
    const rows = await DashboardService.getActivity();

    if (!rows?.length) {
      feed.innerHTML = '<div class="empty-state"><div class="empty-text">No recent activity.</div></div>';
      return;
    }

    const actionIcons = {
      task_submitted: '📋',
      task_approved:  '✅',
      task_revision:  '🔄',
      logged_in:      '🔑',
      feedback_given: '💬',
      registered:     '🎉',
    };
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
            <strong>${esc(a.action.replace(/_/g, ' '))}</strong>
          </div>
          <div class="activity-time">${timeAgo(a.created_at)}</div>
        </div>
      </div>`).join('');

  } catch (err) {
    console.error('Activity error:', err);
    feed.innerHTML = '<div class="empty-state"><div class="empty-text">Could not load activity.</div></div>';
  }
}

// ── HELPERS ──────────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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