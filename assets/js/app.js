// app.js (Fixed core utilities)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, getDocs, query, where, serverTimestamp, updateDoc, orderBy, limit, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Navigation configuration
const NAV_MAP = {
  parent: [
    ['Dashboard', '/parent/dashboard.html', '🏠'],
    ['Children', '/parent/children.html', '👧'],
    ['Assignments', '/parent/assignments.html', '📝'],
    ['Assessments', '/parent/assessments.html', '📊'],
    ['Portfolio', '/parent/portfolio.html', '🗂️'],
    ['Attendance', '/parent/attendance.html', '📅'],
    ['Reports', '/parent/reports.html', '📄'],
    ['Resources', '/parent/resources.html', '📚'],
    ['Messages', '/parent/messages.html', '💬'],
    ['Settings', '/parent/settings.html', '⚙️']
  ],
  tutor: [
    ['Dashboard', '/tutor/dashboard.html', '🏠'],
    ['Learners', '/tutor/learners.html', '👦'],
    ['Classrooms', '/tutor/classrooms.html', '🏫'],
    ['Assignments', '/tutor/assignments.html', '📝'],
    ['Assessments', '/tutor/assessments.html', '📊'],
    ['Portfolios', '/tutor/portfolios.html', '🗂️'],
    ['Attendance', '/tutor/attendance.html', '📅'],
    ['Report Cards', '/tutor/reports.html', '📄'],
    ['Lesson Plans', '/tutor/lesson-plans.html', '🗓️'],
    ['Resources', '/tutor/resources.html', '📚'],
    ['Messages', '/tutor/messages.html', '💬'],
    ['Settings', '/tutor/settings.html', '⚙️']
  ],
  student: [
    ['Dashboard', '/student/dashboard.html', '🏠'],
    ['Assignments', '/student/assignments.html', '📝'],
    ['Submit Work', '/student/submit-work.html', '📤'],
    ['Assessments', '/student/assessments.html', '📊'],
    ['Portfolio', '/student/portfolio.html', '🗂️'],
    ['Attendance', '/student/attendance.html', '📅'],
    ['Reports', '/student/reports.html', '📄'],
    ['Resources', '/student/resources.html', '📚'],
    ['Messages', '/student/messages.html', '💬'],
    ['Settings', '/student/settings.html', '⚙️']
  ]
};

// Utility functions
const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDate = (value) => {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  if (value?.toDate) return value.toDate().toLocaleDateString();
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '—';
  }
};

const statusBadge = (status = 'Pending') => {
  const map = {
    'completed': 'success', 'submitted': 'success', 'pending': 'warn',
    'late': 'danger', 'published': 'success', 'present': 'success',
    'absent': 'danger', 'graded': 'info'
  };
  return `<span class="badge ${map[status?.toLowerCase()] || ''}">${escapeHtml(status)}</span>`;
};

// Core functions
async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: uid, ...snap.data() } : null;
}

async function requireAuth(expectedRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = '/login.html';
        return;
      }

      const profile = await getUserProfile(user.uid);
      if (!profile) {
        window.location.href = '/unauthorized.html';
        return;
      }

      const pageRole = document.body.dataset.role;
      if (expectedRole || pageRole) {
        const roleToCheck = expectedRole || pageRole;
        if (profile.role !== roleToCheck) {
          window.location.href = '/unauthorized.html';
          return;
        }
      }

      resolve({ user, profile });
    });
  });
}

