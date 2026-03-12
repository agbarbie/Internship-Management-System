 const toggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    html.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
    toggle.addEventListener('click', () => {
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

    // Toggle password
    document.getElementById('togglePass').addEventListener('click', () => {
      const p = document.getElementById('password');
      p.type = p.type === 'password' ? 'text' : 'password';
    });

    // Login form
    document.getElementById('loginForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const pass = document.getElementById('password').value;
      const err = document.getElementById('errorMsg');
      const suc = document.getElementById('successMsg');
      err.style.display = 'none'; suc.style.display = 'none';

      // Demo: any valid-looking credentials pass
      if (email && pass.length >= 6) {
        suc.style.display = 'block';
        localStorage.setItem('internhub_user', JSON.stringify({ email, role: document.querySelector('.role-tab.active').dataset.role }));
        setTimeout(() => window.location.href = 'dashboard.html', 1200);
      } else {
        err.style.display = 'block';
      }
    });