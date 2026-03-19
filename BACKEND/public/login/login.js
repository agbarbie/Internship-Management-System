// ═══════════════════════════════════════════════════════════════
//  login.js  ─  InternHub Login Page
//  Place at: public/login/login.js
// ═══════════════════════════════════════════════════════════════
import { AuthService, ApiError } from '../services/api.js';

document.addEventListener('DOMContentLoaded', () => {

  // ── Redirect if already logged in ────────────────────────────
  if (AuthService.isLoggedIn()) {
  const user = AuthService.getCurrentUser();
  if (user?.role === 'supervisor' || user?.role === 'admin') {
    window.location.href = '../dashboard/supervisor-dashboard.html';
  } else {
    window.location.href = '../dashboard/intern-dashboard.html';
  }
  return;
}

  // ── Theme ─────────────────────────────────────────────────────
  const html   = document.documentElement;
  const toggle = document.getElementById('themeToggle');

  // Apply saved theme immediately to prevent flash
  const savedTheme = localStorage.getItem('theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);

  toggle?.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  // ── Role tabs (visual only) ───────────────────────────────────
  document.querySelectorAll('.role-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // ── Toggle password visibility ────────────────────────────────
  document.getElementById('togglePass')?.addEventListener('click', () => {
    const p = document.getElementById('password');
    if (p) p.type = p.type === 'password' ? 'text' : 'password';
  });

  // ── Helper: show/hide messages ────────────────────────────────
  function showError(message) {
    const el = document.getElementById('errorMsg');
    if (!el) return;
    el.textContent   = message;
    el.style.display = 'block';
  }

  function hideError() {
    const el = document.getElementById('errorMsg');
    if (el) el.style.display = 'none';
  }

  function showSuccess(message) {
    const el = document.getElementById('successMsg');
    if (!el) return;
    el.textContent   = message;
    el.style.display = 'block';
  }

  function hideSuccess() {
    const el = document.getElementById('successMsg');
    if (el) el.style.display = 'none';
  }

  // ── Form validation ───────────────────────────────────────────
  function validateForm(email, password) {
    if (!email) {
      showError('Please enter your email address.');
      return false;
    }
    if (!email.includes('@') || !email.includes('.')) {
      showError('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      showError('Please enter your password.');
      return false;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return false;
    }
    return true;
  }

  // ── Login form submit ─────────────────────────────────────────
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email     = document.getElementById('email')?.value.trim();
    const password  = document.getElementById('password')?.value;
    const submitBtn = e.target.querySelector('[type="submit"]');

    // Reset messages
    hideError();
    hideSuccess();

    // Validate
    if (!validateForm(email, password)) return;

    // Set loading state
    const originalText    = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled    = true;
      submitBtn.textContent = 'Signing in…';
    }

    try {
      // Call backend API
      const response = await AuthService.login({ email, password });

      // Show success
      showSuccess('Login successful! Redirecting…');

      // Get user role for redirect
      const user = AuthService.getCurrentUser();
      console.log('✅ Logged in as:', user?.role, user?.first_name);

      // Redirect based on role
      setTimeout(() => {
  const user = AuthService.getCurrentUser();
  if (user?.role === 'supervisor' || user?.role === 'admin') {
    window.location.href = '../dashboard/supervisor-dashboard.html';
  } else {
    window.location.href = '../dashboard/intern-dashboard.html';
  }
}, 900);

    } catch (err) {
      // Show error from backend
      const message = err instanceof ApiError
        ? err.message
        : 'Login failed. Please check your connection and try again.';
      showError(message);

      // Reset button
      if (submitBtn) {
        submitBtn.disabled    = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  // ── Live input validation (clear errors as user types) ────────
  document.getElementById('email')?.addEventListener('input', () => {
    hideError();
  });

  document.getElementById('password')?.addEventListener('input', () => {
    hideError();
  });

  // ── Forgot password (placeholder) ────────────────────────────
  document.querySelector('.forgot-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showError('Password reset coming soon. Contact your supervisor to reset.');
  });

  // ── Google login (placeholder) ────────────────────────────────
  document.querySelector('.btn-social')?.addEventListener('click', (e) => {
    e.preventDefault();
    showError('Google login coming soon.');
  });

}); // end DOMContentLoaded