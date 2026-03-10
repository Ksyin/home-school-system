// assets/js/pages.js

const DataAPI = window.DataAPI;

function buildStudentCard(student) {

  return `
  <div class="card">
      <div class="card-body">
        <h3>${student.full_name}</h3>
        <p>${student.email}</p>
      </div>
  </div>`;
}

function buildAssignmentCard(item) {

  return `
  <div class="card">
      <div class="card-body">
        <h3>${item.title}</h3>
        <p>${item.subject}</p>
        <p>${item.description}</p>
      </div>
  </div>`;
}


async function loadTutorDashboard() {

  const students = await DataAPI.getAllStudents();

  const container = document.getElementById("students-list");

  if (!container) return;

  container.innerHTML = students.map(buildStudentCard).join("");
}


async function loadTutorAssignments() {

  const assignments = await DataAPI.getAssignments();

  const container = document.getElementById("assignments-list");

  if (!container) return;

  container.innerHTML = assignments.map(buildAssignmentCard).join("");
}


async function loadStudentAssignments() {

  const assignments = await DataAPI.getAssignments();

  const container = document.getElementById("assignments-list");

  if (!container) return;

  container.innerHTML = assignments.map(buildAssignmentCard).join("");
}


async function loadStudentSubmitPage() {

  const assignments = await DataAPI.getAssignments();

  const select = document.querySelector("select[name='assignment_id']");

  if (!select) return;

  select.innerHTML = assignments.map(a =>
    `<option value="${a.id}">${a.title}</option>`
  ).join("");

}


window.PageController = {

  async init() {

    const path = location.pathname;

    if (path.includes("/tutor/dashboard")) {
      await loadTutorDashboard();
    }

    if (path.includes("/tutor/assignments")) {
      await loadTutorAssignments();
    }

    if (path.includes("/student/assignments")) {
      await loadStudentAssignments();
    }

    if (path.includes("/student/submit-work")) {
      await loadStudentSubmitPage();
    }

  }

};