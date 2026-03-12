 const toggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    html.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
    toggle.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next); localStorage.setItem('theme', next);
    });

    // Sidebar
    function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('overlay').classList.toggle('show');}
    function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('show');}

    // User
    const user = JSON.parse(localStorage.getItem('internhub_user') || '{"name":"James Kariuki","role":"intern","org":"TechCorp"}');
    const initials = (user.name||'JK').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
    document.getElementById('sidebarAvatar').textContent = initials;
    document.getElementById('topAvatar').textContent = initials;
    document.getElementById('sidebarName').textContent = (user.name||'James K.').split(' ')[0]+' '+((user.name||'').split(' ')[1]||'')[0]+'.';
    document.getElementById('sidebarRole').textContent = (user.role||'Intern')+' · '+(user.org||'TechCorp');

    // Data
    const catMap = {Design:'cat-design',Development:'cat-dev','Data Science':'cat-data',Report:'cat-report',Marketing:'cat-marketing',Other:'cat-report'};
    const stMap = {pending:'st-pending',submitted:'st-submitted',approved:'st-approved',revision:'st-revision'};

    let tasks = JSON.parse(localStorage.getItem('internhub_tasks') || 'null') || [
      {id:1,title:'UI Prototype v2',cat:'Design',desc:'Created high-fidelity mockups for the dashboard redesign in Figma.',due:'Jun 15',status:'approved',priority:'medium',progress:100,supervisor:'Sarah M.',files:['dashboard_v2.fig','mockups.pdf']},
      {id:2,title:'Data Analysis Report',cat:'Data Science',desc:'Performed exploratory data analysis on Q2 user engagement metrics.',due:'Today',status:'pending',priority:'high',progress:85,supervisor:'Dr. Osei',files:['analysis.xlsx']},
      {id:3,title:'Weekly Progress Report',cat:'Report',desc:'Summary of all tasks completed and learnings from week 4.',due:'Tomorrow',status:'submitted',priority:'low',progress:100,supervisor:'Sarah M.',files:['week4_report.docx']},
      {id:4,title:'API Integration Module',cat:'Development',desc:'Built RESTful API endpoints for user authentication flow.',due:'Jun 18',status:'revision',priority:'high',progress:70,supervisor:'Mike T.',files:['auth_module.zip']},
      {id:5,title:'Marketing Strategy Deck',cat:'Marketing',desc:'Competitive analysis and go-to-market strategy for Q3.',due:'Jun 25',status:'submitted',priority:'medium',progress:100,supervisor:'Lisa R.',files:['strategy.pptx','research.pdf']},
    ];

    let activeFilter = 'all';
    let selectedPriority = 'medium';
    let attachedFiles = [];
    let nextId = tasks.length + 1;

    function saveTasks() { localStorage.setItem('internhub_tasks', JSON.stringify(tasks)); }

    function renderTasks() {
      const search = (document.getElementById('taskSearch').value || '').toLowerCase();
      let filtered = tasks.filter(t => {
        const matchFilter = activeFilter === 'all' || t.status === activeFilter;
        const matchSearch = t.title.toLowerCase().includes(search) || t.cat.toLowerCase().includes(search);
        return matchFilter && matchSearch;
      });
      const grid = document.getElementById('tasksGrid');
      if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📭</div><div class="empty-text">No tasks found matching your criteria.</div><button class="btn-primary" style="margin:0 auto" onclick="openModal()">+ Submit New Task</button></div>`;
        return;
      }
      grid.innerHTML = '';
      filtered.forEach(t => {
        const catClass = catMap[t.cat] || 'cat-report';
        const stClass = stMap[t.status] || 'st-pending';
        const stLabel = {pending:'Pending',submitted:'Submitted',approved:'Approved',revision:'Needs Revision'}[t.status];
        const prioColor = {low:'#27c93f',medium:'var(--orange)',high:'#ff4444'}[t.priority];
        const card = document.createElement('div');
        card.className = 'task-card';
        card.onclick = () => viewTask(t);
        card.innerHTML = `
          <div class="task-card-top">
            <span class="task-cat ${catClass}">${t.cat}</span>
            <span class="task-card-status ${stClass}">${stLabel}</span>
          </div>
          <h3>${t.title}</h3>
          <div class="task-card-desc">${t.desc}</div>
          <div class="task-progress">
            <div class="task-prog-label"><span>Progress</span><span>${t.progress}%</span></div>
            <div class="prog-bar"><div class="prog-fill" style="width:${t.progress}%"></div></div>
          </div>
          <div class="task-card-meta">
            <div class="task-assigned-by">
              <div class="mini-av">${t.supervisor.split(' ').map(n=>n[0]).join('')}</div>
              ${t.supervisor}
            </div>
            <div style="display:flex;align-items:center;gap:.7rem">
              <span style="font-size:.65rem;font-weight:700;color:${prioColor};padding:.15rem .4rem;border-radius:4px;background:${prioColor}22">${t.priority.toUpperCase()}</span>
              <span class="task-due-label ${t.due==='Today'?'due-soon':t.due==='Tomorrow'?'due-ok':''}">${t.due}</span>
            </div>
          </div>
          <div style="margin-top:.8rem;padding-top:.6rem;border-top:1px solid var(--border)">
            <div class="task-files">📎 ${t.files.length} file${t.files.length!==1?'s':''} attached — ${t.files.slice(0,2).join(', ')}${t.files.length>2?'…':''}</div>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderTasks();
      });
    });
    function filterTasks() { renderTasks(); }

    // Modal
    function openModal() { document.getElementById('modalBackdrop').classList.add('open'); }
    function closeModal() {
      document.getElementById('modalBackdrop').classList.remove('open');
      document.getElementById('taskTitle').value='';
      document.getElementById('taskCat').value='';
      document.getElementById('taskDesc').value='';
      document.getElementById('taskDue').value='';
      document.getElementById('taskSupervisor').value='';
      document.getElementById('taskProgress').value=100;
      document.getElementById('progressLabel').textContent='100%';
      attachedFiles=[];
      document.getElementById('fileList').innerHTML='';
      document.getElementById('modalError').style.display='none';
    }
    document.getElementById('modalBackdrop').addEventListener('click', e => { if(e.target===e.currentTarget) closeModal(); });

    // Priority
    function setPriority(p) {
      selectedPriority = p;
      document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.className = 'priority-btn';
        if(btn.dataset.p === p) btn.classList.add(`selected-${p==='medium'?'med':p}`);
      });
    }

    // Files
    function handleFiles(files) {
      Array.from(files).forEach(f => {
        if(attachedFiles.find(x=>x.name===f.name)) return;
        attachedFiles.push(f);
        const item = document.createElement('div');
        item.className = 'file-item';
        const ext = f.name.split('.').pop().toUpperCase();
        const icons = {PDF:'📄',DOCX:'📝',XLSX:'📊',PNG:'🖼️',JPG:'🖼️',ZIP:'🗜️',PPTX:'📊'};
        item.innerHTML = `<span class="file-item-icon">${icons[ext]||'📎'}</span><span class="file-item-name">${f.name}</span><span class="file-item-size">${(f.size/1024).toFixed(1)}KB</span><button class="file-remove" onclick="removeFile('${f.name}',this.parentElement)">✕</button>`;
        document.getElementById('fileList').appendChild(item);
      });
    }
    function removeFile(name, el) { attachedFiles = attachedFiles.filter(f=>f.name!==name); el.remove(); }
    function dragOver(e){e.preventDefault();document.getElementById('fileDrop').classList.add('dragover');}
    function dragLeave(){document.getElementById('fileDrop').classList.remove('dragover');}
    function dropFile(e){e.preventDefault();dragLeave();handleFiles(e.dataTransfer.files);}

    // Submit
    function submitTask() {
      const title = document.getElementById('taskTitle').value.trim();
      const cat = document.getElementById('taskCat').value;
      const desc = document.getElementById('taskDesc').value.trim();
      const due = document.getElementById('taskDue').value.trim() || 'No deadline';
      const supervisor = document.getElementById('taskSupervisor').value.trim() || 'Supervisor';
      const progress = parseInt(document.getElementById('taskProgress').value);
      const err = document.getElementById('modalError');
      if (!title||!cat) { err.textContent='Please fill in Task Title and Category.'; err.style.display='block'; return; }
      err.style.display='none';
      const newTask = {
        id: nextId++, title, cat,
        desc: desc || 'No description provided.',
        due, status:'submitted', priority:selectedPriority, progress,
        supervisor, files: attachedFiles.length>0 ? attachedFiles.map(f=>f.name) : ['No files']
      };
      tasks.unshift(newTask);
      saveTasks();
      closeModal();
      renderTasks();
      showToast('Task submitted successfully! 🎉');
    }

    function viewTask(t) {
      showToast(`Viewing: ${t.title}`);
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toastMsg').textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3500);
    }

    renderTasks();