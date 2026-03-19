// ═══════════════════════════════════════════════════════════════
//  register.js  —  Full registration page logic
//  Loaded as: <script type="module" src="register.js"></script>
// ═══════════════════════════════════════════════════════════════
import { AuthService, ApiError } from '../services/api.js';

// ── Theme ─────────────────────────────────────────────────────
const html   = document.documentElement;
const toggle = document.getElementById('themeToggle');
html.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
toggle?.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// ── Redirect if already logged in ────────────────────────────
if (AuthService.isLoggedIn()) {
  window.location.href = '/dashboard/dashboard.html';
}

// ── Role selection ────────────────────────────────────────────
let selectedRole = 'intern';

document.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedRole = card.dataset.role;
  });
});

// ── Multi-step navigation ─────────────────────────────────────
let currentStep = 1;

window.goStep = function(step) {
  if (step > currentStep) {
    if (currentStep === 1) {
      const f = document.getElementById('firstName')?.value.trim();
      const l = document.getElementById('lastName')?.value.trim();
      const e = document.getElementById('regEmail')?.value.trim();
      if (!f || !l || !e || !e.includes('@')) {
        showErr('err1', true); return;
      }
      showErr('err1', false);
    }
    if (currentStep === 2) {
      const o = document.getElementById('org')?.value.trim();
      const p = document.getElementById('regPassword')?.value;
      const c = document.getElementById('confirmPassword')?.value;
      if (!o || !p || p.length < 8 || p !== c) {
        showErr('err2', true); return;
      }
      showErr('err2', false);
      const review = document.getElementById('reviewContent');
      if (review) {
        review.innerHTML = `
          <strong>Name:</strong> ${document.getElementById('firstName').value} ${document.getElementById('lastName').value}<br>
          <strong>Email:</strong> ${document.getElementById('regEmail').value}<br>
          <strong>Phone:</strong> ${document.getElementById('phone')?.value || 'Not provided'}<br>
          <strong>Role:</strong> ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}<br>
          <strong>Organization:</strong> ${o}<br>
          <strong>Department:</strong> ${document.getElementById('dept')?.value || 'Not specified'}
        `;
      }
    }
  }

  document.getElementById(`step${currentStep}`)?.classList.remove('active');
  const dotOld = document.getElementById(`dot${currentStep}`);
  dotOld?.classList.remove('active');
  dotOld?.classList.add('done');

  currentStep = step;
  document.getElementById(`step${currentStep}`)?.classList.add('active');
  const dotNew = document.getElementById(`dot${currentStep}`);
  dotNew?.classList.remove('done');
  dotNew?.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ── Password strength ─────────────────────────────────────────
window.checkStrength = function(val) {
  const fill = document.getElementById('strengthFill');
  const text = document.getElementById('strengthText');
  if (!fill || !text) return;
  let score = 0;
  if (val.length >= 8)          score++;
  if (/[A-Z]/.test(val))        score++;
  if (/[0-9]/.test(val))        score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { w:'0%',   c:'transparent', t:'Too short' },
    { w:'25%',  c:'#ff4444',     t:'Weak'      },
    { w:'50%',  c:'#ff8c00',     t:'Fair'      },
    { w:'75%',  c:'#ffd700',     t:'Good'      },
    { w:'100%', c:'#27c93f',     t:'Strong'    },
  ];
  const l = levels[score] || levels[0];
  fill.style.width = l.w; fill.style.background = l.c; text.textContent = l.t;
};

// ── Toggle password visibility ────────────────────────────────
window.togglePwd = function(id) {
  const i = document.getElementById(id);
  if (i) i.type = i.type === 'password' ? 'text' : 'password';
};

// ── Submit to backend ─────────────────────────────────────────
window.submitForm = async function() {
  if (!document.getElementById('terms')?.checked) {
    showErr('err3', true); return;
  }
  showErr('err3', false);

  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating account…'; }

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

    // Show success card
    document.querySelector('.form-card')
      ?.querySelectorAll('.terms-group,.btn-submit,.nav-btns,.error-msg,#reviewContent,.section-title-sm')
      .forEach(el => el.style.display = 'none');
    const card = document.getElementById('successCard');
    if (card) card.style.display = 'block';

  } catch (err) {
    const el = document.getElementById('err3');
    if (el) { el.textContent = err instanceof ApiError ? err.message : 'Registration failed.'; el.style.display = 'block'; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Account →'; }
  }
};

function showErr(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'block' : 'none';
}