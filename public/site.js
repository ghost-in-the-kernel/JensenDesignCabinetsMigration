// The menu on phones, and the slideshows (home: fades on its own; a project: arrows, swipe, keys).
const toggle = document.querySelector('.nav-toggle');
if (toggle) toggle.addEventListener('click', () => {
  const open = document.querySelector('.nav').classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('.slideshow').forEach((show) => {
  const slides = [...show.querySelectorAll('.slide')];
  if (!slides.length) return;
  const text = show.parentElement.querySelector('.slideshow__text');
  const bar = show.querySelector('.slideshow__progress span');
  let i = 0, timer;
  // A photo loads only when it is shown or next to the one shown, not all at once with the page.
  const load = (s) => s?.querySelectorAll('[data-src], [data-poster]').forEach((el) => {
    if (el.dataset.src) { el.src = el.dataset.src; delete el.dataset.src; }
    if (el.dataset.poster) { el.poster = el.dataset.poster; delete el.dataset.poster; }
  });
  const go = (n) => {
    slides[i].classList.remove('is-active');
    slides[i].querySelector('video')?.pause();
    i = (n + slides.length) % slides.length;
    const s = slides[i];
    s.classList.add('is-active');
    [s, slides[(i + 1) % slides.length], slides[(i - 1 + slides.length) % slides.length]].forEach(load);
    if (bar) bar.style.width = `${((i + 1) / slides.length) * 100}%`;
    if (text) {
      text.querySelector('.slideshow__title').textContent = s.dataset.title || '';
      text.querySelector('.slideshow__caption').textContent = s.dataset.caption || '';
      text.querySelector('.slideshow__count').textContent = slides.length > 1 ? `${i + 1} / ${slides.length}` : '';
    }
  };
  const auto = Number(show.dataset.autoplay);
  const restart = () => { if (auto) { clearInterval(timer); timer = setInterval(() => go(i + 1), auto); } };
  show.querySelector('.slideshow__prev')?.addEventListener('click', (e) => { e.preventDefault(); go(i - 1); restart(); });
  show.querySelector('.slideshow__next')?.addEventListener('click', (e) => { e.preventDefault(); go(i + 1); restart(); });
  if (slides.length < 2) show.querySelectorAll('.slideshow__prev, .slideshow__next').forEach((b) => b.remove());
  let x0 = null;
  show.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  show.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { go(dx < 0 ? i + 1 : i - 1); restart(); }
  });
  if (!auto) document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(i + 1);
    if (e.key === 'ArrowLeft') go(i - 1);
  });
  go(0); restart();
});
