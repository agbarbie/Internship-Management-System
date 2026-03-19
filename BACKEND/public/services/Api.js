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

// ── Absolute login path — works from ANY folder depth ────────
// Using an absolute path from the server root eliminates all
// relative-path arithmetic that breaks when folder depth changes.
function getLoginPath() {
  return '/login/login.html';
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
// ═══════════════════════════════════════════════════════════════
export const AuthService = {
  async register(payload) {
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

  // ── FIX 1 (continued): logout always navigates to login ──────
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

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = getLoginPath();
    }
  },

  getDisplayName() {
    const u = this.getCurrentUser();
    if (!u) return '';
    const last = u.last_name ? u.last_name[0] + '.' : '';
    return `${u.first_name} ${last}`.trim();
  },

  getInitials() {
    const u = this.getCurrentUser();
    if (!u) return '??';
    return `${(u.first_name || '')[0] || ''}${(u.last_name || '')[0] || ''}`.toUpperCase();
  },
};

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD SERVICE
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
// ═══════════════════════════════════════════════════════════════
export const TasksService = {
  getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/tasks${qs ? `?${qs}` : ''}`);
  },
  getById(id) {
    return apiFetch(`/tasks/${id}`);
  },
  create(payload) {
    return apiFetch('/tasks', { method: 'POST', body: JSON.stringify(payload) });
  },
  submit(id, payload) {
    return apiFetch(`/tasks/${id}/submit`, { method: 'POST', body: JSON.stringify(payload) });
  },
  review(id, payload) {
    return apiFetch(`/tasks/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  getFiles(id) {
    return apiFetch(`/tasks/${id}/files`);
  },
};

// ═══════════════════════════════════════════════════════════════
//  INTERNS SERVICE
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