// Shared admin layout and API helper. Load this on every protected admin page.
// Pages use AdminApi.get / post / put / patch / del. A 401 response sends the user to login.

(function () {
  const NAV = [
    { href: '/admin/index.html', label: 'Dashboard' },
    { href: '/admin/products.html', label: 'Products' },
    { href: '/admin/orders.html', label: 'Orders' },
    { href: '/admin/capi-logs.html', label: 'CAPI Log' },
    { href: '/admin/settings.html', label: 'Settings' }
  ];

  async function request(method, url, body) {
    const options = { method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      throw new Error('Not logged in');
    }

    let data = {};
    try { data = await res.json(); } catch (err) { /* empty response */ }

    if (!res.ok || data.ok === false) {
      const error = new Error(data.message || 'Request failed');
      error.data = data;
      error.status = res.status;
      throw error;
    }
    return data;
  }

  window.AdminApi = {
    get: url => request('GET', url),
    post: (url, body = {}) => request('POST', url, body),
    put: (url, body = {}) => request('PUT', url, body),
    patch: (url, body = {}) => request('PATCH', url, body),
    del: url => request('DELETE', url)
  };

  function buildSidebar() {
    const current = window.location.pathname;
    const sidebar = document.getElementById('admin-sidebar');
    if (!sidebar) return;

    const nav = document.createElement('nav');
    nav.className = 'admin-nav';

    NAV.forEach(item => {
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.label;
      if (current === item.href) link.classList.add('active');
      nav.append(link);
    });

    const user = document.createElement('div');
    user.className = 'admin-user';
    user.innerHTML = '<p id="admin-email">Loading...</p>';

    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'btn';
    logout.textContent = 'Log out';
    logout.addEventListener('click', async () => {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
      window.location.href = '/admin/login.html';
    });
    user.append(logout);

    const brand = Object.assign(document.createElement('a'), {
      className: 'admin-brand',
      textContent: 'Picaso Admin',
      href: '/',
      title: 'Go to store home page'
    });

    sidebar.replaceChildren(brand, nav, user);
  }

  async function loadCurrentAdmin() {
    try {
      const data = await AdminApi.get('/api/admin/me');
      const email = document.getElementById('admin-email');
      if (email) email.textContent = data.email;
    } catch (err) {
      // 401 is handled by request(). Other errors are shown on the page itself.
    }
  }

  buildSidebar();
  loadCurrentAdmin();
})();