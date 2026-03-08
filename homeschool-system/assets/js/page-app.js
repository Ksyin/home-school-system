async function uploadToStorage(file, folder='general') {
  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sb.storage.from('uploads').upload(fileName, file, { upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from('uploads').getPublicUrl(fileName);
  return data.publicUrl;
}

function html(strings, ...values) { return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), ''); }
function optionItems(list, mapFn) { return list.map(mapFn).join(''); }

async function fetchProfilesByRole(role) {
  const { data, error } = await sb.from('profiles').select('id, full_name, grade_level').eq('role', role).order('full_name');
  if (error) throw error;
  return data || [];
}
async function fetchSubjects() {
  const { data, error } = await sb.from('subjects').select('*').order('name');
  if (error) throw error;
  return data || [];
}
async function fetchClassrooms(tutorId) {
  let q = sb.from('classrooms').select('*').order('title');
  if (tutorId) q = q.eq('tutor_id', tutorId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function renderDashboard(role, profile) {
  const summary = await DataAPI.dashboardSummary(role, profile.id);
  let extraTop = '';
  if (role === 'parent') {
    const kids = await DataAPI.getParentChildren(profile.id);
    extraTop = `<div class="note">You are linked to <strong>${kids.length}</strong> learner account(s).</div>`;
  }
  if (role === 'tutor') {
    const students = await DataAPI.getTutorStudents(profile.id);
    extraTop = `<div class="note">You currently manage <strong>${students.length}</strong> learner enrollments across your classrooms.</div>`;
  }
  document.getElementById('pageContent').innerHTML = `
    <section class="card hero"><h3>Welcome back, ${profile.full_name.split(' ')[0]}</h3><p>This space blends structured task tracking, assessments, reports, attendance, and portfolio-based learning for homeschooling use.</p></section>
    <div style="height:18px"></div>
    ${extraTop}
    <div style="height:18px"></div>
    <div class="kpis">
      <section class="card stat-card"><span class="label">Pending assignments</span><span class="value">${summary.pendingAssignments}</span></section>
      <section class="card stat-card"><span class="label">Average assessment score</span><span class="value">${summary.averageScore}%</span></section>
      <section class="card stat-card"><span class="label">Attendance records</span><span class="value">${summary.presentDays}</span></section>
      <section class="card stat-card"><span class="label">Portfolio items</span><span class="value">${summary.portfolioCount}</span></section>
    </div>
    <div style="height:18px"></div>
    <div class="layout-grid">
      <div class="card" style="grid-column:span 7">
        <h3>Recent assignments</h3>
        <div class="list">${summary.assignments.slice(0,5).map(a=>`<div class="list-item"><div><strong>${a.title}</strong><div class="footer-note">${a.classrooms?.title || 'General'} · Due ${a.due_date || 'Not set'}</div></div><span class="badge ${a.status==='completed'?'success':'warning'}">${a.status || 'pending'}</span></div>`).join('') || '<div class="note">No assignments yet.</div>'}</div>
      </div>
      <div class="card" style="grid-column:span 5">
        <h3>Recent assessments</h3>
        <div class="list">${summary.assessments.slice(0,5).map(a=>`<div class="list-item"><div><strong>${a.title}</strong><div class="footer-note">${a.subjects?.name || 'Subject'} · ${a.assessment_date || ''}</div></div><span class="badge info">${a.score || 0}%</span></div>`).join('') || '<div class="note">No assessments yet.</div>'}</div>
      </div>
    </div>`;
}

async function renderAssignments(role, profile) {
  const page = document.body.dataset.page;
  const items = await DataAPI.getAssignmentsForRole(role, profile.id);
  const pageContent = document.getElementById('pageContent');
  let formSection = '';
  if (role === 'tutor') {
    const students = await fetchProfilesByRole('student');
    const classrooms = await fetchClassrooms(profile.id);
    formSection = `
      <section class="card"><h3>Create assignment</h3><p>Assign tasks to one learner or keep them classroom-wide.</p>
      <form class="grid-form" id="assignmentForm">
        <div class="field col-6"><label>Title</label><input name="title" required></div>
        <div class="field col-6"><label>Classroom</label><select name="classroom_id"><option value="">General</option>${optionItems(classrooms, c=>`<option value="${c.id}">${c.title}</option>`)}</select></div>
        <div class="field col-6"><label>Assign to student</label><select name="student_id"><option value="">All visible students</option>${optionItems(students, s=>`<option value="${s.id}">${s.full_name}</option>`)}</select></div>
        <div class="field col-6"><label>Due date</label><input name="due_date" type="date"></div>
        <div class="field col-12"><label>Description</label><textarea name="description"></textarea></div>
        <div class="field col-6"><label>Resource link (optional)</label><input name="resource_url" placeholder="https://..."></div>
        <div class="field col-6" style="justify-content:end"><label>&nbsp;</label><button class="btn" type="submit">Save assignment</button></div>
      </form></section><div style="height:18px"></div>`;
  }
  pageContent.innerHTML = `${formSection}${Common.renderTable(['Title','Classroom / Student','Due','Status','Info'], items.map(a => [a.title, `${a.classrooms?.title || 'General'}<br><span class="footer-note">${a.full_name || a.profiles?.full_name || a['profiles!assignments_student_id_fkey']?.full_name || 'Open task'}</span>`, a.due_date || '-', `<span class="badge ${a.status==='completed'?'success':'warning'}">${a.status || 'pending'}</span>`, a.description || '-']))}`;
  if (role === 'student') {
    const studentItems = items;
    const { data: submissions, error } = await sb.from('submissions').select('*').eq('student_id', profile.id);
    if (error) throw error;
    const subMap = Object.fromEntries((submissions||[]).map(s => [s.assignment_id, s]));
    pageContent.innerHTML += `<div style="height:18px"></div><section class="card"><h3>Submit work</h3><p>Choose an assignment and upload evidence or a response link.</p><form class="grid-form" id="submissionForm"><div class="field col-6"><label>Assignment</label><select name="assignment_id" required>${optionItems(studentItems, a=>`<option value="${a.id}">${a.title}</option>`)}</select></div><div class="field col-6"><label>Attachment</label><input name="attachment" type="file"></div><div class="field col-12"><label>Reflection / submission note</label><textarea name="notes"></textarea></div><div class="field col-6"><label>Link (optional)</label><input name="submission_url" placeholder="https://..."></div><div class="field col-6"><label>&nbsp;</label><button class="btn" type="submit">Submit work</button></div></form></section>`;
    document.getElementById('submissionForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      try {
        UI.setLoading(btn, true);
        const fd = new FormData(e.target);
        let fileUrl = '';
        if (fd.get('attachment')?.size) fileUrl = await uploadToStorage(fd.get('attachment'), 'submissions');
        await Common.upsert('submissions', {
          assignment_id: fd.get('assignment_id'),
          student_id: profile.id,
          submission_notes: fd.get('notes'),
          submission_url: fd.get('submission_url'),
          attachment_url: fileUrl || null,
          status: 'submitted'
        });
        UI.toast('Submission saved', 'success');
        location.reload();
      } catch(err) { UI.toast(err.message, 'error'); }
      finally { UI.setLoading(btn, false); }
    });
  }
  if (role === 'tutor') {
    document.getElementById('assignmentForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      try {
        UI.setLoading(btn, true);
        const fd = new FormData(e.target);
        await Common.insert('assignments', {
          title: fd.get('title'), description: fd.get('description'), due_date: fd.get('due_date') || null,
          classroom_id: fd.get('classroom_id') || null, student_id: fd.get('student_id') || null,
          resource_url: fd.get('resource_url') || null, created_by: profile.id, status: 'pending'
        });
        UI.toast('Assignment created', 'success');
        location.reload();
      } catch(err) { UI.toast(err.message, 'error'); }
      finally { UI.setLoading(btn, false); }
    });
  }
}

