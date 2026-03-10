// assets/js/pages.js

const Utils = window.AppUtils;
const AuthAPI = window.AuthAPI;
const DataAPI = window.DataAPI;

if (!Utils || !AuthAPI || !DataAPI) {
  throw new Error("common.js, auth.js and data.js must load before pages.js");
}

function buildStudentCard(student) {
  return `
    <div class="card student-card" data-student-id="${Utils.escapeHtml(student.id)}">
      <div class="card-body">
        <h3>${Utils.escapeHtml(student.full_name || "Unnamed Student")}</h3>
        <p>${Utils.escapeHtml(student.email || "")}</p>
        <p>Role: ${Utils.escapeHtml(student.role || "student")}</p>
      </div>
    </div>
  `;
}

function buildAssignmentCard(item, mySubmission) {
  return `
    <div class="card assignment-card" data-assignment-id="${Utils.escapeHtml(item.id)}">
      <div class="card-body">
        <h3>${Utils.escapeHtml(item.title || "")}</h3>
        <p><strong>Subject:</strong> ${Utils.escapeHtml(item.subject || "")}</p>
        <p><strong>Due:</strong> ${Utils.escapeHtml(item.due_date || "-")}</p>
        <p>${Utils.escapeHtml(item.description || "")}</p>
        ${
          mySubmission
            ? `<p><strong>Status:</strong> Submitted</p>
               <p><strong>Feedback:</strong> ${Utils.escapeHtml(mySubmission.feedback || "-")}</p>
               <p><strong>Grade:</strong> ${Utils.escapeHtml(mySubmission.grade || "-")}</p>`
            : `<p><strong>Status:</strong> Not submitted</p>`
        }
      </div>
    </div>
  `;
}

function buildSubmissionCard(item) {
  return `
    <div class="card submission-card" data-submission-id="${Utils.escapeHtml(item.id)}">
      <div class="card-body">
        <h3>${Utils.escapeHtml(item.assignment_title || "Assignment Submission")}</h3>
        <p><strong>Student:</strong> ${Utils.escapeHtml(item.student_name || "")}</p>
        <p><strong>Subject:</strong> ${Utils.escapeHtml(item.subject || "")}</p>
        <p><strong>Comment:</strong> ${Utils.escapeHtml(item.comment || "-")}</p>
        <p><strong>Submitted:</strong> ${Utils.formatDateTime(item.submitted_at)}</p>
        <p><strong>Reviewed:</strong> ${item.reviewed ? "Yes" : "No"}</p>
        <p><strong>Grade:</strong> ${Utils.escapeHtml(item.grade || "-")}</p>
        <p><strong>Feedback:</strong> ${Utils.escapeHtml(item.feedback || "-")}</p>
        ${
          item.file_url
            ? `<p><a href="${item.file_url}" target="_blank" rel="noopener">Open File</a></p>`
            : ""
        }
      </div>
    </div>
  `;
}

async function guardLoggedIn() {
  const profile = await AuthAPI.getCurrentProfile();

  if (!profile) {
    window.location.href = "/login.html";
    return null;
  }

  return profile;
}

async function guardRole(expectedRole) {
  const profile = await guardLoggedIn();
  if (!profile) return null;

  if (profile.role !== expectedRole) {
    window.location.href = "/unauthorized.html";
    return null;
  }

  return profile;
}

async function loadTutorDashboard() {
  const profile = await guardRole("tutor");
  if (!profile) return;

  Utils.setText("[data-user-name]", profile.full_name || "Tutor");

  const students = await DataAPI.getAllStudents();
  const assignments = await DataAPI.getAssignments();
  const submissions = await DataAPI.getAllSubmissions();

  Utils.setText("[data-total-students]", String(students.length));
  Utils.setText("[data-total-assignments]", String(assignments.length));
  Utils.setText("[data-total-submissions]", String(submissions.length));

  const list = document.querySelector("#students-list, [data-students-list]");
  if (list) {
    list.innerHTML = students.length
      ? students.map(buildStudentCard).join("")
      : `<div class="card"><div class="card-body"><p>No students found.</p></div></div>`;
  }
}

async function loadTutorLearnersPage() {
  const profile = await guardRole("tutor");
  if (!profile) return;

  Utils.setText("[data-user-name]", profile.full_name || "Tutor");

  const students = await DataAPI.getAllStudents();
  const container = document.querySelector("#students-list, #learners-list, [data-students-list]");

  if (!container) return;

  container.innerHTML = students.length
    ? students.map(buildStudentCard).join("")
    : `<div class="card"><div class="card-body"><p>No student accounts found yet.</p></div></div>`;
}

async function loadTutorAssignmentsPage() {
  const profile = await guardRole("tutor");
  if (!profile) return;

  const form = document.querySelector("#assignment-form, [data-assignment-form]");
  const list = document.querySelector("#assignments-list, [data-assignments-list]");

  async function render() {
    const assignments = await DataAPI.getAssignments();

    if (list) {
      list.innerHTML = assignments.length
        ? assignments.map((item) => buildAssignmentCard(item, null)).join("")
        : `<div class="card"><div class="card-body"><p>No assignments yet.</p></div></div>`;
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const formData = new FormData(form);

        await DataAPI.createAssignment({
          title: formData.get("title"),
          description: formData.get("description"),
          subject: formData.get("subject"),
          due_date: formData.get("due_date")
        });

        form.reset();
        Utils.showMessage("Assignment created successfully", "success");
        await render();
      } catch (err) {
        Utils.showMessage(err.message || "Failed to create assignment", "danger");
      }
    });
  }

  await render();
}

