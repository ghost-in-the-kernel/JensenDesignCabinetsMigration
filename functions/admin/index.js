export function onRequestGet() {
  return new Response(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Website admin | Jensen Design</title>
<link rel="icon" href="/img/logo-square.png">
<link rel="stylesheet" href="/admin.css">
</head>
<body>
<header class="bar">
  <a class="bar__home" href="/admin">Jensen Design &middot; Website admin</a>
  <nav>
    <a href="/admin#galleries">Galleries</a>
    <a href="/admin#messages">Messages</a>
    <a href="/admin#settings">Settings</a>
    <a href="/" target="_blank">View the site</a>
    <a href="/cdn-cgi/access/logout">Sign out</a>
  </nav>
</header>
<main id="app"><p>Loading&hellip;</p></main>
<div id="toast" role="status" aria-live="polite"></div>
<script src="/admin.js" type="module"></script>
</body>
</html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