async function renderAssessments(role, profile) {
  const items = await DataAPI.getAssessmentsForRole(role, profile.id);
  let form = '';
  if (role === 'tutor') {
    const students = await fetchProfilesByRole('student');
    const subjects = await fetchSubjects();
    form = `<section class="card"><h3>Create assessment</h3><form class="grid-form" id="assessmentForm"><div class="field col-6"><label>Title</label><input name="title" required></div><div class="field col-3"><label>Type</label><select name="assessment_type"><option>formative</option><option>summative</option></select></div><div class="field col-3"><label>Date</label><input type="date" name="assessment_date"></div><div class="field col-4"><label>Student</label><select name="student_id" required>${optionItems(students, s=>`<option value="${s.id}">${s.full_name}</option>`)}</select></div><div class="field col-4"><label>Subject</label><select name="subject_id" required>${optionItems(subjects, s=>`<option value="${s.id}">${s.name}</option>`)}</select></div><div class="field col-4"><label>Score (%)</label><input name="score" type="number" min="0" max="100"></div><div class="field col-12"><label>Feedback</label><textarea name="feedback"></textarea></div><div class="field col-6"><label>&nbsp;</label><button class="btn" type="submit">Save assessment</button></div></form></section><div style="height:18px"></div>`;
  }
  document.getElementById('pageContent').innerHTML = `${form}${Common.renderTable(['Title','Student / Subject','Type','Date','Score','Feedback'], items.map(i=>[i.title, `${i['profiles!assessments_student_id_fkey']?.full_name || ''}<br><span class="footer-note">${i.subjects?.name || ''}</span>`, `<span class="badge info">${i.assessment_type}</span>`, i.assessment_date || '-', `${i.score || 0}%`, i.feedback || '-']))}`;
  document.getElementById('assessmentForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const btn = e.target.querySelector('button');
    try {
      UI.setLoading(btn, true);
      const fd = new FormData(e.target);
      await Common.insert('assessments', { created_by: profile.id, title: fd.get('title'), assessment_type: fd.get('assessment_type'), assessment_date: fd.get('assessment_date')||null, student_id: fd.get('student_id'), subject_id: fd.get('subject_id'), score: Number(fd.get('score'))||0, feedback: fd.get('feedback') });
      UI.toast('Assessment saved', 'success');
      location.reload();
    } catch(err){ UI.toast(err.message, 'error'); }
    finally{ UI.setLoading(btn, false); }
  });
}

