// ═══════════════════════════════════════════════════════════════
//  dashboard.js  ─  Replaces inline <script> in dashboard.html
//  Connects to: /api/dashboard/stats, /api/dashboard/activity,
//               /api/dashboard/notifications, /api/interns
// ═══════════════════════════════════════════════════════════════
import { AuthService, DashboardService, InternsService } from '../services/api.js';

// ── Theme ─────────────────────────────────────────────────────
const html   = document.documentElement;
const toggle = document.getElementById('themeToggle');
html.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
toggle?.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// ── Sidebar helpers ───────────────────────────────────────────
window.toggleSidebar = () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
};
window.closeSidebar = () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
};

// ── Logout ────────────────────────────────────────────────────
window.logout = () => AuthService.logout();

// ── Populate user info from token cache ──────────────────────
const user     = AuthService.getCurrentUser();
const initials = AuthService.getInitials();

setEl('sidebarAvatar', initials);
setEl('topAvatar',     initials);
setEl('sidebarName',   AuthService.getDisplayName());
setEl('sidebarRole',   `${cap(user?.role || 'Intern')} · ${user?.organization || 'InternHub'}`);

const hour  = new Date().getHours();
const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
setEl('greetingText', `Good ${greet}, ${user?.first_name || 'there'} 👋`);

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadActivity();
  loadInterns();
});

// ── Stats + Donut + Task list ─────────────────────────────────
async function loadStats() {
  try {
    const data  = await DashboardService.getStats();

    if (user?.role === 'intern') {
      // data.stats is a single row from v_dashboard_stats
      const s = data.stats || {};
      updateStatCards({
        total:     s.total_tasks    ?? 0,
        submitted: s.submitted      ?? 0,
        pending:   s.pending        ?? 0,
        approved:  s.approved       ?? 0,
        revision:  s.needs_revision ?? 0,
        score:     parseFloat(s.avg_rating ?? 0).toFixed(1),
      });
      updateDonut(s.approved ?? 0, s.pending ?? 0, s.submitted ?? 0);
    } else {
      // Supervisor: data.stats is an array
      const rows = Array.isArray(data.stats) ? data.stats : [];
      const totals = rows.reduce((acc, s) => ({
        total:     acc.total     + (s.total_tasks    || 0),
        submitted: acc.submitted + (s.submitted      || 0),
        pending:   acc.pending   + (s.pending        || 0),
        approved:  acc.approved  + (s.approved       || 0),
        revision:  acc.revision  + (s.needs_revision || 0),
        score:     acc.score     + parseFloat(s.avg_rating || 0),
      }), { total: 0, submitted: 0, pending: 0, approved: 0, revision: 0, score: 0 });

      totals.score = rows.length ? (totals.score / rows.length).toFixed(1) : '—';
      updateStatCards(totals);
      updateDonut(totals.approved, totals.pending, totals.submitted);

      // Populate intern task list for supervisor
      if (data.overview?.length) {
        buildTaskList(data.overview.slice(0, 5).map(o => ({
          title:      o.full_name,
          due:        '',
          dueClass:   '',
          done:       false,
          meta:       `${o.department || '—'} · ${o.tasks_completed ?? 0}/${o.tasks_total ?? 0} tasks`,
        })));
      }
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

function updateStatCards({ total, submitted, pending, score }) {
  // Maps to the 4 .stat-num elements in order: Total, Submitted, Pending, Score
  const nums = document.querySelectorAll('.stat-num');
  if (nums[0]) nums[0].textContent = total;
  if (nums[1]) nums[1].textContent = submitted;
  if (nums[2]) nums[2].textContent = pending;
  if (nums[3]) nums[3].textContent = score;
}

function updateDonut(approved, pending, inProgress) {
  // Update the legend values (the SVG stays static — easier than dynamic SVG math)
  const vals = document.querySelectorAll('.legend-val');
  if (vals[0]) vals[0].textContent = approved;
  if (vals[1]) vals[1].textContent = pending;
  if (vals[2]) vals[2].textContent = inProgress;

  const total = approved + pending + inProgress || 1;
  const pct   = Math.round((approved / total) * 100);
  const svgText = document.querySelector('.donut-svg text');
  if (svgText) svgText.textContent = `${pct}%`;
}

// ── Activity feed ─────────────────────────────────────────────
async function loadActivity() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  try {
    const rows = await DashboardService.getActivity();
    if (!rows?.length) {
      feed.innerHTML = '<div class="activity-item"><div class="activity-text" style="color:var(--text3)">No recent activity.</div></div>';
      return;
    }

    const actionIcons = {
      task_submitted: '📋', task_approved: '✅', task_revision: '🔄',
      login: '🔑', feedback_given: '💬',
    };
    const actionColors = {
      task_submitted: 'var(--orange-glow)', task_approved: 'rgba(39,201,63,.15)',
      task_revision: 'rgba(255,60,60,.12)', login: 'rgba(59,130,246,.12)',
    };

    feed.innerHTML = rows.map(a => {
      const icon  = actionIcons[a.action]  || '📌';
      const color = actionColors[a.action] || 'rgba(255,107,0,.1)';
      const meta  = a.meta ? JSON.parse(a.meta) : {};
      return `
        <div class="activity-item">
          <div class="activity-icon" style="background:${color}">${icon}</div>
          <div class="activity-content">
            <div class="activity-text">
              <strong>${esc(a.user_name)}</strong> — ${esc(a.action.replace(/_/g, ' '))}
              ${meta.submission_type ? `<em>(${meta.submission_type})</em>` : ''}
            </div>
            <div class="activity-time">${timeAgo(a.created_at)}</div>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Activity error:', err);
  }
}

// ── Intern overview table ─────────────────────────────────────
async function loadInterns() {
  const tbody = document.getElementById('internBody');
  if (!tbody) return;

  try {
    const rows = await InternsService.getAll();
    // rows come from v_intern_overview
    window._allInterns = rows; // cache for filterInterns()
    renderInterns(rows);
  } catch (err) {
    console.error('Interns error:', err);
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text3)">Could not load interns.</td></tr>';
  }
}

function renderInterns(data) {
  const tbody = document.getElementById('internBody');
  if (!tbody) return;

  tbody.innerHTML = data.map(i => {
    const progress    = i.tasks_total ? Math.round((i.tasks_completed / i.tasks_total) * 100) : 0;
    const score       = parseFloat(i.overall_score ?? 0).toFixed(1);
    const statusLabel = progress === 100 ? 'Active' : progress >= 50 ? 'Review' : 'Pending';
    const statusClass = { Active: 'sb-active', Review: 'sb-review', Pending: 'sb-pending' }[statusLabel];
    const initials    = `${(i.first_name || '')[0] || ''}${(i.last_name || '')[0] || ''}`.toUpperCase();
    return `
      <tr>
        <td><div class="intern-name-cell"><div class="intern-av">${initials}</div>${esc(i.full_name || `${i.first_name} ${i.last_name}`)}</div></td>
        <td style="color:var(--text2)">${esc(i.department || '—')}</td>
        <td>${i.tasks_completed ?? 0}/${i.tasks_total ?? 0}</td>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem">
            <div class="progress-mini"><div class="progress-mini-fill" style="width:${progress}%"></div></div>
            <span style="font-size:.72rem;color:var(--text2)">${progress}%</span>
          </div>
        </td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td style="font-weight:600;color:var(--orange)">${score}</td>
      </tr>`;
  }).join('');
}

// Exposed for the HTML oninput
window.filterInterns = (val) => {
  if (!window._allInterns) return;
  const q = val.toLowerCase();
  renderInterns(window._allInterns.filter(i =>
    (i.full_name || `${i.first_name} ${i.last_name}`).toLowerCase().includes(q) ||
    (i.department || '').toLowerCase().includes(q)
  ));
};

// ── Task list builder (for supervisor mode) ───────────────────
function buildTaskList(items) {
  const list = document.getElementById('taskList');
  if (!list) return;
  list.innerHTML = items.map(t => `
    <div class="task-item">
      <div class="task-cb ${t.done ? 'checked' : ''}"></div>
      <div class="task-content">
        <div class="task-title-sm ${t.done ? 'done' : ''}">${esc(t.title)}</div>
        <div class="task-meta">${esc(t.meta)}</div>
      </div>
      ${t.due ? `<span class="task-due ${t.dueClass}">${esc(t.due)}</span>` : ''}
    </div>`).join('');

  list.querySelectorAll('.task-cb').forEach(cb =>
    cb.addEventListener('click', () => {
      cb.classList.toggle('checked');
      cb.nextElementSibling.querySelector('.task-title-sm').classList.toggle('done');
    })
  );
}

// Expose for HTML onclick
window.toggleTask = (cb) => {
  cb.classList.toggle('checked');
  cb.nextElementSibling.querySelector('.task-title-sm').classList.toggle('done');
};

// ── Chart (static week data — swap for real data if you add a chart endpoint) ──
document.addEventListener('DOMContentLoaded', () => {
  const chart = document.getElementById('progressChart');
  if (!chart) return;
  const days      = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const submitted = [4,6,3,8,5,2,7];
  const approved  = [2,5,3,6,4,1,5];
  const maxVal    = Math.max(...submitted);
  days.forEach((d, i) => {
    const wrap = document.createElement('div'); wrap.className = 'chart-bar-wrap';
    const sBar = document.createElement('div'); sBar.className = 'chart-bar';
    sBar.style.cssText = `height:${(submitted[i]/maxVal)*120}px;background:var(--orange);`;
    sBar.innerHTML = `<div class="chart-bar-tip">${submitted[i]} tasks</div>`;
    const aBar = document.createElement('div'); aBar.className = 'chart-bar';
    aBar.style.cssText = `height:${(approved[i]/maxVal)*120}px;background:rgba(59,130,246,.5);`;
    aBar.innerHTML = `<div class="chart-bar-tip">${approved[i]} approved</div>`;
    const lbl = document.createElement('div'); lbl.className = 'chart-label'; lbl.textContent = d;
    wrap.append(sBar, aBar, lbl);
    chart.appendChild(wrap);
  });
});

// ── Helpers ───────────────────────────────────────────────────
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} hour${h>1?'s':''} ago`;
  return `${Math.floor(h/24)} day${Math.floor(h/24)>1?'s':''} ago`;
}