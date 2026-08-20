/* ============================================================
   ASPECTS Scorer — camera-assisted manual scoring of the
   Alberta Stroke Program Early CT Score on non-contrast head CT.
   All processing is client-side. No network calls, no uploads.
   Educational / research use only. Not a medical device.
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- region definitions ---------- */
  const REGIONS = [
    { id: 'C', name: 'Caudate', desc: 'Caudate head', level: 'ganglionic' },
    { id: 'L', name: 'Lentiform nucleus', desc: 'Putamen + globus pallidus', level: 'ganglionic' },
    { id: 'IC', name: 'Internal capsule', desc: 'Posterior limb', level: 'ganglionic' },
    { id: 'I', name: 'Insular ribbon', desc: 'Insular cortex', level: 'ganglionic' },
    { id: 'M1', name: 'M1', desc: 'Anterior MCA cortex', level: 'ganglionic' },
    { id: 'M2', name: 'M2', desc: 'MCA cortex lateral to insular ribbon', level: 'ganglionic' },
    { id: 'M3', name: 'M3', desc: 'Posterior MCA cortex', level: 'ganglionic' },
    { id: 'M4', name: 'M4', desc: 'Anterior MCA territory, rostral to M1', level: 'supra' },
    { id: 'M5', name: 'M5', desc: 'Lateral MCA territory, rostral to M2', level: 'supra' },
    { id: 'M6', name: 'M6', desc: 'Posterior MCA territory, rostral to M3', level: 'supra' },
  ];

  /* ---------- state ---------- */
  const state = {
    step: 1,
    sourceCanvas: null, // as captured (possibly rotated)
    baseCanvas: null, // after rectification, working resolution
    gray: null, // Uint8ClampedArray grayscale of baseCanvas
    claheCache: null,
    corners: [
      { x: 0.08, y: 0.08 },
      { x: 0.92, y: 0.08 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 },
    ],
    adj: { brightness: 0, contrast: 0, gamma: 1, level: 128, width: 255, invert: false, mirror: false, clahe: false },
    side: 'left',
    marked: new Set(),
    quality: null,
    meta: { caseId: '', level: 'Ganglionic', onset: '', reader: '', notes: '' },
  };

  /* ============================================================
     THEME
     ============================================================ */
  (() => {
    const btn = $('[data-theme-toggle]');
    const root = document.documentElement;
    let mode = 'dark'; // reading-room default
    try {
      if (matchMedia('(prefers-color-scheme: light)').matches) mode = 'light';
    } catch (_) {}
    const sun =
      '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2 12h2M20 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5"/></svg>';
    const moon = '<svg class="ico" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
    const paint = () => {
      root.setAttribute('data-theme', mode);
      btn.innerHTML = mode === 'dark' ? sun : moon;
      btn.setAttribute('aria-label', `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`);
      if (state.baseCanvas) render();
      if (state.step === 5) drawReport();
      document.dispatchEvent(new Event('theme:change'));
    };
    btn.addEventListener('click', () => {
      mode = mode === 'dark' ? 'light' : 'dark';
      paint();
    });
    paint();
  })();

  /* ============================================================
     STEP NAVIGATION
     ============================================================ */
  function goto(n) {
    if (n > 1 && !state.sourceCanvas) {
      flash('Capture or choose an image first.');
      return;
    }
    state.step = n;
    $$('[data-step]').forEach((p) => (p.hidden = +p.dataset.step !== n));
    $$('.step').forEach((b) => {
      const i = +b.dataset.goto;
      b.toggleAttribute('aria-current', i === n);
      if (i === n) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
      b.classList.toggle('done', i < n && !!state.sourceCanvas);
    });
    if (n === 2) drawAlignStage();
    if (n === 3) render();
    if (n === 4) {
      renderThumb();
      updateScore();
    }
    if (n === 5) drawReport();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => goto(+b.dataset.goto)));
  $$('[data-back-to]').forEach((b) => b.addEventListener('click', () => goto(+b.dataset.backTo)));

  function flash(msg) {
    const el = $('[data-copy-status]');
    if (el && state.step === 5) {
      el.textContent = msg;
      setTimeout(() => (el.textContent = ''), 3000);
    } else {
      const h = $('[data-camera-hint]');
      h.hidden = false;
      h.textContent = msg;
      setTimeout(() => (h.hidden = true), 3000);
    }
  }

  /* ============================================================
     HELP DIALOG
     ============================================================ */
  const help = $('[data-help]');
  $('[data-open-help]').addEventListener('click', () => help.showModal());
  $('[data-close-help]').addEventListener('click', () => help.close());

  /* ============================================================
     STEP 1 — CAPTURE
     ============================================================ */
  const camWrap = $('[data-camera-wrap]');
  const video = $('[data-video]');
  let stream = null;

  $('[data-start-camera]').addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      flash('This browser or embedded frame blocks camera access — use "Choose photo" instead.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } },
        audio: false,
      });
      video.srcObject = stream;
      camWrap.hidden = false;
    } catch (err) {
      flash('Camera unavailable (' + (err && err.name ? err.name : 'error') + '). Use "Choose photo" instead.');
    }
  });

  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    camWrap.hidden = true;
  }
  $('[data-stop-camera]').addEventListener('click', stopCamera);

  $('[data-shutter]').addEventListener('click', () => {
    if (!video.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0);
    stopCamera();
    acceptImage(c);
  });

  $('[data-file-input]').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
      acceptImage(c);
    };
    img.onerror = () => flash('Could not read that image file.');
    img.src = URL.createObjectURL(f);
  });

  $('[data-load-demo]').addEventListener('click', () => acceptImage(buildPhantom()));

  function acceptImage(canvas) {
    state.quality = assessQuality(canvas);
    state.sourceCanvas = downscale(canvas, 1600);
    state.corners = [
      { x: 0.08, y: 0.08 },
      { x: 0.92, y: 0.08 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 },
    ];
    updateQualityChip();
    if (state.quality.grade === 'good') goto(2);
    else showQualityDialog(state.quality);
  }

  /* ============================================================
     IMAGE QUALITY GATE
     Purely technical assessment of the photograph — sharpness,
     resolution, exposure, glare, dynamic range. Never diagnostic.
     ============================================================ */
  function assessQuality(canvas) {
    const shortSide = Math.min(canvas.width, canvas.height);
    const megapixels = (canvas.width * canvas.height) / 1e6;

    // scale-normalised copy so sharpness is comparable between phones
    const w = 512;
    const h = Math.max(8, Math.round((canvas.height * w) / canvas.width));
    const t = document.createElement('canvas');
    t.width = w;
    t.height = h;
    const tc = t.getContext('2d');
    tc.imageSmoothingEnabled = true;
    tc.imageSmoothingQuality = 'high';
    tc.drawImage(canvas, 0, 0, w, h);
    const d = tc.getImageData(0, 0, w, h).data;

    const g = new Float32Array(w * h);
    const hist = new Uint32Array(256);
    let rs = 0, gs = 0, bs = 0;
    for (let p = 0, i = 0; p < g.length; p++, i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      rs += r; gs += gg; bs += b;
      const v = r * 0.299 + gg * 0.587 + b * 0.114;
      g[p] = v;
      hist[v | 0]++;
    }
    const n = g.length;

    // sharpness: variance of the Laplacian
    let lm = 0, lm2 = 0, lc = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const o = y * w + x;
        const l = 4 * g[o] - g[o - 1] - g[o + 1] - g[o - w] - g[o + w];
        lm += l; lm2 += l * l; lc++;
      }
    }
    const lMean = lm / (lc || 1);
    const lapVar = lm2 / (lc || 1) - lMean * lMean;

    // exposure and dynamic range
    let mean = 0;
    for (let v = 0; v < 256; v++) mean += v * hist[v];
    mean /= n;
    let sd = 0;
    for (let v = 0; v < 256; v++) sd += hist[v] * (v - mean) * (v - mean);
    sd = Math.sqrt(sd / n);

    const pct = (frac) => {
      const need = frac * n;
      let acc = 0;
      for (let v = 0; v < 256; v++) {
        acc += hist[v];
        if (acc >= need) return v;
      }
      return 255;
    };
    const range = pct(0.99) - pct(0.01);

    let blown = 0, crushed = 0;
    for (let v = 250; v < 256; v++) blown += hist[v];
    for (let v = 0; v < 5; v++) crushed += hist[v];
    const blownPct = (blown / n) * 100;
    const crushedPct = (crushed / n) * 100;

    // glare: proportion of tiles that are almost entirely near-white
    let glare = 0;
    const box = 12;
    for (let y = 0; y + box <= h; y += box) {
      for (let x = 0; x + box <= w; x += box) {
        let bright = 0;
        for (let j = 0; j < box; j++) {
          const row = (y + j) * w + x;
          for (let i2 = 0; i2 < box; i2++) if (g[row + i2] > 244) bright++;
        }
        if (bright > box * box * 0.85) glare++;
      }
    }
    const tiles = Math.floor(h / box) * Math.floor(w / box) || 1;
    const glarePct = (glare / tiles) * 100;

    // colour cast — a film photo should be close to neutral
    const rm = rs / n, gm = gs / n, bm = bs / n;
    const cast = (Math.max(rm, gm, bm) - Math.min(rm, gm, bm)) / Math.max(1, (rm + gm + bm) / 3);

    const checks = [];
    const add = (label, value, status, advice) => checks.push({ label, value, status, advice });

    add(
      'Resolution',
      canvas.width + ' \u00d7 ' + canvas.height + ' px (' + megapixels.toFixed(1) + ' MP)',
      shortSide >= 900 ? 'ok' : shortSide >= 600 ? 'warn' : 'bad',
      shortSide >= 900
        ? ''
        : 'Fill the frame with the single slice you want to score, or use a phone with a higher-resolution rear camera. Screenshots and forwarded messaging-app copies have already thrown away most of the detail.'
    );
    add(
      'Sharpness',
      lapVar >= 400 ? 'crisp' : lapVar >= 140 ? 'soft' : 'blurred',
      lapVar >= 400 ? 'ok' : lapVar >= 140 ? 'warn' : 'bad',
      lapVar >= 400
        ? ''
        : 'Tap to focus on the film before shooting, brace your elbows or rest the phone against the lightbox, and avoid digital zoom. Motion blur and misfocus erase the grey\u2013white boundary that ASPECTS depends on.'
    );
    add(
      'Dynamic range',
      range + ' of 255 levels \u00b7 SD ' + sd.toFixed(0),
      range >= 120 && sd >= 30 ? 'ok' : range >= 70 ? 'warn' : 'bad',
      range >= 120 && sd >= 30
        ? ''
        : 'The photograph is flat. Backlight the film on a lightbox or a white full-screen monitor, switch the room lights off, and lock exposure on the brain rather than on the bright border.'
    );
    add(
      'Exposure',
      blownPct.toFixed(1) + '% clipped white \u00b7 ' + crushedPct.toFixed(1) + '% clipped black \u00b7 mean ' + mean.toFixed(0),
      blownPct < 6 && crushedPct < 25 ? 'ok' : blownPct < 15 && crushedPct < 45 ? 'warn' : 'bad',
      blownPct < 6 && crushedPct < 25
        ? ''
        : 'Clipped pixels carry no attenuation information at all and nothing downstream can recover it. Reduce exposure compensation, dim the lightbox, and crop tightly around the brain before shooting.'
    );
    add(
      'Glare / reflections',
      glarePct.toFixed(1) + '% of frame',
      glarePct < 3 ? 'ok' : glarePct < 9 ? 'warn' : 'bad',
      glarePct < 3
        ? ''
        : 'Turn the flash off, tilt the film slightly away from overhead lights, and shoot from directly in front. Specular glare over the brain cannot be corrected afterwards.'
    );
    add(
      'Colour neutrality',
      cast < 0.06 ? 'neutral' : cast < 0.14 ? 'slight cast' : 'strong cast',
      cast < 0.06 ? 'ok' : cast < 0.14 ? 'warn' : 'bad',
      cast < 0.06
        ? ''
        : 'A strong cast means mixed lighting or an auto white-balance error. Use a neutral white backlight \u2014 the app works in greyscale, so a cast simply costs you tonal separation.'
    );

    const bad = checks.filter((c) => c.status === 'bad').length;
    const warn = checks.filter((c) => c.status === 'warn').length;
    const grade = bad ? 'poor' : warn ? 'borderline' : 'good';

    return {
      grade,
      checks,
      bad,
      warn,
      metrics: { shortSide, megapixels, lapVar: +lapVar.toFixed(1), range, sd: +sd.toFixed(1), mean: +mean.toFixed(1), blownPct: +blownPct.toFixed(2), crushedPct: +crushedPct.toFixed(2), glarePct: +glarePct.toFixed(2), cast: +cast.toFixed(3) },
    };
  }

  const qDlg = $('[data-quality]');

  function showQualityDialog(q) {
    const poor = q.grade === 'poor';
    $('[data-q-title]').textContent = poor
      ? 'This photo is probably not good enough'
      : q.grade === 'borderline'
      ? 'Photo quality is marginal'
      : 'Photo quality looks good';
    $('[data-q-lede]').textContent = poor
      ? 'One or more technical checks failed outright. On an image like this early ischaemic change is very likely to be invisible \u2014 or, worse, to be mimicked by noise and glare. Retake it, ideally with a better camera phone or a proper lightbox, before scoring.'
      : q.grade === 'borderline'
      ? 'The photograph is usable but not clean. Consider retaking it. If you continue, treat any borderline region as normal rather than calling it an early ischaemic change.'
      : 'All technical checks passed. Remember that a good photograph is still a photograph \u2014 Hounsfield units are gone either way.';

    $('[data-q-metrics]').innerHTML = q.checks
      .map(
        (c) =>
          '<li data-status="' + c.status + '"><span class="q-dot" aria-hidden="true"></span><span class="q-name">' +
          c.label +
          '</span><span class="q-val">' +
          c.value +
          '</span></li>'
      )
      .join('');

    const advice = q.checks.filter((c) => c.advice);
    $('[data-q-advice]').innerHTML = advice.length
      ? '<h3>How to fix it</h3>' + advice.map((c) => '<p><strong>' + c.label + '.</strong> ' + c.advice + '</p>').join('')
      : '';

    $('[data-q-retake]').hidden = q.grade === 'good';
    $('[data-q-continue]').textContent = q.grade === 'good' ? 'Continue' : 'Continue anyway';
    qDlg.dataset.grade = q.grade;
    if (typeof qDlg.showModal === 'function') qDlg.showModal();
    else flash('Photo quality: ' + q.grade + '. Review the capture tips.');
  }

  $('[data-q-continue]').addEventListener('click', () => {
    qDlg.close();
    if (state.sourceCanvas) goto(2);
  });
  $('[data-q-retake]').addEventListener('click', () => {
    qDlg.close();
    state.sourceCanvas = null;
    state.baseCanvas = null;
    state.quality = null;
    updateQualityChip();
    goto(1);
  });
  qDlg.addEventListener('close', updateQualityChip);

  function updateQualityChip() {
    const q = state.quality;
    $$('[data-q-chip]').forEach((el) => {
      if (!q) {
        el.hidden = true;
        el.innerHTML = '';
        return;
      }
      el.hidden = false;
      el.dataset.grade = q.grade;
      const failing = q.bad ? q.bad + ' failing check' + (q.bad > 1 ? 's' : '') : q.warn ? q.warn + ' marginal check' + (q.warn > 1 ? 's' : '') : 'all checks passed';
      el.innerHTML =
        '<span class="q-dot" aria-hidden="true"></span><span>Photo quality: <strong>' +
        q.grade +
        '</strong> \u00b7 ' +
        failing +
        '</span><button type="button" class="q-link" data-q-open>Details</button>';
      $('[data-q-open]', el).addEventListener('click', () => showQualityDialog(q));
    });
  }

  function downscale(c, maxDim) {
    const m = Math.max(c.width, c.height);
    if (m <= maxDim) return c;
    const k = maxDim / m;
    const o = document.createElement('canvas');
    o.width = Math.round(c.width * k);
    o.height = Math.round(c.height * k);
    const ctx = o.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, 0, 0, o.width, o.height);
    return o;
  }

  /* ---------- synthetic CT phantom for demo / QA ---------- */
  function buildPhantom() {
    const W = 900,
      H = 900,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, W, H);
    const cx = W / 2,
      cy = H / 2;
    const ell = (rx, ry, fill, rot = 0) => {
      x.save();
      x.translate(cx, cy);
      x.rotate(rot);
      x.beginPath();
      x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      x.fillStyle = fill;
      x.fill();
      x.restore();
    };
    ell(300, 355, '#d8d8d8'); // skull
    ell(283, 338, '#4b4b4b'); // brain (white matter base)
    // grey matter cortical ribbon
    x.save();
    x.translate(cx, cy);
    x.beginPath();
    x.ellipse(0, 0, 283, 338, 0, 0, Math.PI * 2);
    x.ellipse(0, 0, 248, 300, 0, 0, Math.PI * 2);
    x.fillStyle = '#5c5c5c';
    x.fill('evenodd');
    x.restore();
    // basal ganglia + thalami
    const blob = (dx, dy, rx, ry, rot, fill) => {
      x.save();
      x.translate(cx + dx, cy + dy);
      x.rotate(rot);
      x.beginPath();
      x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      x.fillStyle = fill;
      x.fill();
      x.restore();
    };
    blob(-95, -20, 42, 78, -0.18, '#5e5e5e');
    blob(95, -20, 42, 78, 0.18, '#5e5e5e');
    blob(-40, -95, 28, 46, -0.1, '#606060');
    blob(40, -95, 28, 46, 0.1, '#606060');
    blob(-38, 40, 34, 52, -0.1, '#585858');
    blob(38, 40, 34, 52, 0.1, '#585858');
    // ventricles
    blob(-30, -40, 16, 90, -0.06, '#141414');
    blob(30, -40, 16, 90, 0.06, '#141414');
    // simulated left MCA insular + lentiform hypoattenuation (viewer right)
    x.save();
    x.globalAlpha = 0.5;
    blob(105, -10, 60, 96, 0.18, '#4a4a4a');
    x.restore();
    // insular ribbon loss
    x.save();
    x.globalAlpha = 0.55;
    blob(165, -5, 26, 90, 0.2, '#4c4c4c');
    x.restore();
    // photograph-like degradation: glare + noise + slight blur
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,255,255,0.1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.05)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    const d = x.getImageData(0, 0, W, H);
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      d.data[i] = clamp(d.data[i] + n, 0, 255);
      d.data[i + 1] = clamp(d.data[i + 1] + n, 0, 255);
      d.data[i + 2] = clamp(d.data[i + 2] + n, 0, 255);
    }
    x.putImageData(d, 0, 0);
    x.fillStyle = 'rgba(220,230,240,0.75)';
    x.font = '600 22px sans-serif';
    x.fillText('DEMO PHANTOM — not a patient', 26, 46);
    x.fillText('L', W - 46, cy);
    x.fillText('R', 26, cy);
    return c;
  }

  /* ============================================================
     STEP 2 — PERSPECTIVE ALIGNMENT
     ============================================================ */
  const alignCanvas = $('[data-align-canvas]');
  const handlesBox = $('[data-handles]');

  function drawAlignStage() {
    const src = state.sourceCanvas;
    const maxW = Math.min(760, window.innerWidth - 40);
    const k = Math.min(1, maxW / src.width);
    alignCanvas.width = Math.round(src.width * k);
    alignCanvas.height = Math.round(src.height * k);
    const ctx = alignCanvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, alignCanvas.width, alignCanvas.height);
    drawGuides();
    buildHandles();
  }

  function drawGuides() {
    const ctx = alignCanvas.getContext('2d');
    const w = alignCanvas.width,
      h = alignCanvas.height;
    ctx.save();
    ctx.strokeStyle = 'rgba(79,195,214,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    state.corners.forEach((p, i) => {
      const x = p.x * w,
        y = p.y * h;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function redrawAlign() {
    const ctx = alignCanvas.getContext('2d');
    ctx.drawImage(state.sourceCanvas, 0, 0, alignCanvas.width, alignCanvas.height);
    drawGuides();
  }

  function buildHandles() {
    handlesBox.innerHTML = '';
    state.corners.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'handle';
      el.style.left = p.x * 100 + '%';
      el.style.top = p.y * 100 + '%';
      el.setAttribute('role', 'slider');
      el.setAttribute('aria-label', ['top-left', 'top-right', 'bottom-right', 'bottom-left'][i] + ' corner');
      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        el.setPointerCapture(ev.pointerId);
        const move = (e) => {
          const r = alignCanvas.getBoundingClientRect();
          const nx = clamp((e.clientX - r.left) / r.width, 0, 1);
          const ny = clamp((e.clientY - r.top) / r.height, 0, 1);
          state.corners[i] = { x: nx, y: ny };
          el.style.left = nx * 100 + '%';
          el.style.top = ny * 100 + '%';
          redrawAlign();
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
      });
      handlesBox.appendChild(el);
    });
  }

  $('[data-reset-corners]').addEventListener('click', () => {
    state.corners = [
      { x: 0.06, y: 0.06 },
      { x: 0.94, y: 0.06 },
      { x: 0.94, y: 0.94 },
      { x: 0.06, y: 0.94 },
    ];
    drawAlignStage();
  });

  $('[data-rotate]').addEventListener('click', () => {
    const s = state.sourceCanvas;
    const o = document.createElement('canvas');
    o.width = s.height;
    o.height = s.width;
    const ctx = o.getContext('2d');
    ctx.translate(o.width / 2, o.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(s, -s.width / 2, -s.height / 2);
    state.sourceCanvas = o;
    drawAlignStage();
  });

  $('[data-skip-rectify]').addEventListener('click', () => {
    setBase(downscale(state.sourceCanvas, 1200));
    goto(3);
  });

  $('[data-apply-rectify]').addEventListener('click', () => {
    setBase(rectify());
    goto(3);
  });

  /** Solve an 8x8 linear system by Gaussian elimination with partial pivoting. */
  function solve8(A, b) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      let piv = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
      [A[i], A[piv]] = [A[piv], A[i]];
      [b[i], b[piv]] = [b[piv], b[i]];
      const d = A[i][i];
      if (Math.abs(d) < 1e-12) return null;
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / d;
        if (!f) continue;
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / A[i][i];
    }
    return x;
  }

  /** Perspective-correct the selected quad to a rectangle. */
  function rectify() {
    const src = state.sourceCanvas;
    const pts = state.corners.map((p) => ({ x: p.x * src.width, y: p.y * src.height }));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let W = Math.round((dist(pts[0], pts[1]) + dist(pts[3], pts[2])) / 2);
    let H = Math.round((dist(pts[0], pts[3]) + dist(pts[1], pts[2])) / 2);
    const cap = 1100;
    const k = Math.min(1, cap / Math.max(W, H));
    W = Math.max(80, Math.round(W * k));
    H = Math.max(80, Math.round(H * k));

    // homography mapping destination (u,v) -> source (x,y)
    const dst = [
      { u: 0, v: 0 },
      { u: W, v: 0 },
      { u: W, v: H },
      { u: 0, v: H },
    ];
    const A = [],
      b = [];
    for (let i = 0; i < 4; i++) {
      const { u, v } = dst[i],
        { x, y } = pts[i];
      A.push([u, v, 1, 0, 0, 0, -x * u, -x * v]);
      b.push(x);
      A.push([0, 0, 0, u, v, 1, -y * u, -y * v]);
      b.push(y);
    }
    const h = solve8(A, b);
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const octx = out.getContext('2d');
    if (!h) {
      octx.drawImage(src, 0, 0, W, H);
      return out;
    }
    const sctx = src.getContext('2d');
    const sd = sctx.getImageData(0, 0, src.width, src.height).data;
    const od = octx.createImageData(W, H);
    const sw = src.width,
      sh = src.height;
    const [a, b2, c, d, e, f, g, hh] = h;
    for (let v = 0; v < H; v++) {
      for (let u = 0; u < W; u++) {
        const den = g * u + hh * v + 1;
        const sx = (a * u + b2 * v + c) / den;
        const sy = (d * u + e * v + f) / den;
        const o = (v * W + u) * 4;
        if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
          od.data[o + 3] = 255;
          continue;
        }
        const x0 = sx | 0,
          y0 = sy | 0,
          fx = sx - x0,
          fy = sy - y0;
        const i00 = (y0 * sw + x0) * 4,
          i10 = i00 + 4,
          i01 = i00 + sw * 4,
          i11 = i01 + 4;
        for (let ch = 0; ch < 3; ch++) {
          const top = sd[i00 + ch] * (1 - fx) + sd[i10 + ch] * fx;
          const bot = sd[i01 + ch] * (1 - fx) + sd[i11 + ch] * fx;
          od.data[o + ch] = top * (1 - fy) + bot * fy;
        }
        od.data[o + 3] = 255;
      }
    }
    octx.putImageData(od, 0, 0);
    return out;
  }

  function setBase(canvas) {
    state.baseCanvas = canvas;
    const { width: w, height: h } = canvas;
    const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const g = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      g[p] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    }
    state.gray = g;
    state.claheCache = null;
  }

  /* ============================================================
     STEP 3 — CONTRAST / PSEUDO-WINDOWING
     ============================================================ */
  const workCanvas = $('[data-work-canvas]');
  let processedCanvas = null;

  $$('[data-adj]').forEach((el) => {
    el.addEventListener('input', () => {
      const key = el.dataset.adj;
      if (el.type === 'checkbox') state.adj[key] = el.checked;
      else if (key === 'gamma') state.adj.gamma = +el.value / 100;
      else state.adj[key] = +el.value;
      syncOutputs();
      render();
    });
  });

  function syncOutputs() {
    const o = (k, v) => {
      const el = $(`[data-out="${k}"]`);
      if (el) el.textContent = v;
    };
    o('brightness', state.adj.brightness);
    o('contrast', state.adj.contrast);
    o('gamma', state.adj.gamma.toFixed(2));
    o('level', state.adj.level);
    o('width', state.adj.width);
  }

  function setAdjUI() {
    $$('[data-adj]').forEach((el) => {
      const k = el.dataset.adj;
      if (el.type === 'checkbox') el.checked = !!state.adj[k];
      else if (k === 'gamma') el.value = Math.round(state.adj.gamma * 100);
      else el.value = state.adj[k];
    });
    syncOutputs();
  }

  $$('[data-preset]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const p = btn.dataset.preset;
      if (p === 'reset')
        state.adj = { brightness: 0, contrast: 0, gamma: 1, level: 128, width: 255, invert: false, mirror: state.adj.mirror, clahe: false };
      if (p === 'stroke') Object.assign(state.adj, { level: 120, width: 90, contrast: 25, gamma: 0.95, clahe: false });
      if (p === 'narrow') Object.assign(state.adj, { level: 125, width: 45, contrast: 10, gamma: 1 });
      if (p === 'invert') state.adj.invert = !state.adj.invert;
      if (p === 'clahe') state.adj.clahe = !state.adj.clahe;
      $$('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', b === btn && (p === 'invert' || p === 'clahe') ? String(p === 'invert' ? state.adj.invert : state.adj.clahe) : 'false'));
      setAdjUI();
      render();
    })
  );

  /** Contrast-limited adaptive histogram equalisation (tiled, bilinear blend). */
  function clahe(gray, w, h, tx = 8, ty = 8, clipFactor = 2.5) {
    const tw = Math.ceil(w / tx),
      th = Math.ceil(h / ty);
    const maps = [];
    for (let ty_ = 0; ty_ < ty; ty_++) {
      for (let tx_ = 0; tx_ < tx; tx_++) {
        const hist = new Float32Array(256);
        const x0 = tx_ * tw,
          y0 = ty_ * th,
          x1 = Math.min(w, x0 + tw),
          y1 = Math.min(h, y0 + th);
        let n = 0;
        for (let y = y0; y < y1; y++) {
          const row = y * w;
          for (let x = x0; x < x1; x++) {
            hist[gray[row + x]]++;
            n++;
          }
        }
        const limit = Math.max(1, (clipFactor * n) / 256);
        let excess = 0;
        for (let i = 0; i < 256; i++)
          if (hist[i] > limit) {
            excess += hist[i] - limit;
            hist[i] = limit;
          }
        const add = excess / 256;
        const map = new Uint8ClampedArray(256);
        let cum = 0;
        const total = n || 1;
        for (let i = 0; i < 256; i++) {
          cum += hist[i] + add;
          map[i] = clamp(Math.round((cum / total) * 255), 0, 255);
        }
        maps.push(map);
      }
    }
    const out = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      const gy = clamp(y / th - 0.5, 0, ty - 1);
      const y0 = Math.floor(gy),
        y1 = Math.min(ty - 1, y0 + 1),
        fy = gy - y0;
      for (let x = 0; x < w; x++) {
        const gx = clamp(x / tw - 0.5, 0, tx - 1);
        const x0 = Math.floor(gx),
          x1 = Math.min(tx - 1, x0 + 1),
          fx = gx - x0;
        const v = gray[y * w + x];
        const a = maps[y0 * tx + x0][v],
          b = maps[y0 * tx + x1][v];
        const c = maps[y1 * tx + x0][v],
          d = maps[y1 * tx + x1][v];
        out[y * w + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      }
    }
    return out;
  }

  /** Build the display LUT from window/level, brightness, contrast, gamma, invert. */
  function buildLUT() {
    const { brightness, contrast, gamma, level, width, invert } = state.adj;
    const lo = level - width / 2,
      hi = level + width / 2;
    const cf = (100 + contrast) / 100;
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      let v = ((i - lo) / (hi - lo || 1)) * 255;
      v = clamp(v, 0, 255);
      v = Math.pow(v / 255, 1 / gamma) * 255;
      v = (v - 128) * cf + 128 + brightness;
      v = clamp(v, 0, 255);
      lut[i] = invert ? 255 - v : v;
    }
    return lut;
  }

  function render() {
    if (!state.baseCanvas) return;
    const w = state.baseCanvas.width,
      h = state.baseCanvas.height;
    let g = state.gray;
    if (state.adj.clahe) {
      if (!state.claheCache) state.claheCache = clahe(state.gray, w, h);
      g = state.claheCache;
    }
    const lut = buildLUT();
    if (!processedCanvas) processedCanvas = document.createElement('canvas');
    processedCanvas.width = w;
    processedCanvas.height = h;
    const pctx = processedCanvas.getContext('2d');
    const out = pctx.createImageData(w, h);
    for (let p = 0, o = 0; p < g.length; p++, o += 4) {
      const v = lut[g[p]];
      out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
      out.data[o + 3] = 255;
    }
    pctx.putImageData(out, 0, 0);

    const maxW = Math.min(820, window.innerWidth - 56);
    const k = Math.min(1, maxW / w);
    workCanvas.width = Math.round(w * k);
    workCanvas.height = Math.round(h * k);
    const ctx = workCanvas.getContext('2d');
    ctx.save();
    if (state.adj.mirror) {
      ctx.translate(workCanvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(processedCanvas, 0, 0, workCanvas.width, workCanvas.height);
    ctx.restore();
    renderThumb();
  }

  function renderThumb() {
    const t = $('[data-thumb-canvas]');
    if (!processedCanvas || !t) return;
    const maxD = 420;
    const k = Math.min(1, maxD / Math.max(processedCanvas.width, processedCanvas.height));
    t.width = Math.round(processedCanvas.width * k);
    t.height = Math.round(processedCanvas.height * k);
    const c = t.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(processedCanvas, 0, 0, t.width, t.height);
  }

  /* ============================================================
     STEP 4 — REGION MAP + SCORING
     ============================================================ */

  /** Point on an ellipse. angle 0 = anterior (12 o'clock), increasing toward the scored side. */
  function ep(cx, cy, rx, ry, deg, sign) {
    const r = ((deg - 90) * Math.PI) / 180;
    return { x: cx + sign * rx * Math.cos(r) * -1 * -1, y: cy + ry * Math.sin(r) };
  }
  function pt(cx, cy, rx, ry, deg, sign) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + sign * rx * Math.sin(rad), y: cy - ry * Math.cos(rad) };
  }

  /** Annular sector path between two radial scale factors and two angles. */
  function sector(cx, cy, rx, ry, rOut, rIn, a0, a1, sign) {
    const step = 3;
    const pts = [];
    for (let a = a0; a <= a1 + 0.001; a += step) pts.push(pt(cx, cy, rx * rOut, ry * rOut, a, sign));
    for (let a = a1; a >= a0 - 0.001; a -= step) pts.push(pt(cx, cy, rx * rIn, ry * rIn, a, sign));
    return 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L') + 'Z';
  }
  function centroid(cx, cy, rx, ry, rOut, rIn, a0, a1, sign) {
    const rm = (rOut + rIn) / 2,
      am = (a0 + a1) / 2;
    return pt(cx, cy, rx * rm, ry * rm, am, sign);
  }

  const GEO = {
    ganglionic: [
      { id: 'M1', rOut: 1.0, rIn: 0.8, a0: 12, a1: 62 },
      { id: 'M2', rOut: 1.0, rIn: 0.8, a0: 64, a1: 118 },
      { id: 'M3', rOut: 1.0, rIn: 0.8, a0: 120, a1: 168 },
      { id: 'I', rOut: 0.72, rIn: 0.56, a0: 66, a1: 116 },
      { id: 'L', rOut: 0.5, rIn: 0.28, a0: 58, a1: 118 },
      { id: 'C', rOut: 0.4, rIn: 0.14, a0: 18, a1: 54 },
      { id: 'IC', rOut: 0.3, rIn: 0.12, a0: 104, a1: 146 },
    ],
    supra: [
      { id: 'M4', rOut: 1.0, rIn: 0.72, a0: 12, a1: 62 },
      { id: 'M5', rOut: 1.0, rIn: 0.72, a0: 64, a1: 118 },
      { id: 'M6', rOut: 1.0, rIn: 0.72, a0: 120, a1: 168 },
    ],
  };

  function buildMap(levelKey) {
    const host = $(`[data-map="${levelKey}"]`);
    const W = 300,
      H = 340,
      cx = W / 2,
      cy = H / 2,
      rx = 108,
      ry = 148;
    // radiological convention: patient's right on viewer's left
    const sign = state.side === 'left' ? 1 : -1;
    const opp = -sign;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${levelKey} level region map">`;
    svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="brain-outline"/>`;
    svg += `<line x1="${cx}" y1="${cy - ry}" x2="${cx}" y2="${cy + ry}" stroke="currentColor" stroke-opacity="0.25" stroke-width="1"/>`;
    // greyed mirror side for orientation
    GEO[levelKey].forEach((r) => {
      svg += `<path d="${sector(cx, cy, rx, ry, r.rOut, r.rIn, r.a0, r.a1, opp)}" class="brain-inert"/>`;
    });
    GEO[levelKey].forEach((r) => {
      const on = state.marked.has(r.id);
      const meta = REGIONS.find((x) => x.id === r.id);
      const c = centroid(cx, cy, rx, ry, r.rOut, r.rIn, r.a0, r.a1, sign);
      svg += `<path d="${sector(cx, cy, rx, ry, r.rOut, r.rIn, r.a0, r.a1, sign)}" class="rg" data-region="${r.id}" data-on="${on}" role="checkbox" aria-checked="${on}" tabindex="0"><title>${meta.name} — ${meta.desc}</title></path>`;
      svg += `<text class="rg-label${on ? ' on' : ''}" x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}">${r.id}</text>`;
    });
    svg += `<text class="side-tag" x="${cx - rx - 6}" y="${cy}">${state.side === 'left' ? 'R' : 'L*'}</text>`;
    svg += `<text class="side-tag" x="${cx + rx + 6}" y="${cy}">${state.side === 'left' ? 'L*' : 'R'}</text>`;
    svg += `<text class="side-tag" x="${cx}" y="${cy - ry - 6}">ANT</text>`;
    svg += `</svg>`;
    host.innerHTML = svg;
    $$('.rg', host).forEach((p) => {
      p.addEventListener('click', () => toggle(p.dataset.region));
      p.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle(p.dataset.region);
        }
      });
    });
  }

  function buildList() {
    const ul = $('[data-region-list]');
    ul.innerHTML = '';
    REGIONS.forEach((r) => {
      const on = state.marked.has(r.id);
      const li = document.createElement('li');
      li.dataset.on = String(on);
      li.dataset.region = r.id;
      li.setAttribute('role', 'checkbox');
      li.setAttribute('aria-checked', String(on));
      li.tabIndex = 0;
      li.innerHTML = `<span class="tag">${r.id}</span><span class="rname">${r.name}<small>${r.desc}</small></span><span class="state">${on ? 'Abnormal −1' : 'Normal'}</span>`;
      li.addEventListener('click', () => toggle(r.id));
      li.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle(r.id);
        }
      });
      ul.appendChild(li);
    });
  }

  function toggle(id) {
    state.marked.has(id) ? state.marked.delete(id) : state.marked.add(id);
    updateScore();
  }

  function score() {
    return 10 - state.marked.size;
  }

  const INTERP = [
    {
      b: 'Validated use',
      t: 'The only well-validated application is the binary split <strong>&lt;8 vs ≥8</strong> for general outcome prediction in patients eligible for reperfusion therapy.',
    },
    {
      b: 'Early-window EVT',
      t: 'ASPECTS ≥6 was the imaging entry criterion in most pivotal early-window thrombectomy trials, so 6 is the conventional operational threshold.',
    },
    {
      b: 'Large core',
      t: 'A low score is no longer an automatic exclusion — SELECT2, ANGEL-ASPECT and RESCUE-Japan LIMIT showed benefit in the ASPECTS 3–5 range. Do not use 6 as an absolute cut-off.',
    },
    {
      b: 'Scope',
      t: 'Score both the ganglionic and supraganglionic levels before reporting a total. ASPECTS applies to non-contrast CT in the MCA territory only.',
    },
    {
      b: 'Reliability',
      t: 'Inter-rater agreement for ASPECTS is only moderate even among experts. Treat the score as a structured description, not a measurement.',
    },
  ];

  function updateScore() {
    buildMap('ganglionic');
    buildMap('supra');
    buildList();
    const s = score();
    $('[data-score]').textContent = s;
    const n = state.marked.size;
    $('[data-score-regions]').textContent =
      n === 0 ? '0 of 10 regions abnormal' : `${n} of 10 region${n > 1 ? 's' : ''} abnormal: ${[...state.marked].join(', ')}`;
    const board = $('[data-scoreboard]');
    let label, band;
    if (s === 10) {
      label = 'No early ischaemic change marked';
      band = 'high';
    } else if (s >= 8) {
      label = 'Score ≥8 — favourable side of the validated dichotomy';
      band = 'high';
    } else if (s >= 6) {
      label = 'Score 6–7 — below the ≥8 threshold, at or above the conventional EVT cut-off';
      band = 'mid';
    } else if (s >= 3) {
      label = 'Score 3–5 — large-core range; recent trials still showed EVT benefit here';
      band = 'low';
    } else {
      label = 'Score 0–2 — extensive established infarction';
      band = 'low';
    }
    $('[data-score-label]').textContent = label;
    board.dataset.band = band;
    $('[data-interp]').innerHTML = INTERP.map((l) => `<div class="line"><b>${l.b}</b><span>${l.t}</span></div>`).join('');
  }

  $$('[data-side]').forEach((b) =>
    b.addEventListener('click', () => {
      state.side = b.dataset.side;
      $$('[data-side]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      updateScore();
    })
  );

  $('[data-clear-regions]').addEventListener('click', () => {
    state.marked.clear();
    updateScore();
  });

  /* ============================================================
     STEP 5 — REPORT
     ============================================================ */
  $$('[data-meta]').forEach((el) =>
    el.addEventListener('input', () => {
      state.meta[el.dataset.meta] = el.value;
      drawReport();
    })
  );

  function reportTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark
      ? { bg: '#14181d', card: '#1a1f25', line: '#2c333c', text: '#dfe4ea', mute: '#8d97a3', accent: '#4fc3d6', flag: '#e8a33a' }
      : { bg: '#ffffff', card: '#f4f6f8', line: '#ccd4dd', text: '#17202a', mute: '#5c6673', accent: '#0d6f80', flag: '#9c5a05' };
  }

  function drawReport() {
    const c = $('[data-report-canvas]');
    const T = reportTheme();
    const W = 1000;
    const imgBox = 380;
    const H = 1180;
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const F = (w, s) => `${w} ${s}px Satoshi, system-ui, sans-serif`;

    x.fillStyle = T.bg;
    x.fillRect(0, 0, W, H);

    // header
    x.fillStyle = T.card;
    x.fillRect(0, 0, W, 92);
    x.fillStyle = T.accent;
    x.fillRect(0, 90, W, 2);
    x.fillStyle = T.text;
    x.font = F(800, 30);
    x.fillText('ASPECTS worksheet', 40, 44);
    x.fillStyle = T.mute;
    x.font = F(400, 15);
    x.fillText('Alberta Stroke Program Early CT Score · manual reader scoring · non-contrast CT', 40, 70);
    x.textAlign = 'right';
    x.fillText(new Date().toLocaleString(), W - 40, 44);
    x.fillText('Educational / research use only', W - 40, 70);
    x.textAlign = 'left';

    let y = 130;
    // meta strip
    const meta = [
      ['Case ID', state.meta.caseId || '—'],
      ['Hemisphere', state.side === 'left' ? 'Left' : 'Right'],
      ['Level(s)', state.meta.level || '—'],
      ['Onset (h)', state.meta.onset || '—'],
      ['Reader', state.meta.reader || '—'],
    ];
    const cw = (W - 80) / meta.length;
    meta.forEach((m, i) => {
      const mx = 40 + i * cw;
      x.fillStyle = T.mute;
      x.font = F(500, 12);
      x.fillText(m[0].toUpperCase(), mx, y);
      x.fillStyle = T.text;
      x.font = F(700, 18);
      x.fillText(String(m[1]).slice(0, 22), mx, y + 24);
    });
    y += 52;
    x.strokeStyle = T.line;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(40, y);
    x.lineTo(W - 40, y);
    x.stroke();
    y += 30;

    // image
    x.fillStyle = '#05070a';
    x.fillRect(40, y, imgBox, imgBox);
    if (processedCanvas) {
      const k = Math.min(imgBox / processedCanvas.width, imgBox / processedCanvas.height);
      const iw = processedCanvas.width * k,
        ih = processedCanvas.height * k;
      x.drawImage(processedCanvas, 40 + (imgBox - iw) / 2, y + (imgBox - ih) / 2, iw, ih);
    }
    x.strokeStyle = T.line;
    x.strokeRect(40, y, imgBox, imgBox);

    // score block
    const sx = 40 + imgBox + 36;
    const s = score();
    x.fillStyle = T.card;
    x.fillRect(sx, y, W - sx - 40, 128);
    x.fillStyle = s >= 8 ? T.accent : s >= 6 ? T.flag : '#e2607a';
    x.fillRect(sx, y, 5, 128);
    x.fillStyle = T.text;
    x.font = F(900, 62);
    x.fillText(String(s), sx + 26, y + 78);
    x.fillStyle = T.mute;
    x.font = F(500, 18);
    x.fillText('/ 10', sx + 26 + x.measureText(String(s)).width + 46, y + 78);
    x.font = F(500, 14);
    x.fillStyle = T.mute;
    wrap(x, `${state.marked.size} of 10 regions marked abnormal${state.marked.size ? ': ' + [...state.marked].join(', ') : ''}`, sx + 26, y + 104, W - sx - 90, 18);

    // region table
    let ty = y + 158;
    x.fillStyle = T.mute;
    x.font = F(600, 12);
    x.fillText('REGION-BY-REGION', sx, ty);
    ty += 18;
    REGIONS.forEach((r) => {
      const on = state.marked.has(r.id);
      x.fillStyle = on ? T.flag : T.card;
      x.fillRect(sx, ty, 34, 20);
      x.fillStyle = on ? '#16110a' : T.mute;
      x.font = F(700, 12);
      x.textAlign = 'center';
      x.fillText(r.id, sx + 17, ty + 14);
      x.textAlign = 'left';
      x.fillStyle = T.text;
      x.font = F(500, 13);
      x.fillText(r.name, sx + 44, ty + 14);
      x.fillStyle = on ? T.flag : T.mute;
      x.font = F(500, 12);
      x.textAlign = 'right';
      x.fillText(on ? 'Abnormal −1' : 'Normal', W - 40, ty + 14);
      x.textAlign = 'left';
      ty += 24;
    });

    y = Math.max(y + imgBox, ty) + 34;

    // processing parameters
    x.fillStyle = T.mute;
    x.font = F(600, 12);
    x.fillText('DISPLAY PROCESSING APPLIED (photograph, not Hounsfield units)', 40, y);
    y += 20;
    x.font = F(400, 13);
    x.fillStyle = T.text;
    const a = state.adj;
    wrap(
      x,
      `Window centre ${a.level} · width ${a.width} · brightness ${a.brightness} · contrast ${a.contrast} · gamma ${a.gamma.toFixed(2)} · invert ${a.invert ? 'on' : 'off'} · local contrast (CLAHE) ${a.clahe ? 'on' : 'off'} · perspective rectification ${state.baseCanvas === state.sourceCanvas ? 'no' : 'yes'}`,
      40,
      y,
      W - 80,
      18
    );
    y += 46;

    if (state.quality) {
      const q = state.quality;
      x.fillStyle = T.mute;
      x.font = F(600, 12);
      x.fillText('PHOTOGRAPH QUALITY CHECK', 40, y);
      y += 20;
      x.fillStyle = q.grade === 'good' ? T.text : q.grade === 'borderline' ? T.flag : '#e2607a';
      x.font = F(700, 13);
      x.fillText('Grade: ' + q.grade.toUpperCase(), 40, y);
      x.fillStyle = T.mute;
      x.font = F(400, 13);
      y = wrap(x, q.checks.map((c) => c.label + ': ' + c.value + ' [' + c.status + ']').join(' \u00b7 '), 40, y + 18, W - 80, 18) + 6;
      y += 32;
    }

    if (state.meta.notes) {
      x.fillStyle = T.mute;
      x.font = F(600, 12);
      x.fillText('NOTES', 40, y);
      y += 20;
      x.fillStyle = T.text;
      x.font = F(400, 14);
      y = wrap(x, state.meta.notes, 40, y, W - 80, 20) + 26;
    }

    // interpretation
    x.fillStyle = T.mute;
    x.font = F(600, 12);
    x.fillText('INTERPRETATION NOTES', 40, y);
    y += 20;
    x.font = F(400, 13);
    INTERP.forEach((l) => {
      x.fillStyle = T.text;
      x.font = F(700, 13);
      x.fillText(l.b + ' — ', 40, y);
      const off = x.measureText(l.b + ' — ').width;
      x.fillStyle = T.mute;
      x.font = F(400, 13);
      y = wrap(x, l.t.replace(/<[^>]+>/g, ''), 40 + off, y, W - 80 - off, 18) + 22;
    });

    // footer
    const fy = H - 74;
    x.strokeStyle = T.line;
    x.beginPath();
    x.moveTo(40, fy);
    x.lineTo(W - 40, fy);
    x.stroke();
    x.fillStyle = T.mute;
    x.font = F(400, 11);
    wrap(
      x,
      'Generated by ASPECTS Scorer — a manual scoring aid. Not a medical device; no automated detection; no regulatory clearance. All image processing was performed locally in the browser. Scoring definition and the <8 vs >=8 dichotomy per MDCalc (mdcalc.com/calc/10046). Region set per Frontiers in Neurology 2016;7:245.',
      40,
      fy + 20,
      W - 80,
      15
    );
  }

  function wrap(ctx, text, x0, y0, maxW, lh) {
    const words = String(text).split(/\s+/);
    let line = '',
      y = y0;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x0, y);
        line = w;
        y += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x0, y);
    return y;
  }

  function textReport() {
    const s = score();
    const lines = [
      'ASPECTS WORKSHEET (manual reader scoring, non-contrast CT)',
      'Generated: ' + new Date().toISOString(),
      '',
      'Case ID:      ' + (state.meta.caseId || '-'),
      'Hemisphere:   ' + (state.side === 'left' ? 'Left' : 'Right'),
      'Level(s):     ' + state.meta.level,
      'Onset (h):    ' + (state.meta.onset || '-'),
      'Reader:       ' + (state.meta.reader || '-'),
      '',
      'ASPECTS: ' + s + '/10   (' + state.marked.size + ' regions abnormal)',
      'Abnormal regions: ' + (state.marked.size ? [...state.marked].join(', ') : 'none'),
      '',
      'Region detail:',
      ...REGIONS.map((r) => '  ' + r.id.padEnd(4) + r.name.padEnd(24) + (state.marked.has(r.id) ? 'ABNORMAL (-1)' : 'normal')),
      '',
      'Display processing: level ' + state.adj.level + ', width ' + state.adj.width + ', brightness ' + state.adj.brightness + ', contrast ' + state.adj.contrast + ', gamma ' + state.adj.gamma.toFixed(2) + ', invert ' + state.adj.invert + ', CLAHE ' + state.adj.clahe,
      '',
      state.quality
        ? 'Photograph quality grade: ' + state.quality.grade.toUpperCase() + '\n' + state.quality.checks.map((c) => '  ' + c.label.padEnd(22) + c.value + '  [' + c.status + ']').join('\n')
        : 'Photograph quality grade: not assessed',
      state.meta.notes ? '\nNotes: ' + state.meta.notes : '',
      '',
      'Educational / research use only. Manual scoring aid, not a medical device.',
      'No automated detection is performed. Photographs do not preserve Hounsfield units.',
    ];
    return lines.join('\n');
  }

  $('[data-copy-text]').addEventListener('click', async () => {
    const t = textReport();
    try {
      await navigator.clipboard.writeText(t);
      flash('Text report copied to clipboard.');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        flash('Text report copied.');
      } catch (e) {
        flash('Copy blocked — download the PNG or JSON instead.');
      }
      ta.remove();
    }
  });

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  $('[data-download-png]').addEventListener('click', () => {
    drawReport();
    $('[data-report-canvas]').toBlob((b) => {
      if (b) saveBlob(b, `aspects-${state.meta.caseId || 'case'}-${Date.now()}.png`);
      else flash('Export blocked in this frame — open the app in its own tab.');
    }, 'image/png');
  });

  $('[data-download-json]').addEventListener('click', () => {
    const payload = {
      tool: 'ASPECTS Scorer',
      generated: new Date().toISOString(),
      disclaimer: 'Manual scoring aid, educational/research use only. Not a medical device. No automated detection.',
      meta: state.meta,
      hemisphere: state.side,
      aspects: score(),
      abnormalRegions: [...state.marked],
      regions: REGIONS.map((r) => ({ id: r.id, name: r.name, level: r.level, abnormal: state.marked.has(r.id) })),
      displayProcessing: { ...state.adj },
      photographQuality: state.quality
        ? { grade: state.quality.grade, checks: state.quality.checks.map((c) => ({ label: c.label, value: c.value, status: c.status })), metrics: state.quality.metrics }
        : null,
    };
    saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `aspects-${state.meta.caseId || 'case'}.json`);
  });

  /* ============================================================
     BACKGROUND IMAGE TOGGLE
     ============================================================ */
  (() => {
    const btn = $('[data-bg-toggle]');
    if (!btn) return;
    let on = true;
    btn.addEventListener('click', () => {
      on = !on;
      document.documentElement.dataset.bg = on ? 'on' : 'off';
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Hide hospital background image' : 'Show hospital background image');
    });
    document.documentElement.dataset.bg = 'on';
  })();

  /* ============================================================
     TOOL SWITCHER
     ============================================================ */
  $$('[data-tool]').forEach((tab) =>
    tab.addEventListener('click', () => {
      const t = tab.dataset.tool;
      $$('[data-tool]').forEach((b) => {
        if (b === tab) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      $$('[data-tool-panel]').forEach((p) => (p.hidden = p.dataset.toolPanel !== t));
      const sticky = $('[data-sticky]');
      if (sticky) sticky.hidden = t !== 'nihss';
      if (t === 'aspects') stopCamera();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.dispatchEvent(new CustomEvent('tool:change', { detail: t }));
    })
  );

  /* ============================================================
     INIT
     ============================================================ */
  setAdjUI();
  buildList();
  updateScore();
  window.addEventListener('resize', () => {
    if (state.step === 2) drawAlignStage();
    if (state.step === 3) render();
  });
  try {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch (_) {}
})();