async function renderPortfolio(role, profile) {
  const items = await DataAPI.getPortfolioForRole(role, profile.id);
  const subjects = await fetchSubjects();
  let form = '';
  if (role !== 'parent') {
    const students = role === 'tutor' ? await fetchProfilesByRole('student') : [{ id: profile.id, full_name: profile.full_name }];
    form = `<section class="card"><h3>Add portfolio entry</h3><p>Use this to document projects, reflections, experiments, and learning moments.</p><form class="grid-form" id="portfolioForm"><div class="field col-6"><label>Title</label><input name="title" required></div><div class="field col-6"><label>Subject</label><select name="subject_id"><option value="">No subject</option>${optionItems(subjects, s=>`<option value="${s.id}">${s.name}</option>`)}</select></div><div class="field col-6"><label>Student</label><select name="student_id">${optionItems(students, s=>`<option value="${s.id}">${s.full_name}</option>`)}</select></div><div class="field col-6"><label>Attachment</label><input type="file" name="attachment"></div><div class="field col-12"><label>Reflection / notes</label><textarea name="reflection"></textarea></div><div class="field col-6"><label>External link</label><input name="artifact_url" placeholder="https://..."></div><div class="field col-6"><label>&nbsp;</label><button class="btn" type="submit">Save portfolio entry</button></div></form></section><div style="height:18px"></div>`;
  }
  document.getElementById('pageContent').innerHTML = `${form}<div class="list">${items.map(i=>`<div class="list-item"><div><strong>${i.title}</strong><div class="footer-note">${i.subjects?.name || 'General'} · ${i['profiles!portfolio_entries_student_id_fkey']?.full_name || ''} · ${i.entry_date || ''}</div><p style="margin-top:8px">${i.reflection || ''}</p>${i.attachment_url ? `<a class="auth-link" href="${i.attachment_url}" target="_blank">Open attachment</a>` : ''}</div><span class="badge info">Portfolio</span></div>`).join('') || '<div class="note">No portfolio entries yet.</div>'}</div>`;
  document.getElementById('portfolioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    try {
      UI.setLoading(btn, true);
      const fd = new FormData(e.target);
      let attachment = '';
      if (fd.get('attachment')?.size) attachment = await uploadToStorage(fd.get('attachment'), 'portfolio');
      await Common.insert('portfolio_entries', {
        title: fd.get('title'), subject_id: fd.get('subject_id') || null, student_id: fd.get('student_id'), reflection: fd.get('reflection'), artifact_url: fd.get('artifact_url') || null, attachment_url: attachment || null, created_by: profile.id
      });
      UI.toast('Portfolio entry added', 'success'); location.reload();
    } catch(err){ UI.toast(err.message, 'error'); }
    finally{ UI.setLoading(btn, false); }
  });
}

