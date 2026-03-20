// Theme toggle
const themeToggle = document.getElementById('themeToggle');
themeToggle?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
});

// Hamburger / mobile menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger?.addEventListener('click', () => mobileMenu.classList.toggle('open'));
mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.remove('open')));

// Scroll reveal
const reveals = document.querySelectorAll('.reveal');
reveals.forEach(el => el.classList.add('hidden'));
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('hidden'); e.target.classList.add('visible'); } });
}, { threshold: 0.1 });
reveals.forEach(el => observer.observe(el));