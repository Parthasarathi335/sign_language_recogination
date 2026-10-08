(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const video = $('#video'), stage = $('#stage'), status = $('#status');
  const startBtn = $('#startBtn'), startLabel = $('#startLabel'), fileInput = $('#file');
  const words = $('#words'), empty = $('#empty'), count = $('#count');
  let mode = 'camera', stream = null, demoTimer = null;

  $('#year').textContent = new Date().getFullYear();

  const setStatus = (t, live = false) => {
    status.innerHTML = `<span class="dot ${live ? '' : 'grey'}"></span>${t}`;
  };

  function addWord(w) {
    empty.hidden = true; words.hidden = false;
    const li = document.createElement('li'); li.textContent = w; words.appendChild(li);
    count.textContent = `${words.children.length} sign${words.children.length === 1 ? '' : 's'} captured`;
  }
  function clearWords() {
    words.innerHTML = ''; words.hidden = true; empty.hidden = false;
    count.textContent = '0 signs captured';
  }

  function setMode(m) {
    mode = m;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === m));
    startLabel.textContent = m === 'camera' ? 'Start camera' : 'Choose video';
    stopCamera();
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.tab)));
  $$('[data-mode]').forEach(a => a.addEventListener('click', () => setMode(a.dataset.mode)));

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream; video.hidden = false; await video.play();
      stage.classList.add('live'); setStatus('Camera on – sign now', true);
      startLabel.textContent = 'Stop camera';
      // TODO: send frames to your recognition model here (e.g. MediaPipe / TensorFlow.js)
    } catch (e) {
      setStatus('Camera blocked – check permissions');
    }
  }
  function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; video.srcObject = null; video.hidden = true;
    stage.classList.remove('live');
    if (!demoTimer) setStatus('Ready when you are');
    if (mode === 'camera') startLabel.textContent = 'Start camera';
  }

  startBtn.addEventListener('click', () => {
    if (mode === 'upload') return fileInput.click();
    stream ? stopCamera() : startCamera();
  });

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0]; if (!f) return;
    video.srcObject = null; video.src = URL.createObjectURL(f);
    video.hidden = false; video.style.transform = 'none'; video.muted = true; video.play();
    stage.classList.add('live'); setStatus(`Playing ${f.name}`, true);
    // TODO: run recognition on the video frames
  });

  /* Demo */
  function playDemo() {
    clearInterval(demoTimer); clearWords();
    const sample = ['Hello', 'Thank you', 'I love you', 'Yes'];
    let i = 0; setStatus('Demo running', true);
    demoTimer = setInterval(() => {
      if (i < sample.length) addWord(sample[i++]);
      else { clearInterval(demoTimer); demoTimer = null; setStatus('Demo finished'); }
    }, 1100);
  }
  $$('[data-demo]').forEach(a => a.addEventListener('click', playDemo));

  /* Output actions */
  const text = () => [...words.children].map(li => li.textContent).join(' ');
  $('#clear').addEventListener('click', clearWords);
  $('#copy').addEventListener('click', () => text() && navigator.clipboard?.writeText(text()));
  $('#speak').addEventListener('click', () => {
    if (text() && 'speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(text()));
  });
})();(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const video = $('#video'), stage = $('#stage'), status = $('#status');
  const startBtn = $('#startBtn'), startLabel = $('#startLabel'), fileInput = $('#file');
  const words = $('#words'), empty = $('#empty'), count = $('#count');
  let mode = 'camera', stream = null, demoTimer = null;

  $('#year').textContent = new Date().getFullYear();

  const setStatus = (t, live = false) => {
    status.innerHTML = `<span class="dot ${live ? '' : 'grey'}"></span>${t}`;
  };

  function addWord(w) {
    empty.hidden = true; words.hidden = false;
    const li = document.createElement('li'); li.textContent = w; words.appendChild(li);
    count.textContent = `${words.children.length} sign${words.children.length === 1 ? '' : 's'} captured`;
  }
  function clearWords() {
    words.innerHTML = ''; words.hidden = true; empty.hidden = false;
    count.textContent = '0 signs captured';
  }

  function setMode(m) {
    mode = m;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === m));
    startLabel.textContent = m === 'camera' ? 'Start camera' : 'Choose video';
    stopCamera();
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.tab)));
  $$('[data-mode]').forEach(a => a.addEventListener('click', () => setMode(a.dataset.mode)));

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream; video.hidden = false; await video.play();
      stage.classList.add('live'); setStatus('Camera on – sign now', true);
      startLabel.textContent = 'Stop camera';
      // TODO: send frames to your recognition model here (e.g. MediaPipe / TensorFlow.js)
    } catch (e) {
      setStatus('Camera blocked – check permissions');
    }
  }
  function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; video.srcObject = null; video.hidden = true;
    stage.classList.remove('live');
    if (!demoTimer) setStatus('Ready when you are');
    if (mode === 'camera') startLabel.textContent = 'Start camera';
  }

  startBtn.addEventListener('click', () => {
    if (mode === 'upload') return fileInput.click();
    stream ? stopCamera() : startCamera();
  });

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0]; if (!f) return;
    video.srcObject = null; video.src = URL.createObjectURL(f);
    video.hidden = false; video.style.transform = 'none'; video.muted = true; video.play();
    stage.classList.add('live'); setStatus(`Playing ${f.name}`, true);
    // TODO: run recognition on the video frames
  });

  /* Demo */
  function playDemo() {
    clearInterval(demoTimer); clearWords();
    const sample = ['Hello', 'Thank you', 'I love you', 'Yes'];
    let i = 0; setStatus('Demo running', true);
    demoTimer = setInterval(() => {
      if (i < sample.length) addWord(sample[i++]);
      else { clearInterval(demoTimer); demoTimer = null; setStatus('Demo finished'); }
    }, 1100);
  }
  $$('[data-demo]').forEach(a => a.addEventListener('click', playDemo));

  /* Output actions */
  const text = () => [...words.children].map(li => li.textContent).join(' ');
  $('#clear').addEventListener('click', clearWords);
  $('#copy').addEventListener('click', () => text() && navigator.clipboard?.writeText(text()));
  $('#speak').addEventListener('click', () => {
    if (text() && 'speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(text()));
  });
})();