async function renderAttendance(role, profile) {
  const items = await DataAPI.getAttendanceForRole(role, profile.id);
  let form = '';
  if (role === 'tutor') {
    const students = await fetchProfilesByRole('student');
    const classrooms = await fetchClassrooms(profile.id);
    form = `<section class="card"><h3>Mark attendance</h3><form class="grid-form" id="attendanceForm"><div class="field col-4"><label>Student</label><select name="student_id">${optionItems(students, s=>`<option value="${s.id}">${s.full_name}</option>`)}</select></div><div class="field col-4"><label>Classroom</label><select name="classroom_id"><option value="">General</option>${optionItems(classrooms, c=>`<option value="${c.id}">${c.title}</option>`)}</select></div><div class="field col-4"><label>Status</label><select name="status"><option>present</option><option>absent</option><option>late</option></select></div><div class="field col-6"><label>Date</label><input type="date" name="record_date"></div><div class="field col-6"><label>Notes</label><input name="notes"></div><div class="field col-6"><label>&nbsp;</label><button class="btn">Save attendance</button></div></form></section><div style="height:18px"></div>`;
  }
  document.getElementById('pageContent').innerHTML = `${form}${Common.renderTable(['Student','Classroom','Date','Status','Notes'], items.map(i=>[i['profiles!attendance_records_student_id_fkey']?.full_name || profile.full_name, i.classrooms?.title || 'General', i.record_date || '-', `<span class="badge ${i.status==='present'?'success': i.status==='late'?'warning':'danger'}">${i.status}</span>`, i.notes || '-']))}`;
  document.getElementById('attendanceForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    try { UI.setLoading(btn, true); const fd = new FormData(e.target); await Common.insert('attendance_records', { student_id: fd.get('student_id'), classroom_id: fd.get('classroom_id') || null, status: fd.get('status'), record_date: fd.get('record_date') || null, notes: fd.get('notes'), created_by: profile.id }); UI.toast('Attendance saved','success'); location.reload(); }
    catch(err){ UI.toast(err.message,'error'); } finally{ UI.setLoading(btn,false); }
  });
}

async function renderReportCards(role, profile) {
  const items = await DataAPI.getReportCardsForRole(role, profile.id);
  let form = '';
  if (role === 'tutor') {
    const students = await fetchProfilesByRole('student');
    form = `<section class="card"><h3>Create report card</h3><form class="grid-form" id="reportCardForm"><div class="field col-4"><label>Student</label><select name="student_id">${optionItems(students, s=>`<option value="${s.id}">${s.full_name}</option>`)}</select></div><div class="field col-4"><label>Term start</label><input type="date" name="term_start"></div><div class="field col-4"><label>Term end</label><input type="date" name="term_end"></div><div class="field col-6"><label>Overall score</label><input name="overall_score" type="number" min="0" max="100"></div><div class="field col-6"><label>File (optional PDF)</label><input type="file" name="attachment"></div><div class="field col-12"><label>Teacher summary</label><textarea name="summary"></textarea></div><div class="field col-6"><label>&nbsp;</label><button class="btn">Save report card</button></div></form></section><div style="height:18px"></div>`;
  }
  document.getElementById('pageContent').innerHTML = `${form}<div class="list">${items.map(i=>`<div class="list-item"><div><strong>${i['profiles!report_cards_student_id_fkey']?.full_name || profile.full_name}</strong><div class="footer-note">${i.term_start || ''} → ${i.term_end || ''}</div><p style="margin-top:8px">${i.summary || ''}</p>${i.attachment_url ? `<a class="auth-link" href="${i.attachment_url}" target="_blank">Open file</a>` : ''}</div><span class="badge info">${i.overall_score || 0}%</span></div>`).join('') || '<div class="note">No report cards yet.</div>'}</div>`;
  document.getElementById('reportCardForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    try {
      UI.setLoading(btn, true);
      const fd = new FormData(e.target);
      let attachment = '';
      if (fd.get('attachment')?.size) attachment = await uploadToStorage(fd.get('attachment'), 'reports');
      await Common.insert('report_cards', { student_id: fd.get('student_id'), term_start: fd.get('term_start') || null, term_end: fd.get('term_end') || null, overall_score: Number(fd.get('overall_score'))||0, summary: fd.get('summary'), attachment_url: attachment || null, created_by: profile.id });
      UI.toast('Report card saved','success'); location.reload();
    } catch(err){ UI.toast(err.message,'error'); } finally{ UI.setLoading(btn,false); }
  });
}

