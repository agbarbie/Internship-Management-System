// ═══════════════════════════════════════════════
//  login.js  ─  InternHub Login Page
// ═══════════════════════════════════════════════
import { AuthService, ApiError } from '../services/api.js';

document.addEventListener('DOMContentLoaded', () => {

  // Theme
  const html = document.documentElement;
  const savedTheme = localStorage.getItem('theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  // Role tabs
  document.querySelectorAll('.role-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Password toggle
  document.getElementById('togglePass')?.addEventListener('click', () => {
    const p = document.getElementById('password');
    const icon = document.querySelector('#togglePass i');
    if (!p) return;
    p.type = p.type === 'password' ? 'text' : 'password';
    icon?.classList.toggle('fa-eye');
    icon?.classList.toggle('fa-eye-slash');
  });

  // Messages
  function showError(msg) {
    const el = document.getElementById('errorMsg');
    const span = el?.querySelector('span');
    if (!el) return;
    if (span) span.textContent = msg; else el.textContent = msg;
    el.style.display = 'flex';
    document.getElementById('successMsg').style.display = 'none';
  }
  function hideError() { document.getElementById('errorMsg').style.display = 'none'; }
  function showSuccess(msg) {
    const el = document.getElementById('successMsg');
    const span = el?.querySelector('span');
    if (!el) return;
    if (span) span.textContent = msg; else el.textContent = msg;
    el.style.display = 'flex';
    document.getElementById('errorMsg').style.display = 'none';
  }

  // Validation
  function validate(email, password) {
    if (!email) { showError('Please enter your email address.'); return false; }
    if (!email.includes('@') || !email.includes('.')) { showError('Please enter a valid email address.'); return false; }
    if (!password) { showError('Please enter your password.'); return false; }
    if (password.length < 6) { showError('Password must be at least 6 characters.'); return false; }
    return true;
  }

  // Submit
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const btn = e.target.querySelector('[type="submit"]');
    hideError();
    if (!validate(email, password)) return;
    const originalHTML = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin fa-sm"></i> Signing in…'; }
    try {
      await AuthService.login({ email, password });
      showSuccess('Login successful! Redirecting…');
      setTimeout(() => {
        const user = AuthService.getCurrentUser();
        window.location.href = (user?.role === 'supervisor' || user?.role === 'admin')
          ? '/dashboard/supervisor-dashboard.html'
          : '/dashboard/intern-dashboard.html';
      }, 900);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Login failed. Please check your connection and try again.');
      if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
    }
  });

  // Live clear
  document.getElementById('email')?.addEventListener('input', hideError);
  document.getElementById('password')?.addEventListener('input', hideError);

  // Forgot password
  document.querySelector('.forgot-link')?.addEventListener('click', (e) => { e.preventDefault(); showError('Password reset coming soon. Contact your supervisor to reset.'); });

  // Google (placeholder)
  document.querySelector('.btn-social')?.addEventListener('click', (e) => { e.preventDefault(); showError('Google login coming soon.'); });

});