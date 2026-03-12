const toggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    html.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
    toggle.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next); localStorage.setItem('theme', next);
    });

    // Role selection
    let selectedRole = 'intern';
    document.querySelectorAll('.role-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedRole = card.dataset.role;
      });
    });

    // Steps
    let currentStep = 1;
    function goStep(step) {
      if (step > currentStep) {
        // Validate
        if (currentStep === 1) {
          const f = document.getElementById('firstName').value;
          const l = document.getElementById('lastName').value;
          const e = document.getElementById('regEmail').value;
          if (!f||!l||!e||!e.includes('@')) { document.getElementById('err1').style.display='block'; return; }
          document.getElementById('err1').style.display='none';
        }
        if (currentStep === 2) {
          const o = document.getElementById('org').value;
          const p = document.getElementById('regPassword').value;
          const c = document.getElementById('confirmPassword').value;
          if (!o||p.length<8||p!==c) { document.getElementById('err2').style.display='block'; return; }
          document.getElementById('err2').style.display='none';
          // Build review
          const r = document.getElementById('reviewContent');
          r.innerHTML = `
            <strong>Name:</strong> ${document.getElementById('firstName').value} ${document.getElementById('lastName').value}<br>
            <strong>Email:</strong> ${document.getElementById('regEmail').value}<br>
            <strong>Phone:</strong> ${document.getElementById('phone').value || 'Not provided'}<br>
            <strong>Role:</strong> ${selectedRole.charAt(0).toUpperCase()+selectedRole.slice(1)}<br>
            <strong>Organization:</strong> ${o}<br>
            <strong>Department:</strong> ${document.getElementById('dept').value || 'Not specified'}
          `;
        }
      }
      document.getElementById('step'+currentStep).classList.remove('active');
      document.getElementById('dot'+currentStep).classList.remove('active');
      document.getElementById('dot'+currentStep).classList.add('done');
      currentStep = step;
      document.getElementById('step'+currentStep).classList.add('active');
      document.getElementById('dot'+currentStep).classList.remove('done');
      document.getElementById('dot'+currentStep).classList.add('active');
      window.scrollTo({top:0,behavior:'smooth'});
    }

    function submitForm() {
      if (!document.getElementById('terms').checked) {
        document.getElementById('err3').style.display='block'; return;
      }
      document.getElementById('err3').style.display='none';
      // Store user
      const userData = {
        name: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`,
        email: document.getElementById('regEmail').value,
        role: selectedRole, org: document.getElementById('org').value,
        dept: document.getElementById('dept').value
      };
      localStorage.setItem('internhub_user', JSON.stringify(userData));
      // Show success
      document.querySelector('.form-card').querySelectorAll('.terms-group,.btn-submit,.nav-btns,.error-msg,#reviewContent,.section-title-sm').forEach(el=>el.style.display='none');
      document.getElementById('successCard').style.display='block';
    }

    function checkStrength(val) {
      const fill = document.getElementById('strengthFill');
      const text = document.getElementById('strengthText');
      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;
      const levels = [{w:'0%',c:'transparent',t:'Too short'},{w:'25%',c:'#ff4444',t:'Weak'},{w:'50%',c:'#ff8c00',t:'Fair'},{w:'75%',c:'#ffd700',t:'Good'},{w:'100%',c:'#27c93f',t:'Strong'}];
      const l = levels[score] || levels[0];
      fill.style.width = l.w; fill.style.background = l.c; text.textContent = l.t;
    }

    function togglePwd(id) {
      const i = document.getElementById(id);
      i.type = i.type === 'password' ? 'text' : 'password';
    }