async function loadTutorReviewSubmissionsPage() {
  const profile = await guardRole("tutor");
  if (!profile) return;

  const list = document.querySelector("#submissions-list, [data-submissions-list]");
  if (!list) return;

  const submissions = await DataAPI.getAllSubmissions();

  list.innerHTML = submissions.length
    ? submissions.map(buildSubmissionCard).join("")
    : `<div class="card"><div class="card-body"><p>No submissions yet.</p></div></div>`;

  list.addEventListener("click", async (e) => {
    const button = e.target.closest("[data-review-submission]");
    if (!button) return;

    const submissionId = button.getAttribute("data-review-submission");
    const gradeInput = document.querySelector(`[data-grade-input="${submissionId}"]`);
    const feedbackInput = document.querySelector(`[data-feedback-input="${submissionId}"]`);

    try {
      await DataAPI.reviewSubmission(submissionId, {
        grade: gradeInput ? gradeInput.value : "",
        feedback: feedbackInput ? feedbackInput.value : ""
      });

      Utils.showMessage("Submission reviewed successfully", "success");
      await loadTutorReviewSubmissionsPage();
    } catch (err) {
      Utils.showMessage(err.message || "Failed to review submission", "danger");
    }
  });
}

async function loadStudentDashboard() {
  const profile = await guardRole("student");
  if (!profile) return;

  Utils.setText("[data-user-name]", profile.full_name || "Student");

  const assignments = await DataAPI.getAssignments();
  const submissions = await DataAPI.getMySubmissions();

  Utils.setText("[data-total-assignments]", String(assignments.length));
  Utils.setText("[data-total-submissions]", String(submissions.length));

  const list = document.querySelector("#assignments-list, [data-assignments-list]");
  if (list) {
    const submissionMap = {};
    submissions.forEach((item) => {
      submissionMap[item.assignment_id] = item;
    });

    list.innerHTML = assignments.length
      ? assignments.map((item) => buildAssignmentCard(item, submissionMap[item.id])).join("")
      : `<div class="card"><div class="card-body"><p>No assignments available.</p></div></div>`;
  }
}

async function loadStudentAssignmentsPage() {
  const profile = await guardRole("student");
  if (!profile) return;

  const assignments = await DataAPI.getAssignments();
  const submissions = await DataAPI.getMySubmissions();
  const submissionMap = {};

  submissions.forEach((item) => {
    submissionMap[item.assignment_id] = item;
  });

  const list = document.querySelector("#assignments-list, [data-assignments-list]");
  if (!list) return;

  list.innerHTML = assignments.length
    ? assignments.map((item) => buildAssignmentCard(item, submissionMap[item.id])).join("")
    : `<div class="card"><div class="card-body"><p>No assignments available.</p></div></div>`;
}

async function loadStudentSubmitWorkPage() {
  const profile = await guardRole("student");
  if (!profile) return;

  const form = document.querySelector("#submission-form, [data-submission-form]");
  const assignmentSelect = document.querySelector('select[name="assignment_id"], [data-assignment-select]');

  if (assignmentSelect) {
    const assignments = await DataAPI.getAssignments();
    assignmentSelect.innerHTML = `
      <option value="">Select assignment</option>
      ${assignments.map((item) => `
        <option value="${Utils.escapeHtml(item.id)}">
          ${Utils.escapeHtml(item.title)} - ${Utils.escapeHtml(item.subject)}
        </option>
      `).join("")}
    `;
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData(form);
      const file = formData.get("file");

      await DataAPI.submitAssignment({
        assignment_id: formData.get("assignment_id"),
        comment: formData.get("comment"),
        file: file && file.size ? file : null
      });

      form.reset();
      Utils.showMessage("Assignment submitted successfully", "success");
    } catch (err) {
      Utils.showMessage(err.message || "Submission failed", "danger");
    }
  });
}

async function loadParentDashboard() {
  const profile = await guardRole("parent");
  if (!profile) return;

  Utils.setText("[data-user-name]", profile.full_name || "Parent");

  const children = await DataAPI.getParentChildren(profile.id);
  Utils.setText("[data-total-children]", String(children.length));

  const list = document.querySelector("#children-list, [data-children-list]");
  if (list) {
    list.innerHTML = children.length
      ? children.map(buildStudentCard).join("")
      : `<div class="card"><div class="card-body"><p>No linked children found.</p></div></div>`;
  }
}

window.PageController = {
  async init() {
    const path = Utils.getPath();

    if (
      path.endsWith("/login.html") ||
      path.endsWith("/register.html") ||
      path.endsWith("/index.html") ||
      path === "/"
    ) {
      return;
    }

    if (path.includes("/tutor/dashboard.html")) return await loadTutorDashboard();
    if (path.includes("/tutor/learners.html")) return await loadTutorLearnersPage();
    if (path.includes("/tutor/assignments.html")) return await loadTutorAssignmentsPage();
    if (path.includes("/tutor/review-submissions.html")) return await loadTutorReviewSubmissionsPage();

    if (path.includes("/student/dashboard.html")) return await loadStudentDashboard();
    if (path.includes("/student/assignments.html")) return await loadStudentAssignmentsPage();
    if (path.includes("/student/submit-work.html")) return await loadStudentSubmitWorkPage();

    if (path.includes("/parent/dashboard.html")) return await loadParentDashboard();

    await guardLoggedIn();
  }
};