async function uploadFile(file, folder = 'uploads') {
  if (!file) return { url: '', path: '', name: '' };
  
  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const filePath = `${folder}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, filePath);
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  return { url, path: filePath, name: file.name };
}

// Data access functions
const DataAPI = {
  async getStudents() {
    const q = query(collection(db, 'users'), where('role', '==', 'student'), orderBy('full_name'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getTutorStudents(tutorId) {
    const classrooms = await this.getTutorClassrooms(tutorId);
    if (!classrooms.length) return [];
    
    const studentIds = new Set();
    for (const classroom of classrooms) {
      const membersSnap = await getDocs(
        query(collection(db, 'classroom_members'), where('classroomId', '==', classroom.id))
      );
      membersSnap.forEach(doc => studentIds.add(doc.data().studentId));
    }
    
    const students = [];
    for (const studentId of studentIds) {
      const student = await getUserProfile(studentId);
      if (student) students.push(student);
    }
    return students;
  },

  async getTutorClassrooms(tutorId) {
    const q = query(collection(db, 'classrooms'), where('tutorId', '==', tutorId), orderBy('title'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getParentChildren(parentId) {
    const q = query(collection(db, 'parent_links'), where('parentId', '==', parentId));
    const snap = await getDocs(q);
    
    const children = [];
    for (const link of snap.docs) {
      const studentId = link.data().studentId;
      const student = await getUserProfile(studentId);
      if (student) children.push(student);
    }
    return children;
  },

  async getAssignmentsForStudent(studentId) {
    const q = query(
      collection(db, 'assignments'),
      where('studentIds', 'array-contains', studentId),
      orderBy('dueDate', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getSubmissionsForStudent(studentId) {
    const q = query(
      collection(db, 'submissions'),
      where('studentId', '==', studentId),
      orderBy('submittedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async createAssignment(data) {
    return await addDoc(collection(db, 'assignments'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  async submitAssignment(submissionData, assignmentId, studentId) {
    const batch = writeBatch(db);
    
    // Main submission record
    const submissionRef = doc(collection(db, 'submissions'));
    batch.set(submissionRef, {
      ...submissionData,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Student's submission reference
    batch.set(
      doc(db, 'students', studentId, 'submissions', submissionRef.id),
      { id: submissionRef.id, ...submissionData, submittedAt: serverTimestamp() }
    );
    
    // Assignment's submission reference
    batch.set(
      doc(db, 'assignments', assignmentId, 'submissions', studentId),
      { submissionId: submissionRef.id, ...submissionData, submittedAt: serverTimestamp() }
    );
    
    await batch.commit();
    return submissionRef.id;
  }
};

// UI Components
const UI = {
  renderShell(role, activePage, title, subtitle) {
    const items = NAV_MAP[role] || [];
    const nav = items.map(([label, href, icon]) => `
      <a class="nav-link ${activePage === label ? 'active' : ''}" href="${href}">
        <span class="icon">${icon}</span>
        <span>${escapeHtml(label)}</span>
      </a>
    `).join('');

    document.getElementById('app-shell').innerHTML = `
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-badge">H</div>
          <div><h1>HomeSchool</h1><p>Management System</p></div>
        </div>
        <div class="nav-section">
          <div class="nav-title">${escapeHtml(role)} portal</div>
          <nav class="nav">${nav}</nav>
        </div>
        <div class="sidebar-footer" id="sidebarFooter"></div>
      </aside>
      <main class="content">
        <div class="topbar">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <div class="top-actions" id="topActions"></div>
        </div>
        <div id="pageContent"></div>
        <footer class="page-foot">Powered by Firebase</footer>
      </main>
    `;
  },

  updateUserInfo(profile, user) {
    const footer = document.getElementById('sidebarFooter');
    if (footer) {
      footer.innerHTML = `
        <div>${escapeHtml(profile.full_name || profile.name || 'User')}</div>
        <small>${escapeHtml(user.email)}</small>
        <small>Role: ${escapeHtml(profile.role)}</small>
        <button class="btn small secondary" id="logoutBtn" style="margin-top:10px">Logout</button>
      `;
    }
    
    const actions = document.getElementById('topActions');
    if (actions) {
      actions.innerHTML = `
        <span class="badge">${escapeHtml(profile.role)}</span>
        <span class="badge success">${escapeHtml(profile.full_name || profile.email)}</span>
      `;
    }
    
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await signOut(auth);
      window.location.href = '/login.html';
    });
  },

  renderTable(headers, rows) {
    return `
      <div class="card table-wrap">
        <table>
          <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.length ? rows.map(r => `
              <tr>${r.map(c => `<td>${c ?? '-'}</td>`).join('')}</tr>
            `).join('') : `
              <tr><td colspan="${headers.length}" class="empty">No records yet</td></tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  },

  renderForm(config) {
    return `
      <form class="card" id="${config.id}">
        <h3>${escapeHtml(config.title)}</h3>
        ${config.fields.map(f => `
          <div class="field">
            <label>${escapeHtml(f.label)}</label>
            ${f.type === 'textarea' 
              ? `<textarea name="${f.name}" ${f.required ? 'required' : ''}>${f.value || ''}</textarea>`
              : f.type === 'select'
              ? `<select name="${f.name}" ${f.required ? 'required' : ''}>${f.options || ''}</select>`
              : `<input type="${f.type || 'text'}" name="${f.name}" value="${f.value || ''}" ${f.required ? 'required' : ''}>`
            }
          </div>
        `).join('')}
        <button type="submit" class="btn">${escapeHtml(config.submitText || 'Save')}</button>
        <span class="form-message" id="${config.id}Msg"></span>
      </form>
    `;
  }
};

// Page renderers
const PageRenderers = {
  async dashboard(role, profile, user) {
    let stats = {};
    
    if (role === 'student') {
      const assignments = await DataAPI.getAssignmentsForStudent(user.uid);
      const submissions = await DataAPI.getSubmissionsForStudent(user.uid);
      
      stats = {
        pendingAssignments: assignments.filter(a => !submissions.some(s => s.assignmentId === a.id)).length,
        completedAssignments: submissions.length,
        recentAssignments: assignments.slice(0, 5)
      };
    } else if (role === 'tutor') {
      const students = await DataAPI.getTutorStudents(user.uid);
      stats = { studentCount: students.length };
    } else if (role === 'parent') {
      const children = await DataAPI.getParentChildren(user.uid);
      stats = { childCount: children.length };
    }
    
    document.getElementById('pageContent').innerHTML = `
      <section class="card hero">
        <h3>Welcome back, ${escapeHtml(profile.full_name?.split(' ')[0] || 'User')}!</h3>
        <p>Your ${role} dashboard is ready.</p>
      </section>
      
      <div class="kpis">
        ${role === 'student' ? `
          <div class="card stat-card"><span class="label">Pending</span><span class="value">${stats.pendingAssignments}</span></div>
          <div class="card stat-card"><span class="label">Completed</span><span class="value">${stats.completedAssignments}</span></div>
        ` : role === 'tutor' ? `
          <div class="card stat-card"><span class="label">Students</span><span class="value">${stats.studentCount}</span></div>
        ` : role === 'parent' ? `
          <div class="card stat-card"><span class="label">Children</span><span class="value">${stats.childCount}</span></div>
        ` : ''}
      </div>
    `;
  },

  async assignments(role, profile, user) {
    if (role === 'student') {
      const assignments = await DataAPI.getAssignmentsForStudent(user.uid);
      const submissions = await DataAPI.getSubmissionsForStudent(user.uid);
      
      const rows = assignments.map(a => {
        const submitted = submissions.find(s => s.assignmentId === a.id);
        return [
          escapeHtml(a.title),
          formatDate(a.dueDate),
          escapeHtml(a.subject || 'General'),
          statusBadge(submitted ? 'submitted' : 'pending'),
          submitted ? formatDate(submitted.submittedAt) : '—'
        ];
      });
      
      document.getElementById('pageContent').innerHTML = UI.renderTable(
        ['Title', 'Due Date', 'Subject', 'Status', 'Submitted'],
        rows
      );
    } else if (role === 'tutor') {
      const form = UI.renderForm({
        id: 'createAssignmentForm',
        title: 'Create Assignment',
        submitText: 'Create Assignment',
        fields: [
          { label: 'Title', name: 'title', type: 'text', required: true },
          { label: 'Subject', name: 'subject', type: 'text' },
          { label: 'Due Date', name: 'dueDate', type: 'date' },
          { label: 'Description', name: 'description', type: 'textarea' },
          { label: 'Student IDs (comma-separated)', name: 'studentIds', type: 'text' }
        ]
      });
      
      const assignments = await getDocs(query(collection(db, 'assignments'), where('tutorId', '==', user.uid)));
      const rows = assignments.docs.map(d => {
        const data = d.data();
        return [
          escapeHtml(data.title),
          escapeHtml(data.subject || 'General'),
          formatDate(data.dueDate),
          (data.studentIds?.length || 0) + ' students'
        ];
      });
      
      document.getElementById('pageContent').innerHTML = `
        ${form}
        <h3 style="margin-top:30px">Existing Assignments</h3>
        ${UI.renderTable(['Title', 'Subject', 'Due Date', 'Assigned To'], rows)}
      `;
      
      document.getElementById('createAssignmentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        
        try {
          const formData = new FormData(e.target);
          const studentIds = formData.get('studentIds')
            .split(',')
            .map(id => id.trim())
            .filter(id => id);
          
          await DataAPI.createAssignment({
            title: formData.get('title'),
            subject: formData.get('subject'),
            dueDate: formData.get('dueDate') || null,
            description: formData.get('description'),
            studentIds,
            tutorId: user.uid,
            status: 'pending'
          });
          
          window.location.reload();
        } catch (error) {
          document.getElementById('createAssignmentFormMsg').textContent = error.message;
        } finally {
          btn.disabled = false;
        }
      });
    }
  },

  async submitWork(role, profile, user) {
    if (role !== 'student') return;
    
    const assignments = await DataAPI.getAssignmentsForStudent(user.uid);
    const submissions = await DataAPI.getSubmissionsForStudent(user.uid);
    const submittedIds = new Set(submissions.map(s => s.assignmentId));
    const pendingAssignments = assignments.filter(a => !submittedIds.has(a.id));
    
    const options = pendingAssignments.map(a => 
      `<option value="${a.id}">${escapeHtml(a.title)}</option>`
    ).join('');
    
    const form = UI.renderForm({
      id: 'submitWorkForm',
      title: 'Submit Assignment',
      submitText: 'Submit Work',
      fields: [
        { 
          label: 'Assignment', 
          name: 'assignmentId', 
          type: 'select', 
          required: true,
          options: `<option value="">Select assignment</option>${options}`
        },
        { label: 'Notes', name: 'notes', type: 'textarea' },
        { label: 'Attachment', name: 'file', type: 'file' }
      ]
    });
    
    const submissionRows = submissions.map(s => [
      escapeHtml(s.assignmentTitle || 'Assignment'),
      statusBadge(s.status),
      formatDate(s.submittedAt),
      s.fileUrl ? `<a href="${s.fileUrl}" target="_blank">View</a>` : '—'
    ]);
    
    document.getElementById('pageContent').innerHTML = `
      ${pendingAssignments.length ? form : ''}
      <h3 style="margin-top:30px">Previous Submissions</h3>
      ${UI.renderTable(['Assignment', 'Status', 'Submitted', 'File'], submissionRows)}
    `;
    
    document.getElementById('submitWorkForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      
      try {
        const formData = new FormData(e.target);
        const assignmentId = formData.get('assignmentId');
        const assignment = assignments.find(a => a.id === assignmentId);
        
        const file = formData.get('file');
        const upload = file?.size ? await uploadFile(file, `submissions/${user.uid}`) : { url: '' };
        
        await DataAPI.submitAssignment({
          assignmentId,
          assignmentTitle: assignment.title,
          studentId: user.uid,
          studentName: profile.full_name,
          notes: formData.get('notes'),
          fileUrl: upload.url,
          status: 'submitted'
        }, assignmentId, user.uid);
        
        window.location.reload();
      } catch (error) {
        document.getElementById('submitWorkFormMsg').textContent = error.message;
      } finally {
        btn.disabled = false;
      }
    });
  },

  async learners(role, profile, user) {
    if (role !== 'tutor') return;
    
    const students = await DataAPI.getStudents();
    const classrooms = await DataAPI.getTutorClassrooms(user.uid);
    
    const classroomOptions = classrooms.map(c => 
      `<option value="${c.id}">${escapeHtml(c.title)}</option>`
    ).join('');
    
    const studentOptions = students.map(s => 
      `<option value="${s.id}">${escapeHtml(s.full_name)}</option>`
    ).join('');
    
    const form = `
      <form class="card" id="linkStudentForm">
        <h3>Link Student to Classroom</h3>
        <div class="field">
          <label>Student</label>
          <select name="studentId" required>
            <option value="">Select student</option>
            ${studentOptions}
          </select>
        </div>
        <div class="field">
          <label>Classroom</label>
          <select name="classroomId" required>
            <option value="">Select classroom</option>
            ${classroomOptions}
          </select>
        </div>
        <button type="submit" class="btn">Link Student</button>
        <span id="linkStudentFormMsg"></span>
      </form>
      
      <form class="card" id="createClassroomForm">
        <h3>Create Classroom</h3>
        <div class="field">
          <label>Title</label>
          <input name="title" type="text" required>
        </div>
        <div class="field">
          <label>Description</label>
          <textarea name="description"></textarea>
        </div>
        <button type="submit" class="btn">Create Classroom</button>
        <span id="createClassroomFormMsg"></span>
      </form>
    `;
    
    const members = [];
    for (const classroom of classrooms) {
      const membersSnap = await getDocs(
        query(collection(db, 'classroom_members'), where('classroomId', '==', classroom.id))
      );
      
      for (const member of membersSnap.docs) {
        const student = await getUserProfile(member.data().studentId);
        if (student) {
          members.push([escapeHtml(student.full_name), escapeHtml(classroom.title), formatDate(member.data().createdAt)]);
        }
      }
    }
    
    document.getElementById('pageContent').innerHTML = `
      ${form}
      <h3 style="margin-top:30px">Current Links</h3>
      ${UI.renderTable(['Student', 'Classroom', 'Linked Since'], members)}
    `;
    
    document.getElementById('linkStudentForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      
      try {
        const formData = new FormData(e.target);
        await addDoc(collection(db, 'classroom_members'), {
          studentId: formData.get('studentId'),
          classroomId: formData.get('classroomId'),
          tutorId: user.uid,
          createdAt: serverTimestamp()
        });
        window.location.reload();
      } catch (error) {
        document.getElementById('linkStudentFormMsg').textContent = error.message;
      } finally {
        btn.disabled = false;
      }
    });
    
    document.getElementById('createClassroomForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      
      try {
        const formData = new FormData(e.target);
        await addDoc(collection(db, 'classrooms'), {
          title: formData.get('title'),
          description: formData.get('description'),
          tutorId: user.uid,
          createdAt: serverTimestamp()
        });
        window.location.reload();
      } catch (error) {
        document.getElementById('createClassroomFormMsg').textContent = error.message;
      } finally {
        btn.disabled = false;
      }
    });
  },

  async children(role, profile, user) {
    if (role !== 'parent') return;
    
    const students = await DataAPI.getStudents();
    const children = await DataAPI.getParentChildren(user.uid);
    const childIds = new Set(children.map(c => c.id));
    
    const availableStudents = students.filter(s => !childIds.has(s.id));
    
    const options = availableStudents.map(s => 
      `<option value="${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.email)})</option>`
    ).join('');
    
    const form = options ? `
      <form class="card" id="linkChildForm">
        <h3>Link Child Account</h3>
        <div class="field">
          <label>Select Student</label>
          <select name="studentId" required>
            <option value="">Choose a student</option>
            ${options}
          </select>
        </div>
        <button type="submit" class="btn">Link Child</button>
        <span id="linkChildFormMsg"></span>
      </form>
    ` : '<div class="card note">All students are already linked to you.</div>';
    
    const childRows = children.map(c => [
      escapeHtml(c.full_name),
      escapeHtml(c.email),
      c.grade_level || '—'
    ]);
    
    document.getElementById('pageContent').innerHTML = `
      ${form}
      <h3 style="margin-top:30px">Your Children</h3>
      ${UI.renderTable(['Name', 'Email', 'Grade Level'], childRows)}
    `;
    
    document.getElementById('linkChildForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      
      try {
        const formData = new FormData(e.target);
        await addDoc(collection(db, 'parent_links'), {
          parentId: user.uid,
          studentId: formData.get('studentId'),
          createdAt: serverTimestamp()
        });
        window.location.reload();
      } catch (error) {
        document.getElementById('linkChildFormMsg').textContent = error.message;
      } finally {
        btn.disabled = false;
      }
    });
  }
};

// Initialize page
(async function initPage() {
  try {
    const role = document.body.dataset.role;
    const page = document.body.dataset.page;
    const title = document.body.dataset.title || 'HomeSchool';
    const subtitle = document.body.dataset.description || '';
    
    const { user, profile } = await requireAuth(role);
    
    UI.renderShell(role, title, title, subtitle);
    UI.updateUserInfo(profile, user);
    
    const renderer = {
      'dashboard': () => PageRenderers.dashboard(role, profile, user),
      'assignments': () => PageRenderers.assignments(role, profile, user),
      'submit-work': () => PageRenderers.submitWork(role, profile, user),
      'learners': () => PageRenderers.learners(role, profile, user),
      'children': () => PageRenderers.children(role, profile, user)
    }[page] || (() => {
      document.getElementById('pageContent').innerHTML = `
        <section class="card">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(subtitle)}</p>
        </section>
      `;
    });
    
    await renderer();
  } catch (error) {
    console.error('Init error:', error);
    document.body.innerHTML = `
      <div class="center" style="padding:40px">
        <h2>Error</h2>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
})();

// Expose for debugging
window.AppUtil = { auth, db, storage, requireAuth, getUserProfile, uploadFile, DataAPI };