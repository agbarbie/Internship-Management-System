// ═══════════════════════════════════════════════════════════════
//  landingpage.js
// ═══════════════════════════════════════════════════════════════

// ── Theme ─────────────────────────────────────────────────────
const html   = document.documentElement;
const toggle = document.getElementById('themeToggle');
html.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
toggle?.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// ── Mobile menu ───────────────────────────────────────────────
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger?.addEventListener('click', () => {
  mobileMenu?.classList.toggle('open');
});
// Close mobile menu when a link is clicked
mobileMenu?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// ── Active nav link on scroll ─────────────────────────────────
const sections  = document.querySelectorAll('section[id], div[id]');
const navLinks  = document.querySelectorAll('.nav-links a');

function setActiveNav() {
  let current = '';
  sections.forEach(sec => {
    const top = sec.getBoundingClientRect().top;
    if (top <= 100) current = sec.id;
  });
  navLinks.forEach(link => {
    link.style.color = '';
    const href = link.getAttribute('href');
    if (href === `#${current}`) {
      link.style.color = 'var(--orange)';
    }
  });
}
window.addEventListener('scroll', setActiveNav, { passive: true });

// ── Scroll reveal ─────────────────────────────────────────────
// Content is VISIBLE by default (opacity:1 in CSS).
// If IntersectionObserver is available, we animate elements in
// by first hiding them (adding .hidden), then revealing on scroll.
document.addEventListener('DOMContentLoaded', () => {
  if (!('IntersectionObserver' in window)) return; // skip on old browsers

  const revealEls = document.querySelectorAll('.reveal');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('hidden');
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => {
    // Only animate if element is NOT already in the viewport on load
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight) {
      el.classList.add('hidden'); // hide below-fold items
    } else {
      el.classList.add('visible'); // already visible, keep it
    }
    observer.observe(el);
  });
});