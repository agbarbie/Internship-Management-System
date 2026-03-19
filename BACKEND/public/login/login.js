// ═══════════════════════════════════════════════════════════════
//  login.js  ─  InternHub Login Page
//  Place at: FRONTEND/login/login.js
// ═══════════════════════════════════════════════════════════════
import { AuthService, ApiError } from '../services/api.js';

document.addEventListener('DOMContentLoaded', () => {

  // ── Do NOT auto-redirect logged-in users away from login ─────
  // Removed the block that bounced already-logged-in users to the
  // dashboard. A user who clicks "Sign in" should always see the
  // login form — they may want to switch accounts. The redirect
  // only happens AFTER a successful login below.

  // ── Theme ─────────────────────────────────────────────────────
  const html   = document.documentElement;
  const toggle = document.getElementById('themeToggle');

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

    hideError();

    if (!validateForm(email, password)) return;

    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled    = true;
      submitBtn.textContent = 'Signing in…';
    }

    try {
      await AuthService.login({ email, password });

      showSuccess('Login successful! Redirecting…');

      // Redirect based on role
      setTimeout(() => {
        const user = AuthService.getCurrentUser();
        if (user?.role === 'supervisor' || user?.role === 'admin') {
          window.location.href = '/dashboard/supervisor-dashboard.html';
        } else {
          window.location.href = '/dashboard/intern-dashboard.html';
        }
      }, 900);

    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : 'Login failed. Please check your connection and try again.';
      showError(message);

      if (submitBtn) {
        submitBtn.disabled    = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  // ── Live input validation ─────────────────────────────────────
  document.getElementById('email')?.addEventListener('input', hideError);
  document.getElementById('password')?.addEventListener('input', hideError);

  // ── Forgot password ───────────────────────────────────────────
  document.querySelector('.forgot-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showError('Password reset coming soon. Contact your supervisor to reset.');
  });

  // ── Google login (placeholder) ────────────────────────────────
  document.querySelector('.btn-social')?.addEventListener('click', (e) => {
    e.preventDefault();
    showError('Google login coming soon.');
  });

});