<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign Trainer – Sign Bridge</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <style>
    .tr{max-width:1100px;margin:0 auto;padding:56px 48px 90px}
    .tr h1{font-size:clamp(34px,5vw,48px);letter-spacing:-1.2px;line-height:1.1;margin:22px 0 14px}
    .tr h1 span{color:var(--amber)}
    .tr .lead{color:var(--ink-2);max-width:62ch;margin-bottom:34px}
    .tr-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:20px;align-items:start}
    .tr-box{padding:22px 24px;margin-bottom:16px}
    .tr-box h3{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2);margin-bottom:12px}
    .tr-box select,.tr-box input[type=text]{width:100%;font:inherit;padding:12px 14px;border:1px solid var(--line);background:#fff;margin-bottom:10px}
    .tr-box select:focus,.tr-box input:focus{outline:2px solid var(--amber);outline-offset:0}
    .tr-box .btn{width:100%;justify-content:center;border:0}
    .tr-box .btn[disabled]{opacity:.45;cursor:not-allowed}
    .tr-msg{min-height:22px;margin-top:10px;font-size:14px;color:var(--ink-2)}
    .tr-bar{height:6px;background:#eee;margin-top:10px;overflow:hidden}
    .tr-bar i{display:block;height:100%;width:0;background:var(--amber)}
    .tr-big{font-size:24px;font-weight:700;margin:4px 0;min-height:32px}
    .tr-dbg{font-size:12px;color:var(--ink-2);min-height:18px}
    .tr-box input[type=range]{width:100%;accent-color:#f0951a}
    .tr-list{list-style:none;display:grid;gap:8px;margin-bottom:14px}
    .tr-list li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:var(--panel);font-size:14px}
    .tr-list small{color:var(--ink-2)}
    .tr-list button{color:var(--ink-2);font-size:13px}
    .tr-list button:hover{color:#c0392b}
    .tr-row{display:flex;gap:8px;flex-wrap:wrap}
    .tr-row .btn{flex:1;padding:11px 12px;font-size:14px;width:auto}
    .tr .stage{aspect-ratio:4/3}
    .tr .stage video{background:#222}
    @media (max-width:900px){.tr{padding:40px 20px 70px}.tr-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="index.html" aria-label="Sign Bridge home">
      <span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5v-1a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v6m0-3.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-5-2.7L3.5 15.5a1.6 1.6 0 0 1 2.6-1.8L8 16"/></svg></span>
      <span class="brand-name">Sign <b>Bridge</b></span>
    </a>
    <nav class="nav" aria-label="Main">
      <a href="index.html#recognize">Recognize</a>
      <a href="library.html">Sign library</a>
      <a href="trainer.html" class="active" aria-current="page">Trainer</a>
    </nav>
  </header>

  <main class="tr">
    <p class="eyebrow muted">Teach the recognizer</p>
    <h1>Sign <span>Trainer</span></h1>
    <p class="lead">Pick a word, press Record, and make the sign. Record 5 or more samples of each sign (vary distance and speed a little). Then export <b>signs-model.json</b> and put it next to index.html so every visitor gets the trained signs.</p>

    <div class="tr-grid">
      <div class="panel">
        <div class="stage live mirror" id="stage">
          <video id="video" playsinline muted></video>
          <canvas class="overlay" id="overlay"></canvas>
          <span class="chip chip-top" id="status"><span class="dot grey"></span>Camera is off</span>
        </div>
        <div class="panel-bottom">
          <p class="tip">Good light. One or both hands fully in view.</p>
          <button class="btn btn-yellow" id="camBtn">Start camera <span>→</span></button>
        </div>
      </div>

      <div>
        <div class="panel tr-box">
          <h3>1 · Choose the sign</h3>
          <select id="word" aria-label="Sign word"></select>
          <input type="text" id="custom" placeholder="…or type your own word" aria-label="Custom word">
          <h3 style="margin-top:8px">2 · Record</h3>
          <button class="btn btn-dark" id="recBtn" disabled>Record sample</button>
          <div class="tr-bar"><i id="bar"></i></div>
          <p class="tr-msg" id="msg" aria-live="polite">Start the camera first.</p>
        </div>

        <div class="panel tr-box">
          <h3>3 · Test it live</h3>
          <div class="tr-big" id="guess">–</div>
          <div class="tr-dbg" id="dbg"></div>
          <label style="font-size:13px;color:var(--ink-2);display:block;margin-top:12px">Sensitivity <span id="sensVal">1.0</span>
            <input type="range" id="sens" min="0.6" max="2" step="0.1" value="1"></label>
          <p class="tr-dbg">Too many wrong words: lower it. Signs not detected: raise it.</p>
        </div>

        <div class="panel tr-box">
          <h3>Your signs</h3>
          <ul class="tr-list" id="list"></ul>
          <div class="tr-row">
            <button class="btn btn-dark" id="exportBtn">Export JSON</button>
            <button class="btn btn-outline" id="importBtn" style="color:var(--ink)!important;border-color:var(--line)">Import</button>
            <button class="btn btn-outline" id="clearBtn" style="color:#c0392b!important;border-color:var(--line)">Clear all</button>
          </div>
          <input type="file" id="importFile" accept="application/json,.json" hidden>
        </div>
      </div>
    </div>
  </main>

  <script src="signs-data.js"></script>
  <script src="recognizer.js"></script>
  <script src="trainer.js"></script>
</body>
</html>