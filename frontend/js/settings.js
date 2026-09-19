// settings.js - update name, change password, choose theme, log out.
(async function () {
  const user = await requireAuth();
  if (!user) return;
  buildShell(user, 'settings');

  /* ----- Profile ----- */
  const profileForm = el('profileForm');
  profileForm.elements.name.value = user.name;
  profileForm.elements.email.value = user.email;
  el('memberSince').textContent = 'Member since ' + new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = el('profileError');
    errorBox.hidden = true;
    const name = profileForm.elements.name.value.trim();
    if (!name) { errorBox.textContent = 'Please enter your name.'; errorBox.hidden = false; return; }
    try {
      const data = await api('/auth/profile', { method: 'PUT', body: { name } });
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      document.querySelectorAll('.user-name').forEach((n) => (n.textContent = data.user.name));
      document.querySelectorAll('.avatar').forEach((n) => (n.textContent = data.user.name.charAt(0).toUpperCase()));
      toast('Profile updated.', 'success');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    }
  });

  /* ----- Password ----- */
  const passwordForm = el('passwordForm');
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = el('passwordError');
    errorBox.hidden = true;
    const f = passwordForm.elements;
    const fail = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };

    if (!f.currentPassword.value || !f.newPassword.value) return fail('Please fill in all password fields.');
    if (f.newPassword.value.length < 8) return fail('Your new password must be at least 8 characters long.');
    if (f.newPassword.value !== f.confirmPassword.value) return fail('The new passwords do not match.');

    try {
      await api('/auth/password', { method: 'PUT', body: { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value } });
      passwordForm.reset();
      toast('Password updated.', 'success');
    } catch (err) {
      fail(err.message);
    }
  });

  /* ----- Theme ----- */
  function syncThemeButtons() {
    document.querySelectorAll('[data-set-theme]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.setTheme === getTheme()));
  }
  document.querySelectorAll('[data-set-theme]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.setTheme)));
  window.addEventListener('themechange', syncThemeButtons);
  syncThemeButtons();
})();