async function renderResources(role, profile) {
  const items = await DataAPI.getResources(role, profile.id);
  let form = '';
  if (role === 'tutor') {
    const subjects = await fetchSubjects();
    const classrooms = await fetchClassrooms(profile.id);
    form = `<section class="card"><h3>Add resource</h3><form class="grid-form" id="resourceForm"><div class="field col-6"><label>Title</label><input name="title" required></div><div class="field col-6"><label>Subject</label><select name="subject_id"><option value="">No subject</option>${optionItems(subjects, s=>`<option value="${s.id}">${s.name}</option>`)}</select></div><div class="field col-6"><label>Classroom</label><select name="classroom_id"><option value="">General</option>${optionItems(classrooms, c=>`<option value="${c.id}">${c.title}</option>`)}</select></div><div class="field col-6"><label>Attachment</label><input type="file" name="attachment"></div><div class="field col-12"><label>Description</label><textarea name="description"></textarea></div><div class="field col-6"><label>External link</label><input name="resource_url" placeholder="https://..."></div><div class="field col-6"><label>&nbsp;</label><button class="btn">Save resource</button></div></form></section><div style="height:18px"></div>`;
  }
  document.getElementById('pageContent').innerHTML = `${form}<div class="list">${items.map(i=>`<div class="list-item"><div><strong>${i.title}</strong><div class="footer-note">${i.subjects?.name || 'General'} · ${i.classrooms?.title || 'Shared resource'}</div><p style="margin-top:8px">${i.description || ''}</p>${i.attachment_url ? `<a class="auth-link" href="${i.attachment_url}" target="_blank">Open attachment</a>` : ''} ${i.resource_url ? `<a class="auth-link" href="${i.resource_url}" target="_blank">External link</a>` : ''}</div><span class="badge success">Resource</span></div>`).join('') || '<div class="note">No resources yet.</div>'}</div>`;
  document.getElementById('resourceForm')?.addEventListener('submit', async e=>{
    e.preventDefault(); const btn = e.target.querySelector('button');
    try { UI.setLoading(btn,true); const fd = new FormData(e.target); let attachment=''; if (fd.get('attachment')?.size) attachment = await uploadToStorage(fd.get('attachment'),'resources'); await Common.insert('resources', { title: fd.get('title'), description: fd.get('description'), subject_id: fd.get('subject_id')||null, classroom_id: fd.get('classroom_id')||null, attachment_url: attachment || null, resource_url: fd.get('resource_url')||null, created_by: profile.id }); UI.toast('Resource added','success'); location.reload(); }
    catch(err){ UI.toast(err.message,'error'); } finally { UI.setLoading(btn,false); }
  });
}

async function renderLessonPlans(profile) {
  const classrooms = await fetchClassrooms(profile.id);
  const subjects = await fetchSubjects();
  const { data: items, error } = await sb.from('lesson_plans').select('*, subjects(name), classrooms(title)').eq('created_by', profile.id).order('lesson_date',{ascending:false});
  if (error) throw error;
  document.getElementById('pageContent').innerHTML = `<section class="card"><h3>Create lesson plan</h3><form class="grid-form" id="lessonPlanForm"><div class="field col-6"><label>Title</label><input name="title" required></div><div class="field col-3"><label>Lesson date</label><input type="date" name="lesson_date"></div><div class="field col-3"><label>Classroom</label><select name="classroom_id"><option value="">General</option>${optionItems(classrooms, c=>`<option value="${c.id}">${c.title}</option>`)}</select></div><div class="field col-6"><label>Subject</label><select name="subject_id"><option value="">No subject</option>${optionItems(subjects, s=>`<option value="${s.id}">${s.name}</option>`)}</select></div><div class="field col-6"><label>Objectives</label><input name="objectives"></div><div class="field col-12"><label>Activities / notes</label><textarea name="notes"></textarea></div><div class="field col-6"><label>&nbsp;</label><button class="btn">Save lesson plan</button></div></form></section><div style="height:18px"></div><div class="list">${(items||[]).map(i=>`<div class="list-item"><div><strong>${i.title}</strong><div class="footer-note">${i.lesson_date || ''} · ${i.subjects?.name || 'General'} · ${i.classrooms?.title || 'General'}</div><p style="margin-top:8px">${i.notes || ''}</p></div><span class="badge info">Lesson plan</span></div>`).join('') || '<div class="note">No lesson plans yet.</div>'}</div>`;
  document.getElementById('lessonPlanForm')?.addEventListener('submit', async e=>{ e.preventDefault(); const btn = e.target.querySelector('button'); try{ UI.setLoading(btn,true); const fd=new FormData(e.target); await Common.insert('lesson_plans',{ title:fd.get('title'), lesson_date:fd.get('lesson_date')||null, classroom_id:fd.get('classroom_id')||null, subject_id:fd.get('subject_id')||null, objectives:fd.get('objectives'), notes:fd.get('notes'), created_by: profile.id }); UI.toast('Lesson plan saved','success'); location.reload(); } catch(err){ UI.toast(err.message,'error'); } finally{ UI.setLoading(btn,false);} });
}

