/* Sign Bridge – sign recognizer
   camera / video  ->  hand landmarks (MediaPipe)  ->  word

   How it works
   1. MediaPipe Hand Landmarker finds up to 2 hands (21 points each) in every frame.
   2. Each frame becomes a feature vector (hand shape + where the hand is).
   3. A sliding window of the last ~1.5 s is compared (using DTW, which tolerates
      different signing speeds) with the signs you recorded in trainer.html.
   4. When the same word wins several times in a row, it is emitted via onWord().
   Built in without training: only the "I love you" handshape (simple finger rules).
   Every other word must be recorded in trainer.html first. */
(function (root) {
  'use strict';

  const MP_VERSION = '0.10.14';
  const MP_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION;
  const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

  const T = 16;                         // frames per resampled sequence
  const FEAT_HAND = 65;                 // 21 points x 3 + wrist x,y
  const FEAT = FEAT_HAND * 2;           // two hand slots
  const POS_W = 3;                      // weight of hand position vs hand shape
  const WINDOWS = [800, 1200, 1600];    // ms, window lengths that are tried
  const DETECT_MS = 50;                 // run hand detection ~20x per second
  const EVAL_MS = 150;                  // compare with the library ~6x per second
  const STABLE = 3;                     // same winner this many times in a row
  const COOLDOWN = 800;                 // ms between two emitted words
  const GAP_FILL_MS = 250;              // keep a hand for this long if tracking blinks
  const RELEASE_MS = 700;               // hands away this long -> ready for the same word again
  const BAND = 4;                       // DTW band
  const RATIO = 0.85;                   // winner must beat the runner-up by 15 %
  const DEFAULT_THR = 3.0, MIN_THR = 1.2, MAX_THR = 8;
  const STORE_KEY = 'signbridge.model';

  const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

  /* ---------- features ---------- */
  function handFeatures(lm, aspect) {
    const out = new Float32Array(FEAT_HAND);
    const P = (i) => [lm[i].x * aspect, lm[i].y, lm[i].z * aspect];
    const w = P(0), m = P(9);
    const scale = Math.hypot(m[0] - w[0], m[1] - w[1], m[2] - w[2]) || 1e-6;
    let k = 0;
    for (let i = 0; i < 21; i++) {
      const p = P(i);
      out[k++] = (p[0] - w[0]) / scale;
      out[k++] = (p[1] - w[1]) / scale;
      out[k++] = (p[2] - w[2]) / scale;
    }
    out[k++] = lm[0].x * POS_W;
    out[k++] = lm[0].y * POS_W;
    return out;
  }

  /* "I love you" handshape from simple finger geometry (no training needed) */
  function ruleSign(lm, aspect) {
    const d = (a, b) => Math.hypot((lm[a].x - lm[b].x) * aspect, lm[a].y - lm[b].y, (lm[a].z - lm[b].z) * aspect);
    const palm = d(0, 9) || 1e-6;
    const r = (tip, pip) => d(tip, 0) / (d(pip, 0) || 1e-6);
    const ext = (x) => x > 1.25, curl = (x) => x < 1.05;
    const thumbOut = d(4, 5) / palm > 0.65;
    if (ext(r(8, 6)) && ext(r(20, 18)) && curl(r(12, 10)) && curl(r(16, 14)) && thumbOut) return 'I love you';
    return null;
  }

  /* ---------- sequences ---------- */
  function resampleByTime(frames, t0, t1, n) {
    const out = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const t = t0 + (t1 - t0) * i / (n - 1);
      while (j < frames.length - 2 && frames[j + 1].t < t) j++;
      const a = frames[j], b = frames[Math.min(j + 1, frames.length - 1)];
      let u = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      u = Math.max(0, Math.min(1, u));
      const v = new Float32Array(FEAT);
      for (let k = 0; k < FEAT; k++) v[k] = a.v[k] + (b.v[k] - a.v[k]) * u;
      out.push(v);
    }
    return out;
  }

  function fdist(a, b) {
    let s = 0;
    for (let k = 0; k < FEAT; k++) { const d = a[k] - b[k]; s += d * d; }
    return Math.sqrt(s);
  }

  function dtw(a, b) {
    const n = a.length, m = b.length, INF = 1e9;
    let prev = new Float64Array(m + 1).fill(INF), cur = new Float64Array(m + 1);
    prev[0] = 0;
    for (let i = 1; i <= n; i++) {
      cur.fill(INF);
      const lo = Math.max(1, i - BAND), hi = Math.min(m, i + BAND);
      for (let j = lo; j <= hi; j++) {
        cur[j] = fdist(a[i - 1], b[j - 1]) + Math.min(prev[j], cur[j - 1], prev[j - 1]);
      }
      const tmp = prev; prev = cur; cur = tmp;
    }
    return prev[m] / n;
  }

  /* ---------- recognizer ---------- */
  class SignRecognizer {
    constructor(opts) {
      this.opts = Object.assign({ modelUrl: 'signs-model.json', useLocal: true }, opts || {});
      const noop = () => {};
      this.onWord = this.opts.onWord || noop;       // ({word, confidence, source})
      this.onGuess = this.opts.onGuess || noop;     // ({word, confidence}) or null
      this.onStatus = this.opts.onStatus || noop;   // (state, detail)
      this.onFrame = this.opts.onFrame || noop;     // ({hands, aspect}) for drawing
      this.onDebug = this.opts.onDebug || noop;     // ({best, second, thr})
      this.sensitivity = 1;                          // >1 = accepts looser matches
      this.samples = [];
      this.thresholds = {};
      this.landmarker = null;
      this._reset();
    }

    _reset() {
      this._frames = []; this._lastHand = [null, null]; this._lastHandT = -1e9;
      this._cand = null; this._candCount = 0; this._noCand = 0;
      this._locked = null; this._lastEmit = -1e9; this._rules = [];
      this._capture = null;
    }

    /* ----- setup ----- */
    async init() {
      if (this.landmarker) return;
      this.onStatus('loading', 'Loading hand model…');
      let vision;
      try { vision = await import(MP_BASE + '/vision_bundle.mjs'); }
      catch (e) { vision = await import(MP_BASE + '/+esm'); }
      const { FilesetResolver, HandLandmarker } = vision;
      const fileset = await FilesetResolver.forVisionTasks(MP_BASE + '/wasm');
      const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5
      });
      try { this.landmarker = await make('GPU'); } catch (e) { this.landmarker = await make('CPU'); }
      await this._loadModel();
      this.onStatus('ready', { samples: this.samples.length, labels: this.labels().length });
    }

    async _loadModel() {
      let data = null;
      if (this.opts.useLocal) {
        try { const s = localStorage.getItem(STORE_KEY); if (s) data = JSON.parse(s); } catch (e) {}
      }
      if (!data || !data.samples || !data.samples.length) {
        try { const r = await fetch(this.opts.modelUrl, { cache: 'no-cache' }); if (r.ok) data = await r.json(); } catch (e) {}
      }
      this.setModel(data);
    }

    setModel(data) {
      const list = (data && data.samples) || [];
      this.samples = list
        .filter((s) => s && s.label && Array.isArray(s.seq) && s.seq.length === T && s.seq.every((f) => f.length === FEAT))
        .map((s) => ({ label: String(s.label), seq: s.seq.map((f) => Float32Array.from(f)) }));
      this._rebuild();
    }

    /* per-word acceptance distance, learned from how much your own samples vary */
    _rebuild() {
      this.thresholds = {};
      this.labels().forEach((label) => {
        const own = this.samples.filter((s) => s.label === label);
        if (own.length < 2) { this.thresholds[label] = DEFAULT_THR; return; }
        let worst = 0;
        own.forEach((s, i) => {
          let near = Infinity;
          own.forEach((o, j) => { if (i !== j) near = Math.min(near, dtw(s.seq, o.seq)); });
          worst = Math.max(worst, near);
        });
        this.thresholds[label] = Math.min(MAX_THR, Math.max(MIN_THR, worst * 1.8));
      });
    }

    labels() { return [...new Set(this.samples.map((s) => s.label))]; }
    countFor(label) { return this.samples.filter((s) => s.label === label).length; }
    addSample(s) { this.samples.push(s); this._rebuild(); this.saveLocal(); }
    removeLabel(label) { this.samples = this.samples.filter((s) => s.label !== label); this._rebuild(); this.saveLocal(); }
    clearModel() { this.samples = []; this._rebuild(); this.saveLocal(); }

    exportJSON() {
      const r = (f) => Array.from(f, (x) => Math.round(x * 1000) / 1000);
      return JSON.stringify({ version: 1, T, feat: FEAT,
        samples: this.samples.map((s) => ({ label: s.label, seq: s.seq.map(r) })) });
    }
    importJSON(text) { this.setModel(JSON.parse(text)); this.saveLocal(); }
    saveLocal() { try { localStorage.setItem(STORE_KEY, this.exportJSON()); } catch (e) {} }

    /* ----- run loop ----- */
    start(video) {
      this.video = video; this._running = true; this._reset();
      this._lastDetect = 0; this._lastEval = 0; this._lastVT = -1;
      const tick = () => {
        if (!this._running) return;
        try { this._step(); } catch (e) { this.onStatus('error', e.message || String(e)); }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    stop() { this._running = false; this._reset(); this.onGuess(null); this.onFrame({ hands: [], aspect: 1 }); }

    _step() {
      const v = this.video, now = performance.now();
      if (!this.landmarker || !v || v.readyState < 2 || v.currentTime === this._lastVT) return;
      if (now - this._lastDetect >= DETECT_MS) {
        this._lastDetect = now; this._lastVT = v.currentTime;
        const res = this.landmarker.detectForVideo(v, now);
        const hands = (res.landmarks || []).map((lm, i) => ({
          landmarks: lm,
          label: (res.handednesses && res.handednesses[i] && res.handednesses[i][0] && res.handednesses[i][0].categoryName) || 'Right'
        }));
        const aspect = (v.videoWidth / v.videoHeight) || 1;
        this._ingest(hands, aspect, now);
        this.onFrame({ hands, aspect });
      }
      if (now - this._lastEval >= EVAL_MS) { this._lastEval = now; this._evaluate(now); }
    }

    /* ----- one detected frame ----- */
    _ingest(hands, aspect, t) {
      const slots = [null, null];
      hands.forEach((h) => {
        let s = h.label === 'Left' ? 0 : 1;
        if (slots[s]) s = 1 - s;
        if (!slots[s]) slots[s] = h;
      });
      const v = new Float32Array(FEAT);
      let has = false;
      for (let s = 0; s < 2; s++) {
        if (slots[s]) {
          const f = handFeatures(slots[s].landmarks, aspect);
          v.set(f, s * FEAT_HAND);
          this._lastHand[s] = { t, f };
          has = true;
        } else if (this._lastHand[s] && t - this._lastHand[s].t <= GAP_FILL_MS) {
          v.set(this._lastHand[s].f, s * FEAT_HAND);
        }
      }
      if (has) this._lastHandT = t;

      const first = hands[0];
      this._rules.push(first ? ruleSign(first.landmarks, aspect) : null);
      if (this._rules.length > 5) this._rules.shift();

      this._frames.push({ t, v, has });
      while (this._frames.length && t - this._frames[0].t > 2500) this._frames.shift();

      const c = this._capture;
      if (c) {
        if (c.t0 === null) c.t0 = t;
        c.frames.push({ t, v, has });
        if (t - c.t0 >= c.ms) {
          this._capture = null;
          const seen = c.frames.filter((f) => f.has).length / c.frames.length;
          if (c.frames.length < 8 || seen < 0.5) c.reject(new Error('Hand not clearly visible. Try again.'));
          else c.resolve({ label: c.label, seq: resampleByTime(c.frames, c.t0, c.t0 + c.ms, T) });
        }
      }
    }

    /* record one training sample (resolves with the sample, does not save it) */
    captureSample(label, ms) {
      return new Promise((resolve, reject) => {
        this._capture = { label, ms: ms || 1500, t0: null, frames: [], resolve, reject };
      });
    }

    /* ----- compare window with the library ----- */
    _scoreWindow(t) {
      const byLabel = {};
      WINDOWS.forEach((len) => {
        const win = this._frames.filter((f) => f.t >= t - len);
        if (win.length < 5) return;
        if (win.filter((f) => f.has).length / win.length < 0.5) return;
        const seq = resampleByTime(win, t - len, t, T);
        this.samples.forEach((s) => {
          const d = dtw(seq, s.seq);
          if (byLabel[s.label] === undefined || d < byLabel[s.label]) byLabel[s.label] = d;
        });
      });
      const ranked = Object.entries(byLabel).sort((a, b) => a[1] - b[1]);
      if (!ranked.length) return null;
      const best = { label: ranked[0][0], dist: ranked[0][1] };
      const second = ranked[1] ? { label: ranked[1][0], dist: ranked[1][1] } : null;
      const thr = (this.thresholds[best.label] || DEFAULT_THR) * this.sensitivity;
      this.onDebug({ best, second, thr });
      if (best.dist > thr) return null;
      if (second && best.dist > RATIO * second.dist) return null;
      return { label: best.label, confidence: Math.max(0.5, 1 - 0.5 * best.dist / thr), source: 'model' };
    }

    _ruleCandidate() {
      if (this._rules.length < 5) return null;
      const hits = this._rules.filter((r) => r === 'I love you').length;
      if (hits >= 4 && !this.labels().includes('I love you')) {
        return { label: 'I love you', confidence: 0.8, source: 'rule' };
      }
      return null;
    }

    _evaluate(t) {
      if (t - this._lastHandT > RELEASE_MS) { this._locked = null; }
      if (t - this._lastHandT > 300) {
        this._cand = null; this._candCount = 0;
        this.onStatus('no-hands'); this.onGuess(null);
        return;
      }
      this.onStatus('hands');
      const cand = this._scoreWindow(t) || this._ruleCandidate();

      if (cand && cand.label === this._cand) this._candCount++;
      else { this._cand = cand ? cand.label : null; this._candCount = cand ? 1 : 0; }

      if (cand) { this._noCand = 0; this.onGuess({ word: cand.label, confidence: cand.confidence }); }
      else {
        this.onGuess(null);
        if (++this._noCand >= 8) this._locked = null;   // ~1.2 s of nothing: allow the same word again
      }

      if (cand && this._candCount >= STABLE && cand.label !== this._locked && t - this._lastEmit > COOLDOWN) {
        this._locked = cand.label; this._lastEmit = t;
        this.onWord({ word: cand.label, confidence: cand.confidence, source: cand.source });
      }
    }
  }

  /* draws the hand skeleton on a canvas that sits on top of the video (handles object-fit: cover) */
  SignRecognizer.drawHands = function (canvas, box, video, hands) {
    const dpr = window.devicePixelRatio || 1;
    const w = box.clientWidth, h = box.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    if (!hands.length || !video.videoWidth) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    const s = Math.max(w / vw, h / vh), ox = (vw * s - w) / 2, oy = (vh * s - h) / 2;
    const X = (x) => x * vw * s - ox, Y = (y) => y * vh * s - oy;
    hands.forEach((hand) => {
      const lm = hand.landmarks;
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(240,149,26,.95)';
      CONNECTIONS.forEach(([a, c]) => {
        ctx.beginPath(); ctx.moveTo(X(lm[a].x), Y(lm[a].y)); ctx.lineTo(X(lm[c].x), Y(lm[c].y)); ctx.stroke();
      });
      ctx.fillStyle = '#fff';
      lm.forEach((p) => { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2); ctx.fill(); });
    });
  };

  SignRecognizer.CONNECTIONS = CONNECTIONS;
  SignRecognizer._internals = { handFeatures, ruleSign, resampleByTime, dtw, FEAT, T };
  root.SignRecognizer = SignRecognizer;
  if (typeof module !== 'undefined' && module.exports) module.exports = SignRecognizer;
})(typeof window !== 'undefined' ? window : globalThis);