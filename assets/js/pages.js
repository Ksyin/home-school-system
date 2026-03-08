import './app.js';
const U = window.AppUtil;
const page = document.body.dataset.page;
const role = document.body.dataset.role;
const el = (id) => document.getElementById(id);

const empty = (t='No records yet.') => `<div class="empty">${t}</div>`;
const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

async function getAll(col){ return await U.listCollection(col); }
async function getUsersByRole(targetRole){ return (await getAll('users')).filter(u => u.role === targetRole); }
async function getRegisteredStudents(){
  const students = await getAll('students');
  const users = await getUsersByRole('student');
  const map = new Map(students.map(s => [s.uid || s.userUid || s.id, s]));
  return users.map(u => ({ ...u, ...(map.get(u.uid) || {}), uid: u.uid || u.id, name: map.get(u.uid)?.name || u.name, email: u.email, level: map.get(u.uid)?.level || u.level || '' }));
}
async function getTutorClassrooms(tutorUid){ return (await getAll('classrooms')).filter(c => c.tutorUid === tutorUid); }
async function getClassroomMembersForTutor(tutorUid){ return (await getAll('classroomMembers')).filter(m => m.tutorUid === tutorUid); }
async function getChildrenForParent(parentUid){
  const links = (await getAll('parentChildren')).filter(x => x.parentUid === parentUid);
  const students = await getRegisteredStudents();
  return links.map(link => ({ ...link, student: students.find(s => s.uid === link.studentUid) || null }));
}
async function getParentStudentUids(parentUid){ return (await getChildrenForParent(parentUid)).map(x => x.studentUid); }
async function getStudentClassroomIds(studentUid){ return (await getAll('classroomMembers')).filter(m => m.studentUid === studentUid).map(m => m.classroomId); }
async function getAssignmentsForStudent(studentUid){
  const classroomIds = await getStudentClassroomIds(studentUid);
  return (await getAll('assignments')).filter(a => a.studentUid === studentUid || (a.classroomId && classroomIds.includes(a.classroomId)));
}
async function getStudentSubmissions(studentUid){ return (await getAll('submissions')).filter(s => s.studentUid === studentUid); }
async function getTutorSubmissions(tutorUid){ return (await getAll('submissions')).filter(s => s.tutorUid === tutorUid); }
async function getStudentActivities(studentUid){ return (await getAll('activityLogs')).filter(a => a.studentUid === studentUid).sort((a,b)=> (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); }
async function getParentActivities(parentUid){ const ids = await getParentStudentUids(parentUid); return (await getAll('activityLogs')).filter(a => ids.includes(a.studentUid)).sort((a,b)=> (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); }
async function getStudentAssessments(studentUid){ return (await getAll('assessments')).filter(a => a.studentUid === studentUid); }
async function getStudentResources(studentUid){
  const classroomIds = await getStudentClassroomIds(studentUid);
  return (await getAll('resources')).filter(r => !r.studentUid || r.studentUid === studentUid || (r.classroomId && classroomIds.includes(r.classroomId)) || r.audience === 'All');
}
async function getStudentAttendance(studentUid){ return (await getAll('attendance')).filter(a => a.studentUid === studentUid); }
async function getStudentReports(studentUid){ return (await getAll('reports')).filter(r => r.studentUid === studentUid); }
async function getStudentPortfolios(studentUid){ return (await getAll('portfolio')).filter(p => p.studentUid === studentUid); }
function renderSelectOptions(items, valueKey='id', labelFn=(x)=>x.name||x.title||x.id){
  return items.map(item => `<option value="${esc(item[valueKey])}">${esc(labelFn(item))}</option>`).join('');
}
function reportSummaryFromData(student, assessments, submissions, attendance){
  const avg = assessments.length ? Math.round(assessments.reduce((s,a)=>s+(Number(a.score)||0),0)/assessments.length) : 0;
  const submitted = submissions.filter(s => s.status === 'Submitted' || s.status === 'Reviewed').length;
  const attendanceRate = attendance.length ? Math.round((attendance.filter(a => a.status === 'Present').length / attendance.length)*100) : 0;
  let performance = 'Developing';
  if (avg >= 80) performance = 'Excellent';
  else if (avg >= 65) performance = 'Good';
  else if (avg >= 50) performance = 'Fair';
  return {
    studentName: student?.name || 'Student',
    average: avg,
    performance,
    attendanceRate,
    submissions: submitted,
    remark: avg >= 80 ? 'Strong progress. Keep it up.' : avg >= 60 ? 'Good effort. Continue building consistency.' : 'Needs extra support and close follow-up.'
  };
}

async function dashboard(currentRole, profile){
  const content = el('page-content');
  if(currentRole === 'tutor'){
    const classrooms = await getTutorClassrooms(profile.uid);
    const members = await getClassroomMembersForTutor(profile.uid);
    const assignments = (await getAll('assignments')).filter(a => a.tutorUid === profile.uid);
    const submissions = (await getAll('submissions')).filter(s => s.tutorUid === profile.uid);
    const assessments = (await getAll('assessments')).filter(a => a.tutorUid === profile.uid);
    const students = await getRegisteredStudents();
    const recentStudents = members.map(m => students.find(s => s.uid === m.studentUid)).filter(Boolean).slice(0,6);
    content.innerHTML = `
      <div class="grid grid-4">
        ${U.statCard('Classrooms', classrooms.length, 'Teaching groups created')}
        ${U.statCard('Learners', members.length, 'Students linked to your classes')}
        ${U.statCard('Assignments', assignments.length, 'Class and individual tasks')}
        ${U.statCard('Submissions', submissions.length, 'Student work received')}
      </div>
      <div class="grid grid-2" style="margin-top:18px">
        <div class="card panel"><div class="toolbar"><h3>Quick actions</h3></div><div class="row"><a class="btn" href="/tutor/classrooms.html">Create classroom</a><a class="btn secondary" href="/tutor/assignments.html">Assign work</a><a class="btn secondary" href="/tutor/report-cards.html">Report cards</a></div></div>
        <div class="card panel"><div class="toolbar"><h3>Assessment snapshot</h3></div><div class="list"><div class="list-item">Assessments recorded: <strong>${assessments.length}</strong></div><div class="list-item">Reviewed submissions: <strong>${submissions.filter(s=>s.status==='Reviewed').length}</strong></div><div class="list-item">Pending review: <strong>${submissions.filter(s=>s.status==='Submitted').length}</strong></div></div></div>
      </div>
      <div class="grid grid-2" style="margin-top:18px">
        <div class="card panel"><div class="toolbar"><h3>Your learners</h3><a class="btn secondary" href="/tutor/learners.html">Manage</a></div><div class="list">${recentStudents.map(s=>`<div class="list-item"><strong>${esc(s.name)}</strong><div class="muted">${esc(s.email||'')} ${s.level?`• ${esc(s.level)}`:''}</div></div>`).join('') || empty('No learners linked yet.')}</div></div>
        <div class="card panel"><div class="toolbar"><h3>Latest assignments</h3><a class="btn secondary" href="/tutor/assignments.html">Open</a></div><div class="list">${assignments.slice(0,6).map(a=>`<div class="list-item"><strong>${esc(a.title)}</strong><div class="muted">${esc(a.subject||'')} • ${a.classroomName ? esc(a.classroomName) : (a.studentName ? esc(a.studentName) : 'General')}</div></div>`).join('') || empty('No assignments yet.')}</div></div>
      </div>`;
    return;
  }

  if(currentRole === 'student'){
    const assignments = await getAssignmentsForStudent(profile.uid);
    const submissions = await getStudentSubmissions(profile.uid);
    const assessments = await getStudentAssessments(profile.uid);
    const resources = await getStudentResources(profile.uid);
    content.innerHTML = `
      <div class="grid grid-4">
        ${U.statCard('My Work', assignments.length, 'Tasks assigned to you')}
        ${U.statCard('Submitted', submissions.length, 'Work uploaded so far')}
        ${U.statCard('Assessments', assessments.length, 'Scored teacher reviews')}
        ${U.statCard('Resources', resources.length, 'Lessons and worksheets')}
      </div>
      <div class="grid grid-2" style="margin-top:18px">
        <div class="card panel"><div class="toolbar"><h3>Pending work</h3><a class="btn secondary" href="/student/assignments.html">Open</a></div><div class="list">${assignments.filter(a=>!submissions.some(s=>s.assignmentId===a.id)).slice(0,6).map(a=>`<div class="list-item"><strong>${esc(a.title)}</strong><div class="muted">${esc(a.subject||'')} • Due ${U.fmtDate(a.dueDate)}</div></div>`).join('') || empty('No pending work right now.')}</div></div>
        <div class="card panel"><div class="toolbar"><h3>My submitted work</h3><a class="btn secondary" href="/student/submit-work.html">View</a></div><div class="list">${submissions.slice(0,6).map(s=>`<div class="list-item"><strong>${esc(s.assignmentTitle||'Submission')}</strong><div class="muted">${U.statusBadge(s.status||'Submitted')} ${s.grade?`• Grade ${esc(s.grade)}`:''}</div></div>`).join('') || empty('You have not submitted any work yet.')}</div></div>
        <div class="card panel"><div class="toolbar"><h3>Growth notes</h3><a class="btn secondary" href="/student/activities.html">Open</a></div><div class="list">${activities.slice(0,6).map(a=>`<div class="list-item"><strong>${esc(a.subject || a.area || 'Daily note')}</strong><div class="muted">${esc(a.type||'Observation')} • ${esc(a.comment||'')}</div></div>`).join('') || empty('No daily tutor notes yet.')}</div></div>
      </div>`;
    return;
  }

  const childUids = await getParentStudentUids(profile.uid);
  const students = await getRegisteredStudents();
  const children = students.filter(s => childUids.includes(s.uid));
  const allAssignments = await getAll('assignments');
  const allAssessments = await getAll('assessments');
  const allAttendance = await getAll('attendance');
  const assignments = allAssignments.filter(a => childUids.includes(a.studentUid));
  const assessments = allAssessments.filter(a => childUids.includes(a.studentUid));
  const attendance = allAttendance.filter(a => childUids.includes(a.studentUid));
  content.innerHTML = `
    <div class="grid grid-4">
      ${U.statCard('Children', children.length, 'Linked learner accounts')}
      ${U.statCard('Assignments', assignments.length, 'Tasks across your learners')}
      ${U.statCard('Assessments', assessments.length, 'Marked evaluations')}
      ${U.statCard('Attendance', attendance.length, 'Recorded sessions')}
    </div>
    <div class="grid grid-2" style="margin-top:18px">
      <div class="card panel"><div class="toolbar"><h3>Linked children</h3><a class="btn secondary" href="/parent/children.html">Manage</a></div><div class="list">${children.map(c=>`<div class="list-item"><strong>${esc(c.name)}</strong><div class="muted">${esc(c.email||'')} ${c.level?`• ${esc(c.level)}`:''}</div></div>`).join('') || empty('Link a student account first.')}</div></div>
      <div class="card panel"><div class="toolbar"><h3>Latest scores</h3><a class="btn secondary" href="/parent/assessments.html">View</a></div><div class="list">${assessments.slice(0,6).map(a=>`<div class="list-item"><strong>${esc(a.studentName||'Learner')}</strong><div class="muted">${esc(a.subject||'')} • Score ${esc(a.score||'0')}</div></div>`).join('') || empty('No assessments recorded yet.')}</div></div>
    </div>`;
}

async function children(profile){
  const students = await getRegisteredStudents();
  const linked = await getChildrenForParent(profile.uid);
  const linkedIds = new Set(linked.map(x=>x.studentUid));
  const choices = students.filter(s => !linkedIds.has(s.uid));
  el('page-content').innerHTML = `
    <div class="card panel"><div class="toolbar"><h3>Link child account</h3></div>
      <form id="childForm" class="form-grid two">
        <div><label>Select registered student</label><select name="studentUid" required><option value="">Choose student</option>${renderSelectOptions(choices, 'uid', s => `${s.name}${s.level?` (${s.level})`:''}`)}</select></div>
        <div class="row" style="align-items:end"><button type="submit">Link child</button></div>
      </form>
    </div>
    <div style="margin-top:18px">${U.simpleTable(['Name','Email','Level'], linked.map(x=>`<tr><td>${esc(x.student?.name || x.studentUid)}</td><td>${esc(x.student?.email || '—')}</td><td>${esc(x.student?.level || '—')}</td></tr>`).join(''))}</div>`;
  el('childForm').onsubmit = async (e) => {
    e.preventDefault();
    const studentUid = e.target.studentUid.value;
    await U.saveDoc('parentChildren', { parentUid: profile.uid, studentUid, createdAt: U.serverTimestamp() }, `${profile.uid}_${studentUid}`);
    await U.saveDoc('students', { parentUid: profile.uid }, studentUid);
    location.reload();
  };
}

async function tutorLearners(profile){
  const classrooms = await getTutorClassrooms(profile.uid);
  const students = await getRegisteredStudents();
  const members = await getClassroomMembersForTutor(profile.uid);
  const studentsById = Object.fromEntries(students.map(s=>[s.uid,s]));
  const classroomsById = Object.fromEntries(classrooms.map(c=>[c.id,c]));
  el('page-content').innerHTML = `
    <div class="grid grid-2">
      <div class="card panel"><div class="toolbar"><h3>Link learner to classroom</h3></div>
        <form id="learnerLinkForm" class="form-grid two">
          <div><label>Student</label><select name="studentUid" required><option value="">Choose student</option>${renderSelectOptions(students,'uid',s=>`${s.name}${s.level?` (${s.level})`:''}`)}</select></div>
          <div><label>Classroom</label><select name="classroomId" required><option value="">Choose classroom</option>${renderSelectOptions(classrooms,'id',c=>c.name)}</select></div>
          <div class="row" style="align-items:end"><button type="submit">Link learner</button></div>
        </form>
      </div>
      <div class="card panel"><div class="toolbar"><h3>Registered students</h3></div><div class="list">${students.slice(0,12).map(s=>`<div class="list-item"><strong>${esc(s.name)}</strong><div class="muted">${esc(s.email||'')} ${s.level?`• ${esc(s.level)}`:''}</div></div>`).join('') || empty()}</div></div>
    </div>
    <div style="margin-top:18px">${U.simpleTable(['Learner','Classroom','Level'], members.map(m=>`<tr><td>${esc(studentsById[m.studentUid]?.name || m.studentUid)}</td><td>${esc(classroomsById[m.classroomId]?.name || m.classroomId)}</td><td>${esc(studentsById[m.studentUid]?.level || '—')}</td></tr>`).join(''))}</div>`;
  el('learnerLinkForm').onsubmit = async (e) => {
    e.preventDefault();
    const studentUid = e.target.studentUid.value;
    const classroomId = e.target.classroomId.value;
    const classroom = classroomsById[classroomId];
    await U.saveDoc('classroomMembers', { tutorUid: profile.uid, studentUid, classroomId, classroomName: classroom?.name || '', createdAt: U.serverTimestamp() }, `${classroomId}_${studentUid}`);
    const student = studentsById[studentUid];
    const existingIds = Array.isArray(student?.classroomIds) ? student.classroomIds : [];
    const mergedIds = Array.from(new Set([...existingIds, classroomId]));
    await U.saveDoc('students', { tutorUid: profile.uid, classroomIds: mergedIds }, studentUid);
    location.reload();
  };
}

async function assignments(currentRole, profile){
  const content = el('page-content');
  if(currentRole === 'tutor'){
    const classrooms = await getTutorClassrooms(profile.uid);
    const members = await getClassroomMembersForTutor(profile.uid);
    const students = await getRegisteredStudents();
    const studentsById = Object.fromEntries(students.map(s=>[s.uid,s]));
    const classroomMemberMap = {};
    for(const m of members){ (classroomMemberMap[m.classroomId] ||= []).push(m.studentUid); }
    const items = (await getAll('assignments')).filter(a => a.tutorUid === profile.uid);
    content.innerHTML = `
      <div class="card panel"><div class="toolbar"><h3>Create assignment</h3></div>
        <form id="assignmentForm" class="form-grid two">
          <div><label>Title</label><input name="title" required></div>
          <div><label>Subject</label><input name="subject" required></div>
          <div><label>Classroom</label><select name="classroomId"><option value="">Choose classroom</option>${renderSelectOptions(classrooms,'id',c=>c.name)}</select></div>
          <div><label>Specific student (optional)</label><select name="studentUid"><option value="">Whole classroom / direct assignment later</option>${renderSelectOptions(students,'uid',s=>`${s.name}${s.level?` (${s.level})`:''}`)}</select></div>
          <div><label>Due date</label><input type="date" name="dueDate"></div>
          <div><label>Worksheet / file</label><input type="file" name="file"></div>
          <div style="grid-column:1/-1"><label>Description</label><textarea name="description"></textarea></div>
          <div class="row" style="align-items:end"><button type="submit">Publish assignment</button></div>
        </form></div>
      <div style="margin-top:18px">${U.simpleTable(['Title','Subject','Target','Due','Status'], items.map(a=>`<tr><td>${esc(a.title)}</td><td>${esc(a.subject||'')}</td><td>${esc(a.studentName || a.classroomName || 'General')}</td><td>${U.fmtDate(a.dueDate)}</td><td>${U.statusBadge(a.status || 'Pending')}</td></tr>`).join(''))}</div>`;
    el('assignmentForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const classroomId = f.classroomId.value || '';
      const studentUid = f.studentUid.value || '';
      const classroom = classrooms.find(c => c.id === classroomId);
      const student = studentsById[studentUid];
      const fileUrl = await U.uploadFile(f.file.files[0], 'assignments');
      const targetStudentUids = studentUid ? [studentUid] : (classroomId ? (classroomMemberMap[classroomId] || []) : []);
      await U.saveDoc('assignments', {
        title: f.title.value,
        subject: f.subject.value,
        description: f.description.value,
        dueDate: f.dueDate.value,
        fileUrl,
        tutorUid: profile.uid,
        tutorName: profile.name,
        classroomId,
        classroomName: classroom?.name || '',
        studentUid,
        studentName: student?.name || '',
        targetStudentUids,
        status: 'Pending',
        createdAt: U.serverTimestamp()
      });
      location.reload();
    };
    return;
  }

  if(currentRole === 'student'){
    const items = await getAssignmentsForStudent(profile.uid);
    const submissions = await getStudentSubmissions(profile.uid);
    content.innerHTML = U.simpleTable(['Title','Subject','Due','Worksheet','My status'], items.map(a=>{
      const sub = submissions.find(s => s.assignmentId === a.id);
      return `<tr><td>${esc(a.title)}</td><td>${esc(a.subject||'')}</td><td>${U.fmtDate(a.dueDate)}</td><td>${a.fileUrl?`<a class="btn secondary" target="_blank" href="${a.fileUrl}">Open</a>`:'—'}</td><td>${sub ? U.statusBadge(sub.status || 'Submitted') : U.statusBadge('Pending')}</td></tr>`;
    }).join(''));
    return;
  }

  const childUids = await getParentStudentUids(profile.uid);
  const items = (await getAll('assignments')).filter(a => childUids.includes(a.studentUid));
  content.innerHTML = U.simpleTable(['Child','Title','Subject','Due','Status'], items.map(a=>`<tr><td>${esc(a.studentName || a.studentUid)}</td><td>${esc(a.title)}</td><td>${esc(a.subject||'')}</td><td>${U.fmtDate(a.dueDate)}</td><td>${U.statusBadge(a.status||'Pending')}</td></tr>`).join(''));
}

async function assessments(currentRole, profile){
  const content = el('page-content');
  if(currentRole === 'tutor'){
    const students = await getRegisteredStudents();
    const items = (await getAll('assessments')).filter(a => a.tutorUid === profile.uid);
    content.innerHTML = `
      <div class="card panel"><div class="toolbar"><h3>Record assessment</h3></div>
        <form id="assessmentForm" class="form-grid two">
          <div><label>Student</label><select name="studentUid" required><option value="">Choose student</option>${renderSelectOptions(students,'uid',s=>`${s.name}${s.level?` (${s.level})`:''}`)}</select></div>
          <div><label>Subject</label><input name="subject" required></div>
          <div><label>Assessment title</label><input name="title" required></div>
          <div><label>Score</label><input type="number" min="0" max="100" name="score" required></div>
          <div style="grid-column:1/-1"><label>Feedback</label><textarea name="feedback"></textarea></div>
          <div class="row" style="align-items:end"><button type="submit">Save assessment</button></div>
        </form></div>
      <div style="margin-top:18px">${U.simpleTable(['Student','Assessment','Subject','Score','Feedback'], items.map(a=>`<tr><td>${esc(a.studentName||a.studentUid)}</td><td>${esc(a.title)}</td><td>${esc(a.subject||'')}</td><td>${esc(a.score||0)}</td><td>${esc(a.feedback||'—')}</td></tr>`).join(''))}</div>`;
    el('assessmentForm').onsubmit = async (e) => {
      e.preventDefault();
      const student = students.find(s => s.uid === e.target.studentUid.value);
      await U.saveDoc('assessments', { studentUid: e.target.studentUid.value, studentName: student?.name || '', title: e.target.title.value, subject: e.target.subject.value, score: Number(e.target.score.value||0), feedback: e.target.feedback.value, tutorUid: profile.uid, tutorName: profile.name, createdAt: U.serverTimestamp() });
      location.reload();
    };
    return;
  }
  const items = currentRole === 'student' ? await getStudentAssessments(profile.uid) : (await getAll('assessments')).filter(a => (await getParentStudentUids(profile.uid)).includes(a.studentUid));
  content.innerHTML = U.simpleTable(['Assessment','Subject','Score','Feedback'], items.map(a=>`<tr><td>${esc(a.title||'Assessment')}</td><td>${esc(a.subject||'')}</td><td>${esc(a.score||0)}</td><td>${esc(a.feedback||'—')}</td></tr>`).join(''));
}

async function portfolio(currentRole, profile){
  const content = el('page-content');
  if(currentRole === 'tutor'){
    const students = await getRegisteredStudents();
    const items = (await getAll('portfolio')).filter(p => p.tutorUid === profile.uid);
    content.innerHTML = `
      <div class="card panel"><div class="toolbar"><h3>Add portfolio evidence</h3></div>
      <form id="portfolioForm" class="form-grid two">
        <div><label>Student</label><select name="studentUid" required><option value="">Choose student</option>${renderSelectOptions(students,'uid',s=>`${s.name}${s.level?` (${s.level})`:''}`)}</select></div>
        <div><label>Title</label><input name="title" required></div>
        <div style="grid-column:1/-1"><label>Reflection / note</label><textarea name="note"></textarea></div>
        <div><label>Upload evidence</label><input type="file" name="file"></div>
        <div class="row" style="align-items:end"><button type="submit">Save portfolio item</button></div>
      </form></div>
      <div style="margin-top:18px">${U.simpleTable(['Student','Title','Note','File'], items.map(p=>`<tr><td>${esc(p.studentName||p.studentUid)}</td><td>${esc(p.title)}</td><td>${esc(p.note||'—')}</td><td>${p.fileUrl?`<a class="btn secondary" target="_blank" href="${p.fileUrl}">Open</a>`:'—'}</td></tr>`).join(''))}</div>`;
    el('portfolioForm').onsubmit = async (e) => {
      e.preventDefault();
      const student = students.find(s => s.uid === e.target.studentUid.value);
      const fileUrl = await U.uploadFile(e.target.file.files[0], 'portfolio');
      await U.saveDoc('portfolio', { studentUid: e.target.studentUid.value, studentName: student?.name || '', title: e.target.title.value, note: e.target.note.value, fileUrl, tutorUid: profile.uid, createdAt: U.serverTimestamp() });
      location.reload();
    };
    return;
  }
  const items = currentRole === 'student' ? await getStudentPortfolios(profile.uid) : (await getAll('portfolio')).filter(p => (await getParentStudentUids(profile.uid)).includes(p.studentUid));
  content.innerHTML = `<div class="list">${items.map(p=>`<div class="list-item"><div><strong>${esc(p.title)}</strong><div class="muted">${esc(p.note||'')}</div></div>${p.fileUrl?`<a class="btn secondary" target="_blank" href="${p.fileUrl}">Open</a>`:''}</div>`).join('') || empty()}</div>`;
}

async function attendance(currentRole, profile){
  const content = el('page-content');
  if(currentRole === 'tutor'){
    const students = await getRegisteredStudents();
    const items = (await getAll('attendance')).filter(a => a.tutorUid === profile.uid);
    content.innerHTML = `
      <div class="card panel"><div class="toolbar"><h3>Record attendance</h3></div>
      <form id="attendanceForm" class="form-grid two">
        <div><label>Student</label><select name="studentUid" required><option value="">Choose student</option>${renderSelectOptions(students,'uid',s=>`${s.name}${s.level?` (${s.level})`:''}`)}</select></div>
        <div><label>Date</label><input type="date" name="date" required></div>
        <div><label>Status</label><select name="status"><option>Present</option><option>Absent</option><option>Late</option></select></div>
        <div class="row" style="align-items:end"><button type="submit">Save attendance</button></div>
      </form></div>
      <div style="margin-top:18px">${U.simpleTable(['Student','Date','Status'], items.map(a=>`<tr><td>${esc(a.studentName||a.studentUid)}</td><td>${U.fmtDate(a.date)}</td><td>${U.statusBadge(a.status||'Present')}</td></tr>`).join(''))}</div>`;
    el('attendanceForm').onsubmit = async (e) => {
      e.preventDefault();
      const student = students.find(s => s.uid === e.target.studentUid.value);
      await U.saveDoc('attendance', { studentUid: e.target.studentUid.value, studentName: student?.name || '', date: e.target.date.value, status: e.target.status.value, tutorUid: profile.uid, createdAt: U.serverTimestamp() }, `${e.target.studentUid.value}_${e.target.date.value}`);
      location.reload();
    };
    return;
  }
  const items = currentRole === 'student' ? await getStudentAttendance(profile.uid) : (await getAll('attendance')).filter(a => (await getParentStudentUids(profile.uid)).includes(a.studentUid));
  content.innerHTML = U.simpleTable(['Date','Status','Learner'], items.map(a=>`<tr><td>${U.fmtDate(a.date)}</td><td>${U.statusBadge(a.status||'Present')}</td><td>${esc(a.studentName||'')}</td></tr>`).join(''));
}

async function reports(currentRole, profile){
  const content = el('page-content');
  if(currentRole === 'tutor'){
    const students = await getRegisteredStudents();
    const summaries = [];
    for(const student of students){
      const assessments = (await getAll('assessments')).filter(a => a.studentUid === student.uid && a.tutorUid === profile.uid);
      const submissions = (await getAll('submissions')).filter(s => s.studentUid === student.uid && s.tutorUid === profile.uid);
      const attendance = (await getAll('attendance')).filter(a => a.studentUid === student.uid && a.tutorUid === profile.uid);
      if(assessments.length || submissions.length || attendance.length) summaries.push({ student, ...reportSummaryFromData(student, assessments, submissions, attendance) });
    }
    content.innerHTML = `
      <div class="card panel"><div class="toolbar"><h3>Automatic report card summary</h3><span class="badge success">Generated live from assessments, submissions, and attendance</span></div>
      ${U.simpleTable(['Learner','Average','Performance','Attendance','Submissions','Remark'], summaries.map(r=>`<tr><td>${esc(r.studentName)}</td><td>${esc(r.average)}</td><td>${esc(r.performance)}</td><td>${esc(r.attendanceRate)}%</td><td>${esc(r.submissions)}</td><td>${esc(r.remark)}</td></tr>`).join(''))}
      </div>`;
    return;
  }

  if(currentRole === 'student'){
    const summary = reportSummaryFromData({name: profile.name}, await getStudentAssessments(profile.uid), await getStudentSubmissions(profile.uid), await getStudentAttendance(profile.uid));
    content.innerHTML = `<div class="card panel"><h3>My report card</h3><div class="stack"><div class="kv"><strong>Average</strong><span>${summary.average}</span></div><div class="kv"><strong>Performance</strong><span>${summary.performance}</span></div><div class="kv"><strong>Attendance</strong><span>${summary.attendanceRate}%</span></div><div class="kv"><strong>Submitted work</strong><span>${summary.submissions}</span></div><div class="kv"><strong>Teacher note</strong><span>${esc(summary.remark)}</span></div></div></div>`;
    return;
  }

  const childLinks = await getChildrenForParent(profile.uid);
  const blocks = [];
  for(const item of childLinks){
    const student = item.student;
    if(!student) continue;
    const summary = reportSummaryFromData(student, await getStudentAssessments(student.uid), await getStudentSubmissions(student.uid), await getStudentAttendance(student.uid));
    blocks.push(`<div class="card panel"><h3>${esc(summary.studentName)}</h3><div class="stack"><div class="kv"><strong>Average</strong><span>${summary.average}</span></div><div class="kv"><strong>Performance</strong><span>${summary.performance}</span></div><div class="kv"><strong>Attendance</strong><span>${summary.attendanceRate}%</span></div><div class="kv"><strong>Submitted work</strong><span>${summary.submissions}</span></div><div class="kv"><strong>Teacher note</strong><span>${esc(summary.remark)}</span></div></div></div>`);
  }
  content.innerHTML = blocks.join('') || `<div class="card panel">${empty('No linked child report cards yet.')}</div>`;
}

async function resources(currentRole, profile){
  const content = el('page-content');
  if(currentRole === 'tutor'){
    const classrooms = await getTutorClassrooms(profile.uid);
    const students = await getRegisteredStudents();
    const items = (await getAll('resources')).filter(r => r.tutorUid === profile.uid);
    content.innerHTML = `
      <div class="card panel"><div class="toolbar"><h3>Upload learning material</h3><span class="badge success">Tutor manages learning materials</span></div>
      <form id="resourceForm" class="form-grid two">
        <div><label>Title</label><input name="title" required></div>
        <div><label>Subject</label><input name="subject"></div>
        <div><label>Classroom (optional)</label><select name="classroomId"><option value="">All / no classroom</option>${renderSelectOptions(classrooms,'id',c=>c.name)}</select></div>
        <div><label>Specific student (optional)</label><select name="studentUid"><option value="">All learners</option>${renderSelectOptions(students,'uid',s=>`${s.name}${s.level?` (${s.level})`:''}`)}</select></div>
        <div style="grid-column:1/-1"><label>Description</label><textarea name="description"></textarea></div>
        <div><label>File</label><input type="file" name="file" required></div>
        <div class="row" style="align-items:end"><button type="submit">Save resource</button></div>
      </form></div>
      <div style="margin-top:18px">${U.simpleTable(['Title','Subject','Target','File'], items.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.subject||'')}</td><td>${esc(r.studentName || r.classroomName || 'All learners')}</td><td>${r.fileUrl?`<a class="btn secondary" target="_blank" href="${r.fileUrl}">Download</a>`:'—'}</td></tr>`).join(''))}</div>`;
    el('resourceForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const classroom = classrooms.find(c=>c.id===f.classroomId.value);
      const student = students.find(s=>s.uid===f.studentUid.value);
      const fileUrl = await U.uploadFile(f.file.files[0], 'resources');
      await U.saveDoc('resources', { title: f.title.value, subject: f.subject.value, description: f.description.value, classroomId: f.classroomId.value || '', classroomName: classroom?.name || '', studentUid: f.studentUid.value || '', studentName: student?.name || '', audience: 'All', fileUrl, tutorUid: profile.uid, tutorName: profile.name, createdAt: U.serverTimestamp() });
      location.reload();
    };
    return;
  }

  let items = [];
  if(currentRole === 'student') items = await getStudentResources(profile.uid);
  else {
    const childUids = await getParentStudentUids(profile.uid);
    const all = await getAll('resources');
    items = all.filter(r => !r.studentUid || childUids.includes(r.studentUid));
  }
  content.innerHTML = U.simpleTable(['Title','Subject','Description','File'], items.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.subject||'')}</td><td>${esc(r.description||'—')}</td><td>${r.fileUrl?`<a class="btn secondary" target="_blank" href="${r.fileUrl}">Download</a>`:'—'}</td></tr>`).join(''));
}