async function renderClassrooms(profile) {
  const items = await fetchClassrooms(profile.id);
  document.getElementById('pageContent').innerHTML = `<section class="card"><h3>Create classroom</h3><form class="grid-form" id="classroomForm"><div class="field col-6"><label>Classroom title</label><input name="title" required></div><div class="field col-6"><label>Description</label><input name="description"></div><div class="field col-6"><label>&nbsp;</label><button class="btn">Save classroom</button></div></form></section><div style="height:18px"></div>${Common.renderTable(['Title','Description','Created'], (items||[]).map(i=>[i.title, i.description || '-', i.created_at ? new Date(i.created_at).toLocaleDateString() : '-']))}`;
  document.getElementById('classroomForm')?.addEventListener('submit', async e=>{ e.preventDefault(); const btn=e.target.querySelector('button'); try{ UI.setLoading(btn,true); const fd=new FormData(e.target); await Common.insert('classrooms',{ title:fd.get('title'), description:fd.get('description'), tutor_id: profile.id }); UI.toast('Classroom created','success'); location.reload(); } catch(err){ UI.toast(err.message,'error'); } finally{ UI.setLoading(btn,false);} });
}

async function renderLearners(profile) {
  const students = await fetchProfilesByRole('student');
  const classrooms = await fetchClassrooms(profile.id);
  const { data: memberships, error } = await sb.from('classroom_members').select('*, classrooms(title), profiles!classroom_members_student_id_fkey(full_name)').eq('tutor_id', profile.id).order('created_at',{ascending:false});
  if (error) throw error;
  document.getElementById('pageContent').innerHTML = `<section class="card"><h3>Link learner to classroom</h3><form class="grid-form" id="learnerLinkForm"><div class="field col-6"><label>Student</label><select name="student_id">${optionItems(students, s=>`<option value="${s.id}">${s.full_name} ${s.grade_level ? `(${s.grade_level})` : ''}</option>`)}</select></div><div class="field col-6"><label>Classroom</label><select name="classroom_id">${optionItems(classrooms, c=>`<option value="${c.id}">${c.title}</option>`)}</select></div><div class="field col-6"><label>&nbsp;</label><button class="btn">Link learner</button></div></form></section><div style="height:18px"></div>${Common.renderTable(['Learner','Classroom','Linked'], (memberships||[]).map(i=>[i['profiles!classroom_members_student_id_fkey']?.full_name || '-', i.classrooms?.title || '-', i.created_at ? new Date(i.created_at).toLocaleDateString() : '-']))}`;
  document.getElementById('learnerLinkForm')?.addEventListener('submit', async e=>{ e.preventDefault(); const btn=e.target.querySelector('button'); try{ UI.setLoading(btn,true); const fd=new FormData(e.target); await Common.upsert('classroom_members',{ student_id:fd.get('student_id'), classroom_id:fd.get('classroom_id'), tutor_id: profile.id }); UI.toast('Learner linked','success'); location.reload(); } catch(err){ UI.toast(err.message,'error'); } finally{ UI.setLoading(btn,false);} });
}

