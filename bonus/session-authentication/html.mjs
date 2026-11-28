const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export function escapeHtml (value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

function layout (title, body) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body>${body}</body>
</html>`
}

export function loginPage ({ csrfToken, error }) {
  return layout('Login', `
<h1>Login</h1>
${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}
<form action="/login" method="post">
  <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
  <label>Email <input type="email" name="email" autocomplete="username" required></label>
  <label>Password <input type="password" name="password" autocomplete="current-password" required></label>
  <button type="submit">Login</button>
</form>`)
}

export function homePage ({ user, csrfToken }) {
  if (!user) {
    return layout('Home', '<p>Please <a href="/login">login</a></p>')
  }

  return layout('Home', `
<p>Hello ${escapeHtml(user.email)}! Go to your <a href="/profile">profile</a></p>
<form action="/logout" method="post">
  <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
  <button type="submit">Logout</button>
</form>`)
}

export function profilePage ({ user }) {
  return layout('Profile', `<h1>Profile</h1><p>Email: ${escapeHtml(user.email)}</p>`)
}