async function lessonPlans(profile){
  const items = (await getAll('lessonPlans')).filter(p => p.tutorUid === profile.uid);
  const classrooms = await getTutorClassrooms(profile.uid);
  el('page-content').innerHTML = `
    <div class="card panel"><div class="toolbar"><h3>Create lesson plan</h3></div>
      <form id="planForm" class="form-grid two">
        <div><label>Title</label><input name="title" required></div>
        <div><label>Subject</label><input name="subject"></div>
        <div><label>Date</label><input type="date" name="date"></div>
        <div><label>Classroom</label><select name="classroomId"><option value="">Choose classroom</option>${renderSelectOptions(classrooms,'id',c=>c.name)}</select></div>
        <div style="grid-column:1/-1"><label>Objectives</label><textarea name="objectives"></textarea></div>
        <div style="grid-column:1/-1"><label>Activities</label><textarea name="activities"></textarea></div>
        <div class="row" style="align-items:end"><button type="submit">Save lesson plan</button></div>
      </form></div>
    <div style="margin-top:18px">${U.simpleTable(['Title','Subject','Date','Classroom'], items.map(p=>`<tr><td>${esc(p.title)}</td><td>${esc(p.subject||'')}</td><td>${U.fmtDate(p.date)}</td><td>${esc(p.classroomName||'—')}</td></tr>`).join(''))}</div>`;
  el('planForm').onsubmit = async (e) => {
    e.preventDefault();
    const classroom = classrooms.find(c => c.id === e.target.classroomId.value);
    await U.saveDoc('lessonPlans', { title: e.target.title.value, subject: e.target.subject.value, date: e.target.date.value, classroomId: e.target.classroomId.value || '', classroomName: classroom?.name || '', objectives: e.target.objectives.value, activities: e.target.activities.value, tutorUid: profile.uid, createdAt: U.serverTimestamp() });
    location.reload();
  };
}

