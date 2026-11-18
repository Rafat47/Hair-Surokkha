// Admin login form. On success, the server sets the session cookie and we go to the dashboard.

(function () {
  const form = document.getElementById('login-form');
  const message = document.getElementById('login-message');
  const button = document.getElementById('login-button');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    message.textContent = '';
    message.classList.remove('success');

    if (!email || !password) {
      message.textContent = 'Enter your email and password';
      return;
    }

    button.disabled = true;
    button.textContent = 'Logging in...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!data.ok) {
        message.textContent = data.message || 'Could not log in';
        return;
      }

      window.location.href = '/admin/index.html';
    } catch (err) {
      message.textContent = 'Network error. Please try again.';
    } finally {
      button.disabled = false;
      button.textContent = 'Log in';
    }
  });
})();