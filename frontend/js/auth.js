(function () {
  if (localStorage.getItem(TOKEN_KEY)) {
    location.replace('dashboard.html');
    return;
  }

  bindThemeToggles();

  const form = el('authForm');
  const isRegister = form.dataset.mode === 'register';
  const errorBox = el('formError');
  const submitBtn = el('submitBtn');
  const idleLabel = submitBtn.textContent;

  if (
    new URLSearchParams(location.search).get('expired') === '1' &&
    el('formInfo')
  ) {
    el('formInfo').textContent =
      'Your session expired. Please log in again.';
    el('formInfo').hidden = false;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    errorBox.hidden = true;

    const body = {
      email: form.elements.email.value.trim(),
      password: form.elements.password.value
    };

    if (isRegister) {
      body.name = form.elements.name.value.trim();
    }

    if (isRegister && !body.name) {
      return showError('Please enter your name.');
    }

    if (!body.email) {
      return showError('Please enter your email address.');
    }

    if (!body.password) {
      return showError('Please enter your password.');
    }

    if (isRegister && body.password.length < 8) {
      return showError(
        'Your password must be at least 8 characters long.'
      );
    }

    submitBtn.disabled = true;
    submitBtn.textContent = isRegister
      ? 'Creating account...'
      : 'Logging in...';

    try {
      const data = await api(
        isRegister ? '/auth/register' : '/auth/login',
        {
          method: 'POST',
          body: body,
          noRedirect: true
        }
      );

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      window.location.href = 'dashboard.html';

    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = idleLabel;
    }
  });
})();