async function classrooms(profile){
  const items = await getTutorClassrooms(profile.uid);
  const members = await getClassroomMembersForTutor(profile.uid);
  el('page-content').innerHTML = `
    <div class="card panel"><div class="toolbar"><h3>Create classroom / group</h3></div>
      <form id="classroomForm" class="form-grid two">
        <div><label>Classroom name</label><input name="name" required></div>
        <div><label>Level</label><input name="level"></div>
        <div style="grid-column:1/-1"><label>Description</label><textarea name="description"></textarea></div>
        <div class="row" style="align-items:end"><button type="submit">Save classroom</button></div>
      </form></div>
    <div style="margin-top:18px">${U.simpleTable(['Name','Level','Description','Learners'], items.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.level||'—')}</td><td>${esc(c.description||'—')}</td><td>${members.filter(m=>m.classroomId===c.id).length}</td></tr>`).join(''))}</div>`;
  el('classroomForm').onsubmit = async (e) => {
    e.preventDefault();
    await U.saveDoc('classrooms', { name: e.target.name.value, level: e.target.level.value, description: e.target.description.value, tutorUid: profile.uid, tutorName: profile.name, createdAt: U.serverTimestamp() });
    location.reload();
  };
}

async function submitWork(profile){
  const assignments = await getAssignmentsForStudent(profile.uid);
  const submissions = await getStudentSubmissions(profile.uid);
  el('page-content').innerHTML = `
    <div class="card panel"><div class="toolbar"><h3>Submit completed work</h3></div>
      <form id="submitForm" class="form-grid two">
        <div><label>Select assignment</label><select name="assignmentId" required><option value="">Choose assignment</option>${renderSelectOptions(assignments,'id',a=>`${a.title} • ${a.subject||''}`)}</select></div>
        <div><label>Upload file</label><input type="file" name="file" required></div>
        <div style="grid-column:1/-1"><label>Notes to tutor</label><textarea name="notes"></textarea></div>
        <div class="row" style="align-items:end"><button type="submit">Submit work</button></div>
      </form></div>
    <div style="margin-top:18px">${U.simpleTable(['Assignment','Notes','File','Status','Grade','Feedback'], submissions.map(s=>`<tr><td>${esc(s.assignmentTitle||s.assignmentId)}</td><td>${esc(s.notes||'—')}</td><td>${s.fileUrl?`<a class="btn secondary" target="_blank" href="${s.fileUrl}">Open</a>`:'—'}</td><td>${U.statusBadge(s.status || 'Submitted')}</td><td>${esc(s.grade||'—')}</td><td>${esc(s.feedback||'—')}</td></tr>`).join(''))}</div>`;
  el('submitForm').onsubmit = async (e) => {
    e.preventDefault();
    const assignment = assignments.find(a => a.id === e.target.assignmentId.value);
    const fileUrl = await U.uploadFile(e.target.file.files[0], 'submissions');
    await U.saveDoc('submissions', { assignmentId: assignment.id, assignmentTitle: assignment.title, studentUid: profile.uid, studentName: profile.name, tutorUid: assignment.tutorUid || '', tutorName: assignment.tutorName || '', notes: e.target.notes.value, fileUrl, status: 'Submitted', grade: '', feedback: '', createdAt: U.serverTimestamp() }, `${assignment.id}_${profile.uid}`);
    await U.saveDoc('assignments', { status: 'Submitted' }, assignment.id);
    location.reload();
  };
}


async function reviewSubmissions(profile){
  const content = el('page-content');
  const submissions = await getTutorSubmissions(profile.uid);
  const assignments = await getAll('assignments');
  const students = await getRegisteredStudents();
  const subRows = submissions.sort((a,b)=> (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const assignmentById = Object.fromEntries(assignments.map(a=>[a.id,a]));
  const studentById = Object.fromEntries(students.map(s=>[s.uid,s]));
  content.innerHTML = `
    <div class="split">
      <div class="card panel">
        <div class="toolbar"><h3>Submission review queue</h3><span class="badge success">Live from Firestore</span></div>
        ${U.simpleTable(['Learner','Assignment','Status','Grade','Open'], subRows.map(s=>`<tr><td>${esc(s.studentName || studentById[s.studentUid]?.name || s.studentUid)}</td><td>${esc(s.assignmentTitle || assignmentById[s.assignmentId]?.title || 'Assignment')}</td><td>${U.statusBadge(s.status || 'Submitted')}</td><td>${esc(s.grade || '—')}</td><td><a class="btn secondary" href="/tutor/review-submissions.html?submission=${s.id}">Review</a></td></tr>`).join(''))}
      </div>
      <div class="card panel">
        <div class="toolbar"><h3>Review selected submission</h3></div>
        <div id="reviewPane" class="note-box">Choose a submission from the table to review it.</div>
      </div>
    </div>`;

  const params = new URLSearchParams(location.search);
  const selectedId = params.get('submission') || subRows[0]?.id;
  const selected = subRows.find(s=>s.id===selectedId);
  const pane = document.getElementById('reviewPane');
  if(!selected){ pane.innerHTML = 'No submissions yet.'; return; }
  const assignment = assignmentById[selected.assignmentId] || {};
  pane.innerHTML = `
    <form id="reviewForm" class="form-grid two">
      <input type="hidden" name="submissionId" value="${selected.id}">
      <div><label>Learner</label><input value="${esc(selected.studentName || studentById[selected.studentUid]?.name || '')}" disabled></div>
      <div><label>Assignment</label><input value="${esc(selected.assignmentTitle || assignment.title || '')}" disabled></div>
      <div><label>Status</label><select name="status"><option ${selected.status==='Submitted'?'selected':''}>Submitted</option><option ${selected.status==='Reviewed'?'selected':''}>Reviewed</option><option ${selected.status==='Needs Revision'?'selected':''}>Needs Revision</option></select></div>
      <div><label>Grade</label><input name="grade" type="number" min="0" max="100" value="${esc(selected.grade||'')}"></div>
      <div style="grid-column:1/-1"><label>Feedback to learner</label><textarea class="textarea-xl" name="feedback">${esc(selected.feedback||'')}</textarea></div>
      <div style="grid-column:1/-1"><label>Tutor review notes</label><textarea name="reviewNotes">${esc(selected.reviewNotes||'')}</textarea></div>
      <div class="actions" style="grid-column:1/-1">
        <button type="submit">Save review</button>
        <button type="button" class="btn success" id="markReviewedBtn">Mark reviewed</button>
        ${selected.fileUrl ? `<a class="btn secondary" target="_blank" href="${selected.fileUrl}">Open learner file</a>` : ''}
      </div>
    </form>
    <div style="margin-top:14px" class="note-box"><strong>Student note:</strong> ${esc(selected.notes||'No note added.')}</div>`;

  const persistReview = async (statusOverride='')=>{
    const form = document.getElementById('reviewForm');
    const fd = new FormData(form);
    const gradeValue = fd.get('grade') ? Number(fd.get('grade')) : '';
    const status = statusOverride || fd.get('status');
    await U.saveDoc('submissions', {
      status,
      grade: gradeValue === '' ? '' : gradeValue,
      feedback: fd.get('feedback'),
      reviewNotes: fd.get('reviewNotes'),
      reviewedAt: U.serverTimestamp(),
      reviewedBy: profile.uid,
      tutorName: profile.name
    }, selected.id);
    if(assignment.id){
      await U.saveDoc('assignments', { lastReviewedAt: U.serverTimestamp(), lastSubmissionStatus: status }, assignment.id);
    }
    if(gradeValue !== '' && selected.studentUid){
      await U.saveDoc('assessments', {
        title: selected.assignmentTitle || assignment.title || 'Assignment review',
        subject: assignment.subject || 'General',
        score: gradeValue,
        feedback: fd.get('feedback'),
        studentUid: selected.studentUid,
        studentName: selected.studentName || studentById[selected.studentUid]?.name || '',
        tutorUid: profile.uid,
        tutorName: profile.name,
        assessmentDate: new Date().toISOString().slice(0,10),
        source: 'submission-review'
      }, `review_${selected.id}`);
    }
    alert('Review saved successfully.');
    location.href = `/tutor/review-submissions.html?submission=${selected.id}`;
  };
  document.getElementById('reviewForm').onsubmit = async (e)=>{ e.preventDefault(); await persistReview(); };
  document.getElementById('markReviewedBtn').onclick = async ()=>{ await persistReview('Reviewed'); };
}

async function activities(currentRole, profile){
  const content = el('page-content');
  if(currentRole === 'tutor'){
    const students = await getRegisteredStudents();
    const items = (await getAll('activityLogs')).filter(a => a.tutorUid === profile.uid).sort((a,b)=> (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    content.innerHTML = `
      <div class="card panel"><div class="toolbar"><h3>Daily activity, growth, and character tracker</h3><span class="badge success">Tutor comments are visible to parents and learners</span></div>
        <form id="activityForm" class="form-grid two">
          <div><label>Learner</label><select name="studentUid" required><option value="">Choose student</option>${renderSelectOptions(students,'uid',s=>`${s.name}${s.level?` (${s.level})`:''}`)}</select></div>
          <div><label>Date</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}" required></div>
          <div><label>Subject / area</label><input name="subject" placeholder="Math, Reading, Character, Wellbeing"></div>
          <div><label>Entry type</label><select name="type"><option>High</option><option>Low</option><option>Observation</option><option>Character Growth</option><option>Goal</option><option>Behaviour Note</option></select></div>
          <div><label>Area</label><select name="area"><option>Academic</option><option>Character</option><option>Wellbeing</option><option>Participation</option><option>Social</option></select></div>
          <div><label>Mood / energy</label><select name="mood"><option value="">Select</option><option>Excellent</option><option>Good</option><option>Neutral</option><option>Low</option><option>Struggling</option></select></div>
          <div style="grid-column:1/-1"><label>Comment</label><textarea class="textarea-xl" name="comment" required placeholder="What happened today? Record wins, struggles, discipline, confidence, collaboration, or growth."></textarea></div>
          <div style="grid-column:1/-1"><label>Next step / support plan</label><textarea name="actionStep" placeholder="How will the tutor or parent support the learner next?"></textarea></div>
          <div class="row" style="align-items:end"><button type="submit">Save daily note</button></div>
        </form>
      </div>
      <div style="margin-top:18px">${U.simpleTable(['Date','Learner','Subject / Area','Type','Mood','Comment'], items.map(a=>`<tr><td>${U.fmtDate(a.date)}</td><td>${esc(a.studentName||a.studentUid)}</td><td>${esc(a.subject || a.area || '—')}</td><td><span class="pill">${esc(a.type||'Observation')}</span></td><td>${esc(a.mood||'—')}</td><td>${esc(a.comment||'')}</td></tr>`).join(''))}</div>`;
    document.getElementById('activityForm').onsubmit = async (e)=>{
      e.preventDefault();
      const student = students.find(s=>s.uid===e.target.studentUid.value);
      await U.saveDoc('activityLogs', {
        studentUid: e.target.studentUid.value,
        studentName: student?.name || '',
        tutorUid: profile.uid,
        tutorName: profile.name,
        date: e.target.date.value,
        subject: e.target.subject.value,
        type: e.target.type.value,
        area: e.target.area.value,
        mood: e.target.mood.value,
        comment: e.target.comment.value,
        actionStep: e.target.actionStep.value,
        createdAt: U.serverTimestamp()
      });
      location.reload();
    };
    return;
  }
  const items = currentRole === 'student' ? await getStudentActivities(profile.uid) : await getParentActivities(profile.uid);
  content.innerHTML = `<div class="card panel"><div class="toolbar"><h3>${currentRole==='student'?'My growth and activity journal':'Growth and activity notes'}</h3></div>${U.simpleTable(['Date','Subject / Area','Type','Mood','Comment','Action step'], items.map(a=>`<tr><td>${U.fmtDate(a.date)}</td><td>${esc(a.subject || a.area || '—')}</td><td><span class="pill">${esc(a.type||'Observation')}</span></td><td>${esc(a.mood||'—')}</td><td>${esc(a.comment||'')}</td><td>${esc(a.actionStep||'—')}</td></tr>`).join(''))}</div>`;
}

async function messages(currentRole, profile){
  const peers = (await getAll('users')).filter(u => u.uid !== profile.uid);
  const items = (await getAll('messages')).filter(m => m.toUid === profile.uid || m.fromUid === profile.uid).sort((a,b)=> (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  el('page-content').innerHTML = `
    <div class="card panel"><div class="toolbar"><h3>New message</h3></div>
      <form id="messageForm" class="form-grid two">
        <div><label>To</label><select name="toUid" required><option value="">Choose recipient</option>${renderSelectOptions(peers,'uid',u=>`${u.name} • ${u.role}`)}</select></div>
        <div><label>Subject</label><input name="subject" required></div>
        <div style="grid-column:1/-1"><label>Message</label><textarea name="body"></textarea></div>
        <div class="row" style="align-items:end"><button type="submit">Send</button></div>
      </form></div>
    <div style="margin-top:18px" class="list">${items.map(m=>`<div class="list-item"><div><strong>${esc(m.subject)}</strong><div class="muted">${esc(m.body||'')}</div><small>${m.fromUid===profile.uid?'To':'From'} ${esc(m.fromName || m.fromUid===profile.uid ? (peers.find(p=>p.uid===m.toUid)?.name || m.toUid) : (peers.find(p=>p.uid===m.fromUid)?.name || m.fromUid))}</small></div></div>`).join('') || empty()}</div>`;
  el('messageForm').onsubmit = async (e) => {
    e.preventDefault();
    const to = peers.find(p=>p.uid===e.target.toUid.value);
    await U.saveDoc('messages', { toUid: e.target.toUid.value, toName: to?.name || '', fromUid: profile.uid, fromName: profile.name, subject: e.target.subject.value, body: e.target.body.value, createdAt: U.serverTimestamp() });
    location.reload();
  };
}

async function settings(currentRole, profile){
  el('page-content').innerHTML = `<div class="grid grid-2"><div class="card panel"><h3>Profile information</h3><div class="stack"><div class="kv"><strong>Name</strong><span>${esc(profile.name||'—')}</span></div><div class="kv"><strong>Email</strong><span>${esc(profile.email||'—')}</span></div><div class="kv"><strong>Role</strong><span>${esc(profile.role||'—')}</span></div><div class="kv"><strong>UID</strong><span><small>${esc(profile.uid||'—')}</small></span></div></div></div><div class="card panel"><h3>System notes</h3><div class="list"><div class="list-item">Authentication uses Firebase Authentication.</div><div class="list-item">Live data uses Cloud Firestore.</div><div class="list-item">Files use Firebase Storage.</div><div class="list-item">Tutors create classrooms, assign students, upload materials, grade work, and generate live report cards.</div></div></div></div>`;
}

async function unauthorized(){ document.body.innerHTML = `<div class="auth-wrap"><div class="card panel center" style="max-width:680px;padding:32px"><h1>Access not allowed</h1><p class="muted">Your account role does not match this page, or your user profile document is missing in Firestore.</p><a class="btn" href="/login.html">Back to login</a></div></div>`; }

(async()=>{
  if(document.body.dataset.authPage==='public') return;
  if(page==='unauthorized'){ unauthorized(); return; }
  const { profile } = await U.requireAuth();
  if(page==='dashboard') return dashboard(role, profile);
  if(page==='children') return children(profile);
  if(page==='learners') return tutorLearners(profile);
  if(page==='assignments') return assignments(role, profile);
  if(page==='assessments') return assessments(role, profile);
  if(page==='portfolio' || page==='portfolios') return portfolio(role, profile);
  if(page==='attendance') return attendance(role, profile);
  if(page==='reports' || page==='report-card' || page==='report-cards') return reports(role, profile);
  if(page==='resources') return resources(role, profile);
  if(page==='lesson-plans') return lessonPlans(profile);
  if(page==='classrooms') return classrooms(profile);
  if(page==='submit-work') return submitWork(profile);
  if(page==='review-submissions') return reviewSubmissions(profile);
  if(page==='activity-tracker' || page==='activities' || page==='growth') return activities(role, profile);
  if(page==='messages') return messages(role, profile);
  if(page==='settings') return settings(role, profile);
})();