async function renderChildren(profile) {
  const kids = await DataAPI.getParentChildren(profile.id);
  const students = await fetchProfilesByRole('student');
  document.getElementById('pageContent').innerHTML = `<section class="card"><h3>Link child account</h3><p>Connect the student login with the parent view.</p><form class="grid-form" id="childLinkForm"><div class="field col-6"><label>Student</label><select name="student_id">${optionItems(students, s=>`<option value="${s.id}">${s.full_name} ${s.grade_level ? `(${s.grade_level})` : ''}</option>`)}</select></div><div class="field col-6"><label>&nbsp;</label><button class="btn">Link child</button></div></form></section><div style="height:18px"></div>${Common.renderTable(['Child','Email','Grade level'], kids.map(k=>[k.profiles?.full_name || '-', k.profiles?.email || '-', k.profiles?.grade_level || '-']))}`;
  document.getElementById('childLinkForm')?.addEventListener('submit', async e=>{ e.preventDefault(); const btn=e.target.querySelector('button'); try{ UI.setLoading(btn,true); const fd=new FormData(e.target); await Common.upsert('student_parent_links',{ parent_id: profile.id, student_id: fd.get('student_id') }); UI.toast('Child linked','success'); location.reload(); } catch(err){ UI.toast(err.message,'error'); } finally{ UI.setLoading(btn,false);} });
}

async function renderMessages(role, profile) {
  const peers = await sb.from('profiles').select('id, full_name, role').neq('id', profile.id).order('full_name');
  if (peers.error) throw peers.error;
  const items = await DataAPI.getMessages(role, profile.id);
  document.getElementById('pageContent').innerHTML = `<section class="card"><h3>Send message</h3><form class="grid-form" id="messageForm"><div class="field col-6"><label>To</label><select name="recipient_id">${optionItems(peers.data || [], p=>`<option value="${p.id}">${p.full_name} · ${p.role}</option>`)}</select></div><div class="field col-6"><label>Subject</label><input name="subject"></div><div class="field col-12"><label>Message</label><textarea name="body"></textarea></div><div class="field col-6"><label>&nbsp;</label><button class="btn">Send message</button></div></form></section><div style="height:18px"></div><div class="list">${items.map(m=>`<div class="list-item"><div><strong>${m.subject || 'Message'}</strong><div class="footer-note">From ${m.sender?.full_name || ''} to ${m.recipient?.full_name || ''}</div><p style="margin-top:8px">${m.body || ''}</p></div><span class="badge info">${new Date(m.created_at).toLocaleDateString()}</span></div>`).join('') || '<div class="note">No messages yet.</div>'}</div>`;
  document.getElementById('messageForm')?.addEventListener('submit', async e=>{ e.preventDefault(); const btn=e.target.querySelector('button'); try{ UI.setLoading(btn,true); const fd=new FormData(e.target); await Common.insert('messages',{ sender_id: profile.id, recipient_id: fd.get('recipient_id'), subject: fd.get('subject'), body: fd.get('body') }); UI.toast('Message sent','success'); location.reload(); } catch(err){ UI.toast(err.message,'error'); } finally{ UI.setLoading(btn,false);} });
}

async function renderSettings(role, profile) {
  document.getElementById('pageContent').innerHTML = `<section class="card"><h3>Profile settings</h3><form class="grid-form" id="settingsForm"><div class="field col-6"><label>Full name</label><input name="full_name" value="${profile.full_name || ''}"></div><div class="field col-6"><label>Grade level</label><input name="grade_level" value="${profile.grade_level || ''}"></div><div class="field col-12"><label>Bio / note</label><textarea name="bio">${profile.bio || ''}</textarea></div><div class="field col-6"><label>&nbsp;</label><button class="btn">Save settings</button></div></form></section>`;
  document.getElementById('settingsForm')?.addEventListener('submit', async e=>{ e.preventDefault(); const btn=e.target.querySelector('button'); try{ UI.setLoading(btn,true); const fd=new FormData(e.target); await Common.upsert('profiles',{ id: profile.id, full_name: fd.get('full_name'), grade_level: fd.get('grade_level'), bio: fd.get('bio') }); UI.toast('Settings updated','success'); } catch(err){ UI.toast(err.message,'error'); } finally{ UI.setLoading(btn,false);} });
}

async function renderSimpleView(title, text) {
  document.getElementById('pageContent').innerHTML = `<section class="card"><h3>${title}</h3><p>${text}</p></section>`;
}

