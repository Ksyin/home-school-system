window.Common = {
  navSets: {
    parent: [
      ['Dashboard','/parent/dashboard.html','🏠'],
      ['Children','/parent/children.html','👧'],
      ['Assignments','/parent/assignments.html','📝'],
      ['Assessments','/parent/assessments.html','📊'],
      ['Portfolio','/parent/portfolio.html','🖼️'],
      ['Attendance','/parent/attendance.html','📅'],
      ['Report Cards','/parent/report-cards.html','📄'],
      ['Resources','/parent/resources.html','📚'],
      ['Messages','/parent/messages.html','💬'],
      ['Settings','/parent/settings.html','⚙️']
    ],
    tutor: [
      ['Dashboard','/tutor/dashboard.html','🏠'],
      ['Learners','/tutor/learners.html','👩‍🎓'],
      ['Classrooms','/tutor/classrooms.html','🏫'],
      ['Assignments','/tutor/assignments.html','📝'],
      ['Assessments','/tutor/assessments.html','📊'],
      ['Portfolios','/tutor/portfolios.html','🖼️'],
      ['Attendance','/tutor/attendance.html','📅'],
      ['Report Cards','/tutor/report-cards.html','📄'],
      ['Lesson Plans','/tutor/lesson-plans.html','🗂️'],
      ['Resources','/tutor/resources.html','📚'],
      ['Messages','/tutor/messages.html','💬'],
      ['Settings','/tutor/settings.html','⚙️']
    ],
    student: [
      ['Dashboard','/student/dashboard.html','🏠'],
      ['My Work','/student/assignments.html','📝'],
      ['Assessments','/student/assessments.html','📊'],
      ['Portfolio','/student/portfolio.html','🖼️'],
      ['Attendance','/student/attendance.html','📅'],
      ['Report Card','/student/report-card.html','📄'],
      ['Resources','/student/resources.html','📚'],
      ['Messages','/student/messages.html','💬'],
      ['Settings','/student/settings.html','⚙️']
    ]
  },
  renderShell({ role, active, title, subtitle }) {
    const nav = this.navSets[role].map(([label, href, icon]) => `
      <a class="nav-link ${active===label?'active':''}" href="${href}"><span class="icon">${icon}</span><span>${label}</span></a>`).join('');
    document.body.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand"><div class="brand-mark">H</div><div><h1>HomeSchool</h1><span>Management System</span></div></div>
          <div class="nav-group">${nav}</div>
          <div class="sidebar-footer">
            <div class="user-box">
              <div style="display:flex;align-items:center;gap:12px">
                <div class="avatar" id="sidebarAvatar">--</div>
                <div><div id="sidebarName">Loading...</div><div style="font-size:12px;color:#b9c8ef;text-transform:capitalize">${role}</div></div>
              </div>
              <button class="btn small secondary" id="logoutBtn" style="padding:8px 10px">↪</button>
            </div>
          </div>
        </aside>
        <main class="main">
          <div class="topbar">
            <div style="display:flex;align-items:center;gap:12px"><button class="btn secondary mobile-toggle" id="mobileToggle">☰</button><div><div style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">${role} portal</div><strong>${title}</strong></div></div>
            <div class="badge info" id="topRoleBadge">Loading account...</div>
          </div>
          <div class="page">
            <div class="page-header"><div><h1 class="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p></div><div id="pageActions"></div></div>
            <div id="pageContent"></div>
          </div>
        </main>
      </div>`;
    document.getElementById('mobileToggle')?.addEventListener('click', UI.toggleSidebar);
    document.getElementById('logoutBtn')?.addEventListener('click', ()=>Auth.signOut());
  },
  async boot(role, active, title, subtitle) {
    this.renderShell({ role, active, title, subtitle });
    const bundle = await Auth.requireAuth(role);
    if (!bundle) return null;
    document.getElementById('sidebarName').textContent = bundle.profile.full_name || 'User';
    document.getElementById('sidebarAvatar').textContent = UI.initials(bundle.profile.full_name || 'User');
    document.getElementById('topRoleBadge').textContent = `${bundle.profile.full_name} · ${bundle.profile.role}`;
    return bundle;
  },
  card(title, body, extra='') {
    return `<section class="card"><h3>${title}</h3><p>${body}</p>${extra}</section>`;
  },
  renderTable(headers, rows) {
    return `<div class="card table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r=>`<tr>${r.map(c=>`<td>${c??'-'}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}"><div class="note">No records yet.</div></td></tr>`}</tbody></table></div>`;
  },
  async list(table, select='*', filters=[]) {
    let query = sb.from(table).select(select).order('created_at', { ascending:false });
    filters.forEach(f => { query = query.eq(f.column, f.value); });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  async insert(table, payload) {
    const { error } = await sb.from(table).insert(payload);
    if (error) throw error;
  },
  async upsert(table, payload) {
    const { error } = await sb.from(table).upsert(payload);
    if (error) throw error;
  }
};
