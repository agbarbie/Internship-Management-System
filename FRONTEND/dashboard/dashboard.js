const toggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    html.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
    toggle.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next); localStorage.setItem('theme', next);
    });

    // Sidebar
    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('overlay').classList.toggle('show');
    }
    function closeSidebar() {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('overlay').classList.remove('show');
    }

    // User info
    const user = JSON.parse(localStorage.getItem('internhub_user') || '{"name":"James Kariuki","role":"intern","org":"TechCorp"}');
    const initials = (user.name || 'JK').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
    document.getElementById('sidebarAvatar').textContent = initials;
    document.getElementById('topAvatar').textContent = initials;
    document.getElementById('sidebarName').textContent = (user.name || 'James K.').split(' ')[0] + ' ' + ((user.name||'').split(' ')[1]||'')[0] + '.';
    document.getElementById('sidebarRole').textContent = (user.role||'Intern') + ' · ' + (user.org||'TechCorp');
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    document.getElementById('greetingText').textContent = `Good ${greet}, ${(user.name||'James').split(' ')[0]} 👋`;

    function logout() { localStorage.removeItem('internhub_user'); window.location.href = 'login.html'; }

    // Chart
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const submitted = [4,6,3,8,5,2,7];
    const approved = [2,5,3,6,4,1,5];
    const chart = document.getElementById('progressChart');
    const maxVal = Math.max(...submitted);
    days.forEach((d,i) => {
      const wrap = document.createElement('div');
      wrap.className = 'chart-bar-wrap';
      const sBar = document.createElement('div');
      sBar.className = 'chart-bar';
      sBar.style.cssText = `height:${(submitted[i]/maxVal)*120}px;background:var(--orange);`;
      sBar.innerHTML = `<div class="chart-bar-tip">${submitted[i]} tasks</div>`;
      const aBar = document.createElement('div');
      aBar.className = 'chart-bar';
      aBar.style.cssText = `height:${(approved[i]/maxVal)*120}px;background:rgba(59,130,246,.5);`;
      aBar.innerHTML = `<div class="chart-bar-tip">${approved[i]} approved</div>`;
      const lbl = document.createElement('div');
      lbl.className = 'chart-label'; lbl.textContent = d;
      wrap.append(sBar, aBar, lbl);
      chart.appendChild(wrap);
    });

    // Tasks
    const tasks = [
      {title:'Data Analysis Report',due:'Today',dueClass:'due-soon',done:false,meta:'Analytics · 2 files attached'},
      {title:'UI Prototype v3',due:'Tomorrow',dueClass:'due-ok',done:false,meta:'Design · Figma link'},
      {title:'Weekly Progress Report',due:'Jun 20',dueClass:'due-ok',done:false,meta:'Report · No files yet'},
      {title:'Database Schema Design',due:'Jun 18',dueClass:'due-late',done:true,meta:'Backend · Submitted'},
      {title:'Marketing Deck',due:'Jun 25',dueClass:'due-ok',done:false,meta:'Marketing · 1 file'},
    ];
    const taskList = document.getElementById('taskList');
    tasks.forEach((t,i) => {
      const el = document.createElement('div');
      el.className = 'task-item';
      el.innerHTML = `
        <div class="task-cb ${t.done?'checked':''}" onclick="toggleTask(this)"></div>
        <div class="task-content">
          <div class="task-title-sm ${t.done?'done':''}">${t.title}</div>
          <div class="task-meta">${t.meta}</div>
        </div>
        <span class="task-due ${t.dueClass}">${t.due}</span>
      `;
      taskList.appendChild(el);
    });
    function toggleTask(cb) {
      cb.classList.toggle('checked');
      const title = cb.nextElementSibling.querySelector('.task-title-sm');
      title.classList.toggle('done');
    }

    // Activity feed
    const activities = [
      {icon:'✅',color:'rgba(39,201,63,.15)',text:'<strong>Sarah Mitchell</strong> approved your <strong>UI Prototype v2</strong>',time:'2 min ago'},
      {icon:'📋',color:'var(--orange-glow)',text:'New task assigned: <strong>Data Analysis Report</strong>',time:'1 hour ago'},
      {icon:'💬',color:'rgba(59,130,246,.12)',text:'<strong>John Doe</strong> left feedback on your Weekly Report',time:'3 hours ago'},
      {icon:'🎯',color:'rgba(168,85,247,.12)',text:'You completed <strong>18 of 24 tasks</strong> this month',time:'Yesterday'},
      {icon:'📁',color:'rgba(255,107,0,.1)',text:'<strong>Database Schema</strong> submission received',time:'2 days ago'},
    ];
    const feed = document.getElementById('activityFeed');
    activities.forEach(a => {
      const el = document.createElement('div');
      el.className = 'activity-item';
      el.innerHTML = `
        <div class="activity-icon" style="background:${a.color}">${a.icon}</div>
        <div class="activity-content">
          <div class="activity-text">${a.text}</div>
          <div class="activity-time">${a.time}</div>
        </div>
      `;
      feed.appendChild(el);
    });

    // Intern table
    const interns = [
      {name:'Amara Nwosu',initials:'AN',dept:'Design',tasks:'12/15',progress:80,status:'Active',score:'4.9'},
      {name:'Brian Ochieng',initials:'BO',dept:'Engineering',tasks:'10/14',progress:71,status:'Active',score:'4.6'},
      {name:'Chloe Kim',initials:'CK',dept:'Data Science',tasks:'8/12',progress:67,status:'Review',score:'4.3'},
      {name:'Daniel Mwangi',initials:'DM',dept:'Marketing',tasks:'5/10',progress:50,status:'Pending',score:'3.8'},
      {name:'Eva Santos',initials:'ES',dept:'Finance',tasks:'11/11',progress:100,status:'Active',score:'5.0'},
    ];
    const tbody = document.getElementById('internBody');
    function renderInterns(data) {
      tbody.innerHTML = '';
      data.forEach(i => {
        const row = document.createElement('tr');
        const statusClass = i.status === 'Active' ? 'sb-active' : i.status === 'Review' ? 'sb-review' : 'sb-pending';
        row.innerHTML = `
          <td><div class="intern-name-cell"><div class="intern-av">${i.initials}</div>${i.name}</div></td>
          <td style="color:var(--text2)">${i.dept}</td>
          <td>${i.tasks}</td>
          <td><div style="display:flex;align-items:center;gap:.5rem"><div class="progress-mini"><div class="progress-mini-fill" style="width:${i.progress}%"></div></div><span style="font-size:.72rem;color:var(--text2)">${i.progress}%</span></div></td>
          <td><span class="status-badge ${statusClass}">${i.status}</span></td>
          <td style="font-weight:600;color:var(--orange)">${i.score}</td>
        `;
        tbody.appendChild(row);
      });
    }
    renderInterns(interns);
    function filterInterns(val) {
      renderInterns(interns.filter(i => i.name.toLowerCase().includes(val.toLowerCase()) || i.dept.toLowerCase().includes(val.toLowerCase())));
    }