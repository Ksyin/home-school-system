window.UI = {
  toast(message, type='info') {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      wrap.style.cssText = 'position:fixed;right:18px;bottom:18px;display:grid;gap:10px;z-index:9999;max-width:320px';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    const bg = type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#e0ecff';
    const color = type === 'error' ? '#991b1b' : type === 'success' ? '#166534' : '#1d4ed8';
    el.style.cssText = `padding:12px 14px;border-radius:14px;background:${bg};color:${color};box-shadow:0 10px 20px rgba(0,0,0,.08);font-weight:600;border:1px solid rgba(0,0,0,.06)`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  },
  setLoading(btn, isLoading, text='Working...') {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = text;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
  },
  toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('open');
  },
  initials(name='User') {
    return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
  }
};
