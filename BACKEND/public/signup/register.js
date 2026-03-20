// ═══════════════════════════════════════════════
//  register.js  —  InternHub Registration Page
// ═══════════════════════════════════════════════
import { AuthService, ApiError } from '../services/api.js';

// Theme
const html = document.documentElement;
html.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// Role redirect helper
function redirectToDashboard(role) {
  window.location.href = (role === 'supervisor' || role === 'admin')
    ? '/dashboard/supervisor-dashboard.html'
    : '/dashboard/intern-dashboard.html';
}

// Pre-select role from URL param
const roleParam = new URLSearchParams(window.location.search).get('role');
let selectedRole = roleParam === 'supervisor' ? 'supervisor' : 'intern';
if (roleParam === 'supervisor') {
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('roleSupervisor')?.classList.add('selected');
}
document.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedRole = card.dataset.role;
  });
});

// Multi-step navigation
let currentStep = 1;
window.goStep = function(step) {
  if (step > currentStep) {
    if (currentStep === 1) {
      const f = document.getElementById('firstName')?.value.trim();
      const l = document.getElementById('lastName')?.value.trim();
      const e = document.getElementById('regEmail')?.value.trim();
      if (!f || !l || !e || !e.includes('@')) { showErr('err1', true); return; }
      showErr('err1', false);
    }
    if (currentStep === 2) {
      const o = document.getElementById('org')?.value.trim();
      const p = document.getElementById('regPassword')?.value;
      const c = document.getElementById('confirmPassword')?.value;
      if (!o || !p || p.length < 8 || p !== c) { showErr('err2', true); return; }
      showErr('err2', false);
      const review = document.getElementById('reviewContent');
      if (review) review.innerHTML = `
        <strong>Name:</strong> ${document.getElementById('firstName').value} ${document.getElementById('lastName').value}<br>
        <strong>Email:</strong> ${document.getElementById('regEmail').value}<br>
        <strong>Phone:</strong> ${document.getElementById('phone')?.value || 'Not provided'}<br>
        <strong>Role:</strong> ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}<br>
        <strong>Organization:</strong> ${o}<br>
        <strong>Department:</strong> ${document.getElementById('dept')?.value || 'Not specified'}
      `;
    }
  }
  document.getElementById(`step${currentStep}`)?.classList.remove('active');
  const dotOld = document.getElementById(`dot${currentStep}`);
  dotOld?.classList.remove('active'); dotOld?.classList.add('done');
  currentStep = step;
  document.getElementById(`step${currentStep}`)?.classList.add('active');
  const dotNew = document.getElementById(`dot${currentStep}`);
  dotNew?.classList.remove('done'); dotNew?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Password strength
window.checkStrength = function(val) {
  const fill = document.getElementById('strengthFill');
  const text = document.getElementById('strengthText');
  if (!fill || !text) return;
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    {w:'0%',c:'transparent',t:'Too short'},
    {w:'25%',c:'#ff4444',t:'Weak'},
    {w:'50%',c:'#ff8c00',t:'Fair'},
    {w:'75%',c:'#ffd700',t:'Good'},
    {w:'100%',c:'#27c93f',t:'Strong'},
  ];
  const l = levels[score] || levels[0];
  fill.style.width = l.w; fill.style.background = l.c; text.textContent = l.t;
};

// Toggle password visibility (with FA icon swap)
window.togglePwd = function(inputId, btnId) {
  const input = document.getElementById(inputId);
  const icon = document.querySelector(`#${btnId} i`);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  icon?.classList.toggle('fa-eye');
  icon?.classList.toggle('fa-eye-slash');
};

// Submit
window.submitForm = async function() {
  if (!document.getElementById('terms')?.checked) { showErr('err3', true); return; }
  showErr('err3', false);
  const btn = document.querySelector('.btn-submit');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin fa-sm"></i> Creating account…'; }
  try {
    await AuthService.register({
      first_name:   document.getElementById('firstName')?.value.trim(),
      last_name:    document.getElementById('lastName')?.value.trim(),
      email:        document.getElementById('regEmail')?.value.trim(),
      password:     document.getElementById('regPassword')?.value,
      role:         selectedRole,
      organization: document.getElementById('org')?.value.trim(),
      department:   document.getElementById('dept')?.value,
      phone:        document.getElementById('phone')?.value.trim(),
    });
    document.querySelector('.form-card')
      ?.querySelectorAll('.terms-group,.btn-submit,.nav-btns,.error-msg,#reviewContent,.section-title-sm')
      .forEach(el => el.style.display = 'none');
    document.getElementById('successCard').style.display = 'block';
    setTimeout(() => redirectToDashboard(AuthService.getCurrentUser()?.role || selectedRole), 1800);
  } catch (err) {
    const el = document.getElementById('err3');
    if (el) { el.innerHTML = `<i class="fa-solid fa-circle-exclamation fa-sm"></i> ${err instanceof ApiError ? err.message : 'Registration failed. Please try again.'}`; el.style.display = 'flex'; }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus fa-sm"></i> Create Account'; }
  }
};

function showErr(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'flex' : 'none';
}