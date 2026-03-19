// ═══════════════════════════════════════════════════════════════
//  api.js  ─  InternHub API Service Layer
//  Place at: FRONTEND/services/api.js
// ═══════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:3000/api';

// ── TOKEN / SESSION HELPERS ───────────────────────────────────
export const TokenService = {
  get:        ()       => localStorage.getItem('internhub_token'),
  set:        (t)      => localStorage.setItem('internhub_token', t),
  remove:     ()       => localStorage.removeItem('internhub_token'),
  getUser:    ()       => { try { return JSON.parse(localStorage.getItem('internhub_user')); } catch { return null; } },
  setUser:    (u)      => localStorage.setItem('internhub_user', JSON.stringify(u)),
  removeUser: ()       => localStorage.removeItem('internhub_user'),
  clear:      ()       => { TokenService.remove(); TokenService.removeUser(); },
};

// ── BASE FETCH ────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = TokenService.get();
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };

  const res  = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      TokenService.clear();
      window.location.href = getLoginPath();
      return;
    }
    throw new ApiError(data.error || 'Request failed', res.status);
  }
  return data;
}

function getLoginPath() {
  // Works from any subfolder depth
  const depth = window.location.pathname.split('/').filter(Boolean).length;
  const prefix = depth > 1 ? '../'.repeat(depth - 1) : './';
  return `${prefix}Login page/login.html`;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
  }
}

// ═══════════════════════════════════════════════════════════════
//  AUTH SERVICE
//  Backend responses: { token, user: { id, first_name, last_name, email, role, ... } }
// ═══════════════════════════════════════════════════════════════
export const AuthService = {
  async register(payload) {
    // payload: { first_name, last_name, email, password, role, organization, department }
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data?.token) {
      TokenService.set(data.token);
      TokenService.setUser(data.user);
    }
    return data;
  },

  async login(payload) {
    // payload: { email, password }
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data?.token) {
      TokenService.set(data.token);
      TokenService.setUser(data.user);
    }
    return data;
  },

  async getMe() {
    return apiFetch('/auth/me');
  },

  logout() {
    TokenService.clear();
    window.location.href = getLoginPath();
  },

  isLoggedIn() {
    return !!TokenService.get();
  },

  getCurrentUser() {
    return TokenService.getUser();
  },

  // Call at the top of every protected page
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = getLoginPath();
    }
  },

  // Returns display name: "James K."
  getDisplayName() {
    const u = this.getCurrentUser();
    if (!u) return '';
    const last = u.last_name ? u.last_name[0] + '.' : '';
    return `${u.first_name} ${last}`.trim();
  },

  // Returns 2-letter initials: "JK"
  getInitials() {
    const u = this.getCurrentUser();
    if (!u) return '??';
    return `${(u.first_name || '')[0] || ''}${(u.last_name || '')[0] || ''}`.toUpperCase();
  },
};

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD SERVICE
//  Intern  → { stats: {...}, profile: {...} }
//  Supervisor → { stats: [...], overview: [...] }
// ═══════════════════════════════════════════════════════════════
export const DashboardService = {
  getStats() {
    return apiFetch('/dashboard/stats');
  },
  getActivity() {
    return apiFetch('/dashboard/activity');
  },
  getNotifications() {
    return apiFetch('/dashboard/notifications');
  },
  markNotificationsRead() {
    return apiFetch('/dashboard/notifications/read', { method: 'PATCH' });
  },
};

// ═══════════════════════════════════════════════════════════════
//  TASKS SERVICE
//  GET /api/tasks          → array of task rows (with intern_name, supervisor_name)
//  GET /api/tasks/:id      → { task, submissions, feedback }
//  POST /api/tasks         → created task row  (supervisor)
//  POST /api/tasks/:id/submit → submission row (intern)
//  PATCH /api/tasks/:id/review → { message }   (supervisor)
// ═══════════════════════════════════════════════════════════════
export const TasksService = {
  getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/tasks${qs ? `?${qs}` : ''}`);
  },
  getById(id) {
    return apiFetch(`/tasks/${id}`);
  },
  // supervisor creates a task
  create(payload) {
    // payload: { title, description, category, priority, assigned_to, due_date, tags? }
    return apiFetch('/tasks', { method: 'POST', body: JSON.stringify(payload) });
  },
  // intern submits a task
  submit(id, payload) {
    // payload: { content, progress_pct, submission_type }
    return apiFetch(`/tasks/${id}/submit`, { method: 'POST', body: JSON.stringify(payload) });
  },
  // supervisor reviews
  review(id, payload) {
    // payload: { action: 'approve'|'revision'|'reject', rating?, comment? }
    return apiFetch(`/tasks/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  getFiles(id) {
    return apiFetch(`/tasks/${id}/files`);
  },
};

// ═══════════════════════════════════════════════════════════════
//  INTERNS SERVICE
//  GET /api/interns        → array from v_intern_overview
//  GET /api/interns/:id    → { intern, tasks, feedback }
// ═══════════════════════════════════════════════════════════════
export const InternsService = {
  getAll() {
    return apiFetch('/interns');
  },
  getById(id) {
    return apiFetch(`/interns/${id}`);
  },
};

// ═══════════════════════════════════════════════════════════════
//  HEALTH
// ═══════════════════════════════════════════════════════════════
export const HealthService = {
  ping() {
    return apiFetch('/health');
  },
};