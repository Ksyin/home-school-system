// assets/js/common.js

window.AppUtils = {
  qs(selector, root = document) {
    return root.querySelector(selector);
  },

  qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  },

  getPath() {
    return window.location.pathname.toLowerCase();
  },

  isTutorPage() {
    return this.getPath().includes("/tutor/");
  },

  isStudentPage() {
    return this.getPath().includes("/student/");
  },

  isParentPage() {
    return this.getPath().includes("/parent/");
  },

  pageName() {
    const path = this.getPath();
    const name = path.split("/").pop() || "";
    return name.toLowerCase();
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  formatDate(value) {
    if (!value) return "-";

    if (typeof value === "string") {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString();
      }
    }

    if (value && typeof value === "object" && value.seconds) {
      const d = new Date(value.seconds * 1000);
      return d.toLocaleDateString();
    }

    return "-";
  },

  formatDateTime(value) {
    if (!value) return "-";

    if (typeof value === "string") {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString();
      }
    }

    if (value && typeof value === "object" && value.seconds) {
      const d = new Date(value.seconds * 1000);
      return d.toLocaleString();
    }

    return "-";
  },

  setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value ?? "";
  },

  setHTML(selector, html) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = html;
  },

  showMessage(message, type = "info") {
    const box = document.querySelector("[data-alert-box]");
    if (!box) {
      alert(message);
      return;
    }

    box.innerHTML = `<div class="alert alert-${type}">${this.escapeHtml(message)}</div>`;
  },

  getQueryParam(key) {
    const url = new URL(window.location.href);
    return url.searchParams.get(key);
  }
};