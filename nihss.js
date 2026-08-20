/* =====================================================================
   Neuro App CHSC — NIHSS module
   Item wording and scoring anchors transcribed from the official NINDS
   NIH Stroke Scale (updated Feb 2024).
   ===================================================================== */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------------------------------------------------------
     ITEM DEFINITIONS
     un: true  → an "UN / untestable" choice is offered (contributes 0)
     --------------------------------------------------------------- */
  const ITEMS = [
    {
      code: '1a',
      title: 'Level of consciousness',
      instr:
        'Score 3 only if the patient makes no movement (other than reflexive posturing) in response to noxious stimulation.',
      opts: [
        [0, 'Alert; keenly responsive.'],
        [1, 'Not alert; but arousable by minor stimulation to obey, answer, or respond.'],
        [2, 'Not alert; requires repeated stimulation to attend, or is obtunded and requires strong or painful stimulation to make movements (not stereotyped).'],
        [3, 'Responds only with reflex motor or autonomic effects, or totally unresponsive, flaccid, and areflexic.'],
      ],
    },
    {
      code: '1b',
      title: 'LOC questions',
      instr:
        'Ask the current month and the patient’s age. Only the initial answer is graded. Aphasic and stuporous patients who do not comprehend score 2. Patients unable to speak because of intubation, orotracheal trauma, severe dysarthria, language barrier or any other problem not secondary to aphasia score 1.',
      opts: [
        [0, 'Answers both questions correctly.'],
        [1, 'Answers one question correctly.'],
        [2, 'Answers neither question correctly.'],
      ],
    },
    {
      code: '1c',
      title: 'LOC commands',
      instr:
        'Open and close the eyes, then grip and release the non-paretic hand. Substitute another one-step command if the hands cannot be used. Credit is given if an unequivocal attempt is made but not completed.',
      opts: [
        [0, 'Performs both tasks correctly.'],
        [1, 'Performs one task correctly.'],
        [2, 'Performs neither task correctly.'],
      ],
    },
    {
      code: '2',
      title: 'Best gaze',
      instr:
        'Test horizontal eye movements only. Voluntary or reflexive (oculocephalic) movement is scored; caloric testing is not done. Score 1 if gaze is abnormal in one or both eyes but forced deviation or total gaze paresis is absent.',
      opts: [
        [0, 'Normal.'],
        [1, 'Partial gaze palsy; gaze is abnormal in one or both eyes, but forced deviation or total gaze paresis is not present.'],
        [2, 'Forced deviation, or total gaze paresis not overcome by the oculocephalic maneuver.'],
      ],
    },
    {
      code: '3',
      title: 'Visual fields',
      instr:
        'Test upper and lower quadrants by confrontation, using finger counting or visual threat. If the patient is blind from any cause, score 3. Double simultaneous stimulation is used to detect clear-cut asymmetry.',
      opts: [
        [0, 'No visual loss.'],
        [1, 'Partial hemianopia.'],
        [2, 'Complete hemianopia.'],
        [3, 'Bilateral hemianopia (blind including cortical blindness).'],
      ],
    },
    {
      code: '4',
      title: 'Facial palsy',
      instr:
        'Ask, or use pantomime, to encourage the patient to show teeth or raise eyebrows and close eyes. Score symmetry of grimace in response to noxious stimuli in the poorly responsive or non-comprehending patient.',
      opts: [
        [0, 'Normal symmetrical movements.'],
        [1, 'Minor paralysis (flattened nasolabial fold, asymmetry on smiling).'],
        [2, 'Partial paralysis (total or near-total paralysis of lower face).'],
        [3, 'Complete paralysis of one or both sides (absence of facial movement in the upper and lower face).'],
      ],
    },
    {
      code: '5a',
      title: 'Motor — left arm',
      instr:
        'Arm at 90° (sitting) or 45° (supine). Drift is scored if the arm falls before 10 seconds. Aphasic patients are encouraged with urgency in the voice and pantomime.',
      un: true,
      opts: [
        [0, 'No drift; limb holds 90 (or 45) degrees for full 10 seconds.'],
        [1, 'Drift; limb holds 90 (or 45) degrees, but drifts down before full 10 seconds; does not hit bed or other support.'],
        [2, 'Some effort against gravity; limb cannot get to or maintain (if cued) 90 (or 45) degrees, drifts down to bed, but has some effort against gravity.'],
        [3, 'No effort against gravity; limb falls.'],
        [4, 'No movement.'],
      ],
    },
    {
      code: '5b',
      title: 'Motor — right arm',
      instr: 'Same technique as item 5a, tested on the right.',
      un: true,
      opts: [
        [0, 'No drift; limb holds 90 (or 45) degrees for full 10 seconds.'],
        [1, 'Drift; limb holds 90 (or 45) degrees, but drifts down before full 10 seconds; does not hit bed or other support.'],
        [2, 'Some effort against gravity; limb cannot get to or maintain (if cued) 90 (or 45) degrees, drifts down to bed, but has some effort against gravity.'],
        [3, 'No effort against gravity; limb falls.'],
        [4, 'No movement.'],
      ],
    },
    {
      code: '6a',
      title: 'Motor — left leg',
      instr: 'Leg at 30°, always tested supine. Drift is scored if the leg falls before 5 seconds.',
      un: true,
      opts: [
        [0, 'No drift; leg holds 30-degree position for full 5 seconds.'],
        [1, 'Drift; leg falls by the end of the 5-second period but does not hit the bed.'],
        [2, 'Some effort against gravity; leg falls to bed by 5 seconds but has some effort against gravity.'],
        [3, 'No effort against gravity; leg falls to bed immediately.'],
        [4, 'No movement.'],
      ],
    },
    {
      code: '6b',
      title: 'Motor — right leg',
      instr: 'Same technique as item 6a, tested on the right.',
      un: true,
      opts: [
        [0, 'No drift; leg holds 30-degree position for full 5 seconds.'],
        [1, 'Drift; leg falls by the end of the 5-second period but does not hit the bed.'],
        [2, 'Some effort against gravity; leg falls to bed by 5 seconds but has some effort against gravity.'],
        [3, 'No effort against gravity; leg falls to bed immediately.'],
        [4, 'No movement.'],
      ],
    },
    {
      code: '7',
      title: 'Limb ataxia',
      instr:
        'Finger-nose and heel-shin, tested with eyes open, on both sides. Ataxia is scored only if present out of proportion to weakness. Score absent in the patient who cannot understand or is hemiplegic.',
      un: true,
      opts: [
        [0, 'Absent.'],
        [1, 'Present in one limb.'],
        [2, 'Present in two limbs.'],
      ],
    },
    {
      code: '8',
      title: 'Sensory',
      instr:
        'Pinprick to face, arm, trunk and leg, or grimace / withdrawal in the obtunded patient. Only sensory loss attributable to the stroke is scored. Score 2 only for clear-cut severe or total loss.',
      opts: [
        [0, 'Normal; no sensory loss.'],
        [1, 'Mild-to-moderate sensory loss; patient feels pinprick is less sharp or is dull on the affected side; or there is a loss of superficial pain with pinprick, but patient is aware of being touched.'],
        [2, 'Severe or total sensory loss; patient is not aware of being touched in the face, arm, and leg.'],
      ],
    },
    {
      code: '9',
      title: 'Best language',
      instr:
        'Ask the patient to describe the picture, name the items on the naming sheet and read the sentences. Comprehension is judged from all responses in the preceding examination. The intubated patient should be asked to write.',
      opts: [
        [0, 'No aphasia; normal.'],
        [1, 'Mild-to-moderate aphasia; some obvious loss of fluency or facility of comprehension, without significant limitation on ideas expressed or form of expression.'],
        [2, 'Severe aphasia; all communication is through fragmentary expression; great need for inference, questioning, and guessing by the listener.'],
        [3, 'Mute, global aphasia; no usable speech or auditory comprehension.'],
      ],
    },
    {
      code: '10',
      title: 'Dysarthria',
      instr:
        'Have the patient read or repeat words from the list. Do not tell the patient why he or she is being tested.',
      un: true,
      opts: [
        [0, 'Normal.'],
        [1, 'Mild-to-moderate dysarthria; patient slurs at least some words and, at worst, can be understood with some difficulty.'],
        [2, 'Severe dysarthria; patient’s speech is so slurred as to be unintelligible in the absence of or out of proportion to any dysphasia, or is mute/anarthric.'],
      ],
    },
    {
      code: '11',
      title: 'Extinction and inattention',
      instr:
        'Sufficient information to identify neglect may already have been obtained. If the patient has severe visual loss but sensation is normal, the score is 0. Score the abnormality only if present.',
      opts: [
        [0, 'No abnormality.'],
        [1, 'Visual, tactile, auditory, spatial, or personal inattention, or extinction to bilateral simultaneous stimulation in one of the sensory modalities.'],
        [2, 'Profound hemi-inattention or extinction to more than one modality; does not recognize own hand or orients to only one side of space.'],
      ],
    },
  ];

  const UN_LABEL = 'UN — untestable (amputation, joint fusion, intubation or other physical barrier). Contributes 0 and is flagged.';

  const state = {
    answers: {}, // code -> number | 'UN'
    meta: { caseId: '', when: '', onset: '', examiner: '', notes: '' },
  };

  /* ---------------------------------------------------------------
     RENDER ITEMS
     --------------------------------------------------------------- */
  const host = $('[data-nihss-items]');

  function build() {
    host.innerHTML = '';
    ITEMS.forEach((it) => {
      const card = document.createElement('section');
      card.className = 'nitem';
      card.dataset.item = it.code;
      const opts = it.opts.slice();
      const grid = opts.length > 3 ? ' grid2' : '';
      card.innerHTML = `
        <div class="nitem-head">
          <span class="nitem-code">${it.code}</span>
          <h3 class="nitem-title">${it.title}</h3>
          <span class="nitem-pts" data-pts>—</span>
        </div>
        <p class="nitem-instr">${it.instr}</p>
        <div class="nopts${grid}" role="radiogroup" aria-label="Item ${it.code} ${it.title}">
          ${opts
            .map(
              ([v, t]) =>
                `<button type="button" class="nopt" role="radio" aria-checked="false" data-val="${v}"><b>${v}</b><span>${t}</span></button>`
            )
            .join('')}
          ${
            it.un
              ? `<button type="button" class="nopt un" role="radio" aria-checked="false" data-val="UN"><b>UN</b><span>${UN_LABEL}</span></button>`
              : ''
          }
        </div>`;
      $$('.nopt', card).forEach((b) =>
        b.addEventListener('click', () => {
          const raw = b.dataset.val;
          const val = raw === 'UN' ? 'UN' : +raw;
          if (state.answers[it.code] === val) delete state.answers[it.code];
          else state.answers[it.code] = val;
          paintItem(it, card);
          update();
        })
      );
      host.appendChild(card);
      paintItem(it, card);
    });
  }

  function paintItem(it, card) {
    const val = state.answers[it.code];
    const answered = val !== undefined;
    card.dataset.answered = String(answered);
    $('[data-pts]', card).textContent = answered ? (val === 'UN' ? 'UN' : '+' + val) : '—';
    $$('.nopt', card).forEach((b) => {
      const raw = b.dataset.val;
      const v = raw === 'UN' ? 'UN' : +raw;
      b.setAttribute('aria-checked', String(answered && v === val));
    });
  }

  /* ---------------------------------------------------------------
     SCORING
     --------------------------------------------------------------- */
  function total() {
    return ITEMS.reduce((s, it) => {
      const v = state.answers[it.code];
      return s + (typeof v === 'number' ? v : 0);
    }, 0);
  }
  const answeredCount = () => ITEMS.filter((it) => state.answers[it.code] !== undefined).length;
  const untestable = () => ITEMS.filter((it) => state.answers[it.code] === 'UN').map((it) => it.code);
  const complete = () => answeredCount() === ITEMS.length;

  function band(s) {
    if (s === 0) return { label: 'No stroke symptoms', short: 'No stroke symptoms', tone: 'high' };
    if (s <= 4) return { label: 'Minor stroke', short: 'Minor (1–4)', tone: 'high' };
    if (s <= 15) return { label: 'Moderate stroke', short: 'Moderate (5–15)', tone: 'mid' };
    if (s <= 20) return { label: 'Moderate to severe stroke', short: 'Moderate–severe (16–20)', tone: 'low' };
    return { label: 'Severe stroke', short: 'Severe (21–42)', tone: 'low' };
  }

  const INTERP = [
    {
      b: 'Severity strata',
      t: '0 = no stroke symptoms · 1–4 minor · 5–15 moderate · 16–20 moderate to severe · 21–42 severe. These bands are descriptive conventions, not treatment thresholds.',
    },
    {
      b: 'A low score does not exclude stroke',
      t: 'Posterior circulation and small lacunar infarcts can score 0–2 while still causing disabling deficits. Basilar occlusion may present with a near-normal score.',
    },
    {
      b: 'Hemispheric asymmetry',
      t: 'The scale weights left-hemisphere (language) deficits more heavily than right-hemisphere (neglect) deficits, so an equivalent infarct volume scores lower on the right.',
    },
    {
      b: 'Use serially',
      t: 'The value of the NIHSS is in the trend — baseline, post-thrombolysis, 24 hours, and at any neurological change. A rise of ≥4 points is the conventional definition of early deterioration.',
    },
    {
      b: 'Administration',
      t: 'Administer items in the given order, record the first response, do not go back and change scores, and do not coach. Untestable items contribute 0 and must be reported as UN rather than as a normal score.',
    },
  ];

  function update() {
    const s = total();
    const b = band(s);
    const a = answeredCount();
    const un = untestable();

    $('[data-nscore]').textContent = s;
    $('[data-nlabel]').textContent = complete()
      ? `${b.label} — full 15-item assessment recorded`
      : `${b.label} — provisional, ${ITEMS.length - a} item${ITEMS.length - a === 1 ? '' : 's'} still unscored`;
    $('[data-nprogress]').textContent =
      `${a} of ${ITEMS.length} items scored` + (un.length ? ` · untestable: ${un.join(', ')}` : '');
    $('[data-nscoreboard]').dataset.band = b.tone;

    const st = $('[data-sticky-score]');
    if (st) st.textContent = s;
    const sb = $('[data-sticky-band]');
    if (sb) sb.textContent = complete() ? b.short : b.short + ' · provisional';

    $('[data-ninterp]').innerHTML = INTERP.map(
      (l) => `<div class="line"><b>${l.b}</b><span>${l.t}</span></div>`
    ).join('');

    drawReport();
  }

  /* ---------------------------------------------------------------
     META
     --------------------------------------------------------------- */
  $$('[data-nmeta]').forEach((el) =>
    el.addEventListener('input', () => {
      state.meta[el.dataset.nmeta] = el.value;
      drawReport();
    })
  );

  /* ---------------------------------------------------------------
     PNG REPORT
     --------------------------------------------------------------- */
  function theme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark
      ? { bg: '#14181d', card: '#1a1f25', line: '#2c333c', text: '#dfe4ea', mute: '#8d97a3', accent: '#4fc3d6', flag: '#e8a33a', danger: '#e2607a', ink: '#0e1114' }
      : { bg: '#ffffff', card: '#f4f6f8', line: '#ccd4dd', text: '#17202a', mute: '#5c6673', accent: '#0d6f80', flag: '#9c5a05', danger: '#b23350', ink: '#ffffff' };
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

  function drawReport() {
    const c = $('[data-nreport-canvas]');
    if (!c) return;
    const T = theme();
    const W = 1000;
    const rowH = 26;
    const H = 300 + ITEMS.length * rowH + 300;
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
    x.fillText('NIH Stroke Scale worksheet', 40, 44);
    x.fillStyle = T.mute;
    x.font = F(400, 15);
    x.fillText('Neuro App CHSC · 15 items · total 0–42 · item wording per NINDS (Feb 2024)', 40, 70);
    x.textAlign = 'right';
    x.font = F(400, 15);
    x.fillText(state.meta.when || new Date().toLocaleString(), W - 40, 44);
    x.fillText('Educational / research use only', W - 40, 70);
    x.textAlign = 'left';

    let y = 130;
    const meta = [
      ['Case ID', state.meta.caseId || '—'],
      ['Onset (h)', state.meta.onset || '—'],
      ['Examiner', state.meta.examiner || '—'],
      ['Items scored', `${answeredCount()} / ${ITEMS.length}`],
    ];
    const cw = (W - 80) / meta.length;
    meta.forEach((m, i) => {
      const mx = 40 + i * cw;
      x.fillStyle = T.mute;
      x.font = F(500, 12);
      x.fillText(m[0].toUpperCase(), mx, y);
      x.fillStyle = T.text;
      x.font = F(700, 18);
      x.fillText(String(m[1]).slice(0, 24), mx, y + 24);
    });
    y += 54;
    x.strokeStyle = T.line;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(40, y);
    x.lineTo(W - 40, y);
    x.stroke();
    y += 28;

    // score block
    const s = total();
    const b = band(s);
    const blockH = 108;
    x.fillStyle = T.card;
    x.fillRect(40, y, W - 80, blockH);
    x.fillStyle = b.tone === 'high' ? T.accent : b.tone === 'mid' ? T.flag : T.danger;
    x.fillRect(40, y, 5, blockH);
    x.fillStyle = T.text;
    x.font = F(900, 58);
    x.fillText(String(s), 70, y + 66);
    const numW = x.measureText(String(s)).width;
    x.fillStyle = T.mute;
    x.font = F(500, 18);
    x.fillText('/ 42', 70 + numW + 14, y + 66);
    x.fillStyle = T.text;
    x.font = F(700, 20);
    x.fillText(b.label, 70 + numW + 90, y + 46);
    x.fillStyle = T.mute;
    x.font = F(400, 14);
    x.fillText(
      complete() ? 'All 15 items recorded.' : `Provisional — ${ITEMS.length - answeredCount()} item(s) unscored.`,
      70 + numW + 90,
      y + 72
    );
    y += blockH + 30;

    // item table
    x.fillStyle = T.mute;
    x.font = F(600, 12);
    x.fillText('ITEM-BY-ITEM', 40, y);
    y += 18;
    ITEMS.forEach((it) => {
      const v = state.answers[it.code];
      const isUN = v === 'UN';
      const done = v !== undefined;
      x.fillStyle = isUN ? T.flag : done ? T.accent : T.card;
      x.fillRect(40, y, 40, 20);
      x.fillStyle = isUN ? '#16110a' : done ? T.ink : T.mute;
      x.font = F(700, 12);
      x.textAlign = 'center';
      x.fillText(it.code, 60, y + 14);
      x.textAlign = 'left';
      x.fillStyle = T.text;
      x.font = F(500, 13);
      x.fillText(it.title, 92, y + 14);
      x.fillStyle = isUN ? T.flag : done ? T.text : T.mute;
      x.font = F(600, 13);
      x.textAlign = 'right';
      x.fillText(done ? (isUN ? 'UN (0)' : String(v)) : 'not scored', W - 40, y + 14);
      x.textAlign = 'left';
      x.strokeStyle = T.line;
      x.beginPath();
      x.moveTo(40, y + 23);
      x.lineTo(W - 40, y + 23);
      x.stroke();
      y += rowH;
    });
    y += 22;

    const un = untestable();
    if (un.length) {
      x.fillStyle = T.flag;
      x.font = F(600, 13);
      y = wrap(x, `Untestable items (scored 0 in the total): ${un.join(', ')}`, 40, y, W - 80, 18) + 24;
    }

    if (state.meta.notes) {
      x.fillStyle = T.mute;
      x.font = F(600, 12);
      x.fillText('CLINICAL NOTES', 40, y);
      y += 20;
      x.fillStyle = T.text;
      x.font = F(400, 14);
      y = wrap(x, state.meta.notes, 40, y, W - 80, 20) + 26;
    }

    x.fillStyle = T.mute;
    x.font = F(600, 12);
    x.fillText('INTERPRETATION NOTES', 40, y);
    y += 20;
    INTERP.forEach((l) => {
      x.fillStyle = T.text;
      x.font = F(700, 13);
      x.fillText(l.b + ' — ', 40, y);
      const off = x.measureText(l.b + ' — ').width;
      x.fillStyle = T.mute;
      x.font = F(400, 13);
      y = wrap(x, l.t, 40 + off, y, W - 80 - off, 18) + 22;
    });

    y += 12;
    x.strokeStyle = T.line;
    x.beginPath();
    x.moveTo(40, y);
    x.lineTo(W - 40, y);
    x.stroke();
    y += 20;
    x.fillStyle = T.mute;
    x.font = F(400, 11);
    wrap(
      x,
      'Generated by Neuro App CHSC. Manual clinician-entered assessment; the app performs arithmetic and formatting only. Not a medical device, no regulatory clearance. Item wording from the official NINDS NIH Stroke Scale (updated Feb 2024); severity strata per published NIHSS categories (PMC6950922).',
      40,
      y,
      W - 80,
      15
    );

    // trim any unused vertical space
    const used = Math.min(H, y + 60);
    if (used < H - 40) {
      const img = x.getImageData(0, 0, W, used);
      c.height = used;
      c.getContext('2d').putImageData(img, 0, 0);
    }
  }

  /* ---------------------------------------------------------------
     EXPORTS
     --------------------------------------------------------------- */
  function status(msg) {
    const el = $('[data-nstatus]');
    if (!el) return;
    el.textContent = msg;
    setTimeout(() => (el.textContent = ''), 3200);
  }

  function textReport() {
    const s = total();
    const b = band(s);
    const un = untestable();
    return [
      'NIH STROKE SCALE WORKSHEET (clinician-entered)',
      'Generated: ' + new Date().toISOString(),
      '',
      'Case ID:      ' + (state.meta.caseId || '-'),
      'Assessed:     ' + (state.meta.when || new Date().toLocaleString()),
      'Onset (h):    ' + (state.meta.onset || '-'),
      'Examiner:     ' + (state.meta.examiner || '-'),
      '',
      'NIHSS TOTAL: ' + s + '/42   (' + b.label + ')',
      complete() ? 'All 15 items recorded.' : 'PROVISIONAL — ' + (ITEMS.length - answeredCount()) + ' item(s) unscored.',
      un.length ? 'Untestable (scored 0): ' + un.join(', ') : '',
      '',
      'Item detail:',
      ...ITEMS.map((it) => {
        const v = state.answers[it.code];
        const val = v === undefined ? 'not scored' : v === 'UN' ? 'UN (0)' : String(v);
        return '  ' + it.code.padEnd(4) + it.title.padEnd(28) + val;
      }),
      state.meta.notes ? '\nNotes: ' + state.meta.notes : '',
      '',
      'Severity strata: 0 none · 1-4 minor · 5-15 moderate · 16-20 moderate-severe · 21-42 severe.',
      'A low score does not exclude stroke. Item wording per NINDS NIH Stroke Scale (Feb 2024).',
      'Educational / research use only. Not a medical device.',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }

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

  $('[data-nclear]').addEventListener('click', () => {
    state.answers = {};
    build();
    update();
    status('All items reset.');
  });

  $('[data-ncopy]').addEventListener('click', async () => {
    const t = textReport();
    try {
      await navigator.clipboard.writeText(t);
      status('Text report copied to clipboard.');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        status('Text report copied.');
      } catch (e) {
        status('Copy blocked in this frame — download the PNG or JSON instead.');
      }
      ta.remove();
    }
  });

  $('[data-njson]').addEventListener('click', () => {
    const payload = {
      tool: 'Neuro App CHSC — NIHSS',
      generated: new Date().toISOString(),
      disclaimer:
        'Clinician-entered assessment. Educational/research use only. Not a medical device.',
      meta: state.meta,
      total: total(),
      severity: band(total()).label,
      complete: complete(),
      untestableItems: untestable(),
      items: ITEMS.map((it) => ({
        code: it.code,
        title: it.title,
        value: state.answers[it.code] === undefined ? null : state.answers[it.code],
      })),
      reference: 'https://www.ninds.nih.gov/sites/default/files/documents/NIH-Stroke-Scale_updatedFeb2024_508.pdf',
    };
    saveBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `nihss-${state.meta.caseId || 'case'}.json`
    );
    status('JSON downloaded.');
  });

  $('[data-npng]').addEventListener('click', () => {
    drawReport();
    $('[data-nreport-canvas]').toBlob((blob) => {
      if (blob) saveBlob(blob, `nihss-${state.meta.caseId || 'case'}-${Date.now()}.png`);
      else status('Export blocked in this frame — open the app in its own tab.');
    }, 'image/png');
  });

  const jump = $('[data-jump-report]');
  if (jump)
    jump.addEventListener('click', () => {
      const el = $('[data-nreport-canvas]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

  document.addEventListener('theme:change', drawReport);

  /* ---------------------------------------------------------------
     INIT
     --------------------------------------------------------------- */
  build();
  update();
})();
