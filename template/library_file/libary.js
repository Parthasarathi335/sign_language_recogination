/* Sign library page – reads window.SIGN_LIBRARY from signs-data.js */
(() => {
  const lib = window.SIGN_LIBRARY;
  if (!lib) return;

  const $ = (s) => document.querySelector(s);
  const grid = $('#libGrid'), filters = $('#libFilters'), search = $('#libSearch');
  const count = $('#libCount'), none = $('#libNone'), dlg = $('#signDialog');

  const HAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5v-1a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v6m0-3.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-5-2.7L3.5 15.5a1.6 1.6 0 0 1 2.6-1.8L8 16"/></svg>';

  const signs = lib.signs.map((s, i) => ({ ...s, n: String(i + 1).padStart(2, '0') }));
  const categories = ['All', ...lib.categories];
  let category = 'All', query = '', current = [], openIndex = -1;

  $('#year').textContent = new Date().getFullYear();
  $('#libLang').textContent = lib.language + ' · English';

  /* Picture for a sign: your photo/GIF if provided, otherwise the hand icon */
  function makeMedia(s) {
    const wrap = document.createElement('div');
    wrap.className = 'lib-icon';
    if (s.media) {
      const img = document.createElement('img');
      img.src = s.media; img.alt = 'The sign for ' + s.word; img.loading = 'lazy';
      img.addEventListener('error', () => { wrap.innerHTML = HAND; });
      wrap.appendChild(img);
    } else {
      wrap.innerHTML = HAND;
    }
    return wrap;
  }

  function renderFilters() {
    filters.innerHTML = '';
    categories.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter' + (c === category ? ' active' : '');
      b.textContent = c;
      b.setAttribute('aria-pressed', String(c === category));
      b.addEventListener('click', () => { category = c; renderFilters(); render(); });
      filters.appendChild(b);
    });
  }

  function render() {
    const q = query.trim().toLowerCase();
    current = signs.filter((s) => {
      const inCat = category === 'All' || s.category === category;
      const hay = (s.word + ' ' + s.category + ' ' + s.steps.join(' ')).toLowerCase();
      return inCat && (!q || hay.includes(q));
    });

    grid.innerHTML = '';
    current.forEach((s, i) => {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'lib-card';
      card.setAttribute('aria-label', 'Open sign: ' + s.word);

      const num = document.createElement('small'); num.textContent = s.n;
      const h = document.createElement('h3'); h.textContent = s.word;
      const p = document.createElement('p'); p.textContent = s.category;
      card.append(num, makeMedia(s), h, p);
      card.addEventListener('click', () => openSign(i));
      grid.appendChild(card);
    });

    count.textContent = current.length === signs.length
      ? signs.length + ' signs'
      : current.length + ' of ' + signs.length + ' signs';
    none.hidden = current.length > 0;
  }

  function openSign(i) {
    if (!current.length) return;
    openIndex = (i + current.length) % current.length;
    const s = current[openIndex];

    $('#dlgNum').textContent = s.n;
    $('#dlgCat').textContent = s.category;
    $('#dlgWord').textContent = s.word;
    $('#dlgTip').textContent = s.tip || '';
    $('#dlgMedia').replaceChildren(makeMedia(s));

    const ol = $('#dlgSteps'); ol.innerHTML = '';
    s.steps.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ol.appendChild(li); });

    if (!dlg.open) dlg.showModal();
  }

  search.addEventListener('input', () => { query = search.value; render(); });
  $('#dlgClose').addEventListener('click', () => dlg.close());
  $('#dlgPrev').addEventListener('click', () => openSign(openIndex - 1));
  $('#dlgNext').addEventListener('click', () => openSign(openIndex + 1));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // click on backdrop
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') openSign(openIndex - 1);
    if (e.key === 'ArrowRight') openSign(openIndex + 1);
  });

  renderFilters();
  render();
})();