const pageMeta = {
  parent: {
    dashboard:['Dashboard','Overview of your children’s learning, tasks, reports, and portfolio evidence.'],
    children:['Children','Link and manage learner accounts for the family.'],
    assignments:['Assignments','Track tasks given to your children and their completion status.'],
    assessments:['Assessments','See formative and summative performance across subjects.'],
    portfolio:['Portfolio','Review reflections, uploads, and project evidence.'],
    attendance:['Attendance','Monitor consistency and participation over time.'],
    'report-cards':['Report Cards','Open term summaries and printable reports.'],
    resources:['Resources','Shared learning resources from tutors.'],
    messages:['Messages','Communicate with tutors and students.'],
    settings:['Settings','Manage your profile and account details.']
  },
  tutor: {
    dashboard:['Dashboard','Your teaching overview, current learners, assignments, and outcomes.'],
    learners:['Learners','Link learners to classrooms and review enrollment.'],
    classrooms:['Classrooms','Create classroom spaces for subjects or groups.'],
    assignments:['Assignments','Create, assign, and monitor learner tasks.'],
    assessments:['Assessments','Track formative and summative performance.'],
    portfolios:['Portfolios','Document learner growth with portfolio evidence.'],
    attendance:['Attendance','Record presence, absence, and punctuality.'],
    'report-cards':['Report Cards','Generate term reports and summaries.'],
    'lesson-plans':['Lesson Plans','Plan weekly or daily teaching flow.'],
    resources:['Resources','Upload worksheets, notes, and links.'],
    messages:['Messages','Communicate with parents and learners.'],
    settings:['Settings','Update your account profile.']
  },
  student: {
    dashboard:['Dashboard','Your tasks, scores, resources, and learning journey in one place.'],
    assignments:['My Work','Open assignments and submit completed work.'],
    assessments:['Assessments','Check your latest scores and feedback.'],
    portfolio:['Portfolio','See your projects, reflections, and uploads.'],
    attendance:['Attendance','Check your daily participation history.'],
    'report-card':['Report Card','View your latest report summary.'],
    resources:['Resources','Open notes, worksheets, and helpful links.'],
    messages:['Messages','Receive messages from your tutor or parent.'],
    settings:['Settings','Manage your learner profile.']
  }
};

(async function(){
  try {
    const role = document.body.dataset.role;
    const page = document.body.dataset.page;
    const [title, subtitle] = pageMeta[role][page];
    const bundle = await Common.boot(role, title === 'Portfolios' ? 'Portfolios' : title, title, subtitle);
    if (!bundle) return;
    const profile = bundle.profile;
    switch(`${role}:${page}`){
      case 'parent:dashboard':
      case 'tutor:dashboard':
      case 'student:dashboard': return renderDashboard(role, profile);
      case 'parent:children': return renderChildren(profile);
      case 'tutor:learners': return renderLearners(profile);
      case 'tutor:classrooms': return renderClassrooms(profile);
      case 'parent:assignments':
      case 'tutor:assignments':
      case 'student:assignments': return renderAssignments(role, profile);
      case 'parent:assessments':
      case 'tutor:assessments':
      case 'student:assessments': return renderAssessments(role, profile);
      case 'parent:portfolio':
      case 'tutor:portfolios':
      case 'student:portfolio': return renderPortfolio(role === 'tutor' ? 'tutor' : role, profile);
      case 'parent:attendance':
      case 'tutor:attendance':
      case 'student:attendance': return renderAttendance(role, profile);
      case 'parent:report-cards':
      case 'tutor:report-cards': return renderReportCards(role, profile);
      case 'student:report-card': return renderReportCards(role, profile);
      case 'parent:resources':
      case 'tutor:resources':
      case 'student:resources': return renderResources(role, profile);
      case 'tutor:lesson-plans': return renderLessonPlans(profile);
      case 'parent:messages':
      case 'tutor:messages':
      case 'student:messages': return renderMessages(role, profile);
      case 'parent:settings':
      case 'tutor:settings':
      case 'student:settings': return renderSettings(role, profile);
      default: return renderSimpleView(title, subtitle);
    }
  } catch(err) {
    console.error(err);
    document.body.innerHTML = `<div class="center" style="min-height:100vh;padding:24px"><div><h2>Setup needed</h2><p class="page-subtitle">${err.message || 'An error occurred.'}</p><div class="note" style="margin-top:14px">1. Add your Supabase keys in <strong>assets/js/config.js</strong><br>2. Run the SQL in <strong>sql/schema.sql</strong><br>3. Create the storage bucket named <strong>uploads</strong> if not created by SQL.</div></div></div>`;
  }
})();
