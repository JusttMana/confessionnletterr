(() => {
  'use strict';

  // ===== DOM References =====
  const screens = {
    letter1: document.getElementById('letter-screen-1'),
    letter2: document.getElementById('letter-screen-2'),
    final: document.getElementById('final-screen'),
    close: document.getElementById('close-screen'),
  };

  const continueBtn1 = document.getElementById('continue-btn-1');
  const continueBtn2 = document.getElementById('continue-btn-2');
  const readAgainBtn = document.getElementById('read-again-btn');
  const closeLetterBtn = document.getElementById('close-letter-btn');
  const musicToggle = document.getElementById('music-toggle');
  const bgMusic = document.getElementById('bg-music');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let transitioning = false;
  let typingTimer;
  let typingParagraphs = [];

  const wait = duration => new Promise(resolve => setTimeout(resolve, duration));
  const afterMotion = (...elements) => Promise.allSettled(elements.flatMap(element =>
    element.getAnimations().map(animation => animation.finished)
  ));

  // ===== Typing Animation =====
  function prepareTyping(screen) {
    const nav = screen.querySelector('.letter-nav');
    nav.classList.toggle('visible', reducedMotion.matches);
    if (reducedMotion.matches) return;

    const lines = screen.querySelectorAll('.greeting, .letter-body p, .letter-signoff > span');
    typingParagraphs = Array.from(lines, paragraph => {
      const text = paragraph.textContent;
      const readable = document.createElement('span');
      readable.className = 'sr-only';
      readable.textContent = text;

      const visual = document.createElement('span');
      visual.setAttribute('aria-hidden', 'true');
      const written = document.createElement('span');
      written.className = 'typing-written';
      const unwritten = document.createElement('span');
      unwritten.className = 'typing-unwritten';
      unwritten.textContent = text;
      visual.append(written, unwritten);
      paragraph.replaceChildren(readable, visual);

      return { paragraph, text, written, unwritten };
    });
  }

  function queueTyping(nav, delay) {
    if (reducedMotion.matches) {
      finishTyping(nav);
    } else {
      typingTimer = setTimeout(() => startTyping(nav), delay);
    }
  }

  function finishTyping(nav) {
    const skipHadFocus = nav.querySelector('.typing-skip') === document.activeElement;
    stopTyping();
    nav.classList.add('visible');
    if (skipHadFocus) nav.querySelector('.btn').focus({ preventScroll: true });
  }

  function startTyping(nav) {
    let paragraphIndex = 0;

    function typeParagraph() {
      if (paragraphIndex === typingParagraphs.length) {
        finishTyping(nav);
        return;
      }

      const { paragraph, text, written, unwritten } = typingParagraphs[paragraphIndex++];
      const isSignature = paragraph.classList.contains('letter-signature');
      const isSignoff = paragraph.classList.contains('letter-signoff-label');
      const characters = Array.from(text);
      let characterIndex = 0;
      let offset = 0;
      written.classList.add('is-typing');

      function typeCharacter() {
        if (characterIndex === characters.length) {
          written.classList.remove('is-typing');
          typeParagraph();
          return;
        }

        const character = characters[characterIndex++];
        offset += character.length;
        written.textContent = text.slice(0, offset);
        unwritten.textContent = text.slice(offset);

        let delay = isSignature ? 175 : 61;
        if (characterIndex === characters.length) delay = isSignoff ? 850 : 520;
        else if (/[.!?]/.test(character)) delay = 310;
        else if (/[,;:]/.test(character)) delay = 145;
        else if (character === ' ') delay = 32;

        typingTimer = setTimeout(typeCharacter, delay);
      }

      typeCharacter();
    }

    typeParagraph();
  }

  function stopTyping() {
    clearTimeout(typingTimer);
    typingParagraphs.forEach(({ paragraph, text }) => {
      paragraph.textContent = text;
    });
    typingParagraphs = [];
  }

  // ===== Screen Navigation =====
  function showScreen(screenKey) {
    if (transitioning) return;
    transitioning = true;

    stopTyping();

    const current = document.querySelector('.screen.active');
    const next = screens[screenKey];

    if (reducedMotion.matches) {
      current?.classList.remove('active');
      activateScreen(next);
      return;
    }

    if (current) {
      current.style.opacity = '0';
      current.style.transform = 'translateY(10px)';
      setTimeout(() => {
        current.classList.remove('active');
        current.style.opacity = '';
        current.style.transform = '';
        activateScreen(next);
      }, 400);
    } else {
      activateScreen(next);
    }
  }

  function activateScreen(screen) {
    const nav = screen.querySelector('.letter-nav');
    if (nav) prepareTyping(screen);

    screen.classList.add('active');
    if (reducedMotion.matches) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (nav) screen.focus({ preventScroll: true });
      transitioning = false;
      return;
    }

    screen.style.opacity = '0';
    screen.style.transform = 'translateY(12px)';

    // Force reflow
    screen.offsetHeight;

    screen.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    screen.style.opacity = '1';
    screen.style.transform = 'translateY(0)';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      screen.style.transition = '';
      screen.style.opacity = '';
      screen.style.transform = '';
      if (nav) {
        screen.focus({ preventScroll: true });
        queueTyping(nav, 200);
      }
      transitioning = false;
    }, 650);
  }

  async function turnPage(currentKey, nextKey) {
    if (transitioning) return;
    if (reducedMotion.matches) {
      showScreen(nextKey);
      return;
    }

    transitioning = true;
    stopTyping();

    const current = screens[currentKey];
    const next = screens[nextKey];
    const frontPaper = current.querySelector('.letter-paper');
    const backPaper = next.querySelector('.letter-paper');
    const corner = current.querySelector('.page-corner');
    const nav = next.querySelector('.letter-nav');

    prepareTyping(next);
    current.inert = true;
    next.inert = true;
    next.classList.add('active', 'is-underneath');
    const stackBottom = Math.min(frontPaper.getBoundingClientRect().bottom + 4, window.innerHeight - 8);
    const offset = stackBottom - backPaper.getBoundingClientRect().bottom;
    const stackedPosition = `translateY(${offset}px)`;
    backPaper.style.transform = stackedPosition;
    current.classList.add('is-page-turning');

    frontPaper.classList.add('is-corner-opening');
    await afterMotion(corner);

    frontPaper.classList.add('is-page-lifting');
    await afterMotion(frontPaper);

    current.classList.remove('active', 'is-page-turning');
    current.inert = false;
    frontPaper.classList.remove('is-corner-opening', 'is-page-lifting');
    next.classList.remove('is-underneath');
    backPaper.style.transform = '';
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (offset && !reducedMotion.matches) {
      const settle = backPaper.animate([
        { transform: stackedPosition },
        { transform: 'translateY(0)' }
      ], { duration: 390, easing: 'cubic-bezier(0.22, 0.8, 0.3, 1)' });
      await Promise.allSettled([settle.finished]);
    }

    next.inert = false;
    next.focus({ preventScroll: true });
    queueTyping(nav, 200);
    transitioning = false;
  }

  async function closeLetter() {
    if (transitioning) return;
    transitioning = true;

    const final = screens.final;
    const close = screens.close;
    const animate = !reducedMotion.matches;
    final.inert = true;

    if (animate) {
      final.classList.add('is-closing');
      await afterMotion(final.querySelector('.letter-paper'));
    }

    final.classList.remove('active', 'is-closing');
    final.inert = false;
    close.classList.toggle('is-sealing', animate);
    close.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (animate) await afterMotion(close.querySelector('.close-container'));

    close.classList.remove('is-sealing');
    close.focus({ preventScroll: true });
    transitioning = false;
  }

  // ===== Navigation Buttons =====
  continueBtn1.addEventListener('click', () => turnPage('letter1', 'letter2'));
  continueBtn2.addEventListener('click', () => turnPage('letter2', 'final'));
  readAgainBtn.addEventListener('click', () => showScreen('letter1'));
  closeLetterBtn.addEventListener('click', closeLetter);
  document.querySelectorAll('.typing-skip').forEach(button => {
    button.addEventListener('click', () => finishTyping(button.closest('.letter-nav')));
  });

  // ===== Music =====
  function playMusic() {
    bgMusic.play().catch(updateMusicIcon);
  }

  function toggleMusic() {
    if (bgMusic.paused) {
      playMusic();
    } else {
      bgMusic.pause();
    }
  }

  function updateMusicIcon() {
    const musicPlaying = !bgMusic.paused;
    musicToggle.textContent = musicPlaying ? '🎵' : '🔇';
    musicToggle.setAttribute('aria-label', musicPlaying ? 'Pause music' : 'Play music');
  }

  bgMusic.volume = 0.25;
  bgMusic.addEventListener('play', updateMusicIcon);
  bgMusic.addEventListener('pause', updateMusicIcon);
  bgMusic.addEventListener('error', () => { musicToggle.hidden = true; }, true);
  musicToggle.addEventListener('click', toggleMusic);

  // ===== Floating Hearts =====
  function createFloatingHearts() {
    const container = document.getElementById('floating-hearts');
    const hearts = ['♥', '♡', '❤', '💕'];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const heart = document.createElement('span');
      heart.classList.add('heart');
      heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      heart.style.left = Math.random() * 100 + '%';
      heart.style.fontSize = (0.6 + Math.random() * 0.8) + 'rem';
      heart.style.animationDuration = (15 + Math.random() * 20) + 's';
      heart.style.animationDelay = (Math.random() * 20) + 's';
      container.appendChild(heart);
    }
  }

  // ===== Sparkle Decorations =====
  function createSparkles() {
    const sparkles = ['✦', '✧', '·', '✨'];
    const count = 8;

    for (let i = 0; i < count; i++) {
      const sparkle = document.createElement('span');
      sparkle.classList.add('sparkle');
      sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
      sparkle.style.left = Math.random() * 100 + '%';
      sparkle.style.top = Math.random() * 100 + '%';
      document.body.appendChild(sparkle);
    }
  }

  // ===== Archery: shoot the envelope open =====
  // Hold the bow, drag back to draw the string (the arrow points the opposite
  // way you pull, like a real bow), and let go. Hit 1 shakes the envelope,
  // hit 2 opens it and slides the letter out.
  const envelopeScreen = document.getElementById('envelope-screen');
  const canvas = document.getElementById('archery-canvas');
  const ctx = canvas.getContext('2d');
  const envelopeEl = document.getElementById('envelope');
  const bowZone = document.getElementById('bow-zone');
  const aimHint = document.getElementById('aim-hint');

  const ARROW_LENGTH = 120;
  const STRING_REST = 30;           // string distance behind the grip at rest
  const MAX_PULL = 84;              // px the string can be drawn back
  const MIN_PULL = 16;              // shorter draws don't fire
  const MAX_ANGLE = (78 * Math.PI) / 180;
  const GRAVITY = 1100;             // px/s², a gentle arc
  const MIN_SPEED = 620;
  const MAX_SPEED = 1900;
  const GRAB_RADIUS = 140;
  const HITS_TO_OPEN = 2;
  const RELOAD_MS = 380;
  const KEY_DRAW_MS = 900;

  const HINTS = {
    idle: 'Hold the bow, pull back to aim, then let go.',
    drawing: 'Aim for the envelope…',
    tooShort: 'Pull the string back a little further, then let go.',
    grab: 'Grab the bow down here first ↓',
    firstHit: 'It moved! One more shot…',
    open: 'There it is ♥',
    misses: [
      'So close — try again ♡',
      'Almost! Take a breath and aim again.',
      'Missed… you’ve got this ♡',
    ],
  };

  const STUCK_ARROW_SVG =
    '<svg viewBox="0 0 20 120" width="20" height="120" aria-hidden="true">' +
    '<ellipse cx="10" cy="16" rx="5.5" ry="2.2" fill="rgba(92,61,46,0.35)"/>' +
    '<line x1="10" y1="15" x2="10" y2="117" stroke="#9C6B47" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M10 92 Q1 100 2 116 L10 112 Z" fill="#E8A0B4"/>' +
    '<path d="M10 92 Q19 100 18 116 L10 112 Z" fill="#D4849A"/>' +
    '<rect x="8" y="116" width="4" height="4" rx="1" fill="#C4525A"/>' +
    '</svg>';

  const game = {
    width: 0,
    height: 0,
    dpr: 1,
    anchor: { x: 0, y: 0 },
    angle: 0,
    pull: 0,
    drawing: false,
    pointerId: null,
    start: null,
    keyDrawing: false,
    keyDrawStart: 0,
    ready: true,
    nockedAt: 0,
    flight: null,
    twangAt: 0,
    twangAmp: 0,
    hits: 0,
    misses: 0,
    done: false,
    interacted: false,
    focused: false,
    running: true,
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function setHint(text, nudge) {
    aimHint.textContent = text;
    if (nudge) {
      aimHint.classList.remove('nudge');
      void aimHint.offsetWidth;
      aimHint.classList.add('nudge');
    }
  }

  // ----- Geometry -----
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    game.dpr = Math.min(window.devicePixelRatio || 1, 2);
    game.width = rect.width;
    game.height = rect.height;
    canvas.width = Math.round(rect.width * game.dpr);
    canvas.height = Math.round(rect.height * game.dpr);
    const zone = bowZone.getBoundingClientRect();
    game.anchor.x = zone.left - rect.left + zone.width / 2;
    game.anchor.y = zone.top - rect.top + Math.min(60, zone.height * 0.32);
  }

  // Bow-local coordinates (aim direction is "up", -y) to canvas coordinates.
  function toWorld(lx, ly) {
    const s = Math.sin(game.angle);
    const c = Math.cos(game.angle);
    return { x: game.anchor.x + lx * c - ly * s, y: game.anchor.y + lx * s + ly * c };
  }

  function aimDir() {
    return { x: Math.sin(game.angle), y: -Math.cos(game.angle) };
  }

  function posAt(p0, v0, t) {
    return { x: p0.x + v0.x * t, y: p0.y + v0.y * t + 0.5 * GRAVITY * t * t };
  }

  function velAt(v0, t) {
    return { x: v0.x, y: v0.y + GRAVITY * t };
  }

  function shotParams(pull) {
    const power = pull / MAX_PULL;
    const speed = MIN_SPEED + power * (MAX_SPEED - MIN_SPEED);
    const dir = aimDir();
    return {
      p0: toWorld(0, STRING_REST + pull - ARROW_LENGTH),
      v0: { x: dir.x * speed, y: dir.y * speed },
    };
  }

  function envelopeTarget() {
    const er = envelopeEl.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const inset = 3;
    return {
      left: er.left - cr.left + inset,
      top: er.top - cr.top + inset,
      right: er.right - cr.left - inset,
      bottom: er.bottom - cr.top - inset,
    };
  }

  // The flight path is deterministic, so the outcome is known on release.
  function traceShot(p0, v0) {
    const target = envelopeTarget();
    const step = 1 / 600;
    for (let t = step; t < 3; t += step) {
      const p = posAt(p0, v0, t);
      if (p.x >= target.left && p.x <= target.right && p.y >= target.top && p.y <= target.bottom) {
        return { hit: true, t, x: p.x, y: p.y };
      }
      if (p.x < -160 || p.x > game.width + 160 || p.y > game.height + 160 || p.y < -800) {
        return { hit: false, t };
      }
    }
    return { hit: false, t: 3 };
  }

  // ----- Input -----
  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function nearBow(p) {
    const grip = toWorld(0, STRING_REST * 0.6);
    return Math.hypot(p.x - grip.x, p.y - grip.y) < GRAB_RADIUS;
  }

  function canDraw() {
    return !game.done && game.ready && !game.flight && !game.drawing && !game.keyDrawing;
  }

  function updateAim(dx, dy) {
    if (Math.hypot(dx, dy) > 10) {
      // Arrow points opposite the pull: angle measured from straight up.
      game.angle = clamp(Math.atan2(-dx, dy), -MAX_ANGLE, MAX_ANGLE);
    }
    const back = { x: -Math.sin(game.angle), y: Math.cos(game.angle) };
    game.pull = clamp(dx * back.x + dy * back.y, 0, MAX_PULL);
  }

  function onPointerDown(e) {
    if (!canDraw()) return;
    const p = pointerPos(e);
    if (!nearBow(p)) {
      setHint(HINTS.grab, true);
      return;
    }
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    game.drawing = true;
    game.pointerId = e.pointerId;
    game.start = p;
    game.pull = 0;
    game.interacted = true;
    canvas.style.cursor = 'grabbing';
    setHint(HINTS.drawing);
  }

  function onPointerMove(e) {
    const p = pointerPos(e);
    if (!game.drawing) {
      canvas.style.cursor = canDraw() && nearBow(p) ? 'grab' : '';
      return;
    }
    if (e.pointerId !== game.pointerId) return;
    updateAim(p.x - game.start.x, p.y - game.start.y);
  }

  function onPointerUp(e) {
    if (!game.drawing || e.pointerId !== game.pointerId) return;
    game.drawing = false;
    game.pointerId = null;
    canvas.style.cursor = '';
    release();
  }

  function onPointerCancel(e) {
    if (!game.drawing || e.pointerId !== game.pointerId) return;
    game.drawing = false;
    game.pointerId = null;
    game.pull = 0;
    canvas.style.cursor = '';
    setHint(HINTS.idle);
  }

  function onKeyDown(e) {
    if (game.done) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      game.angle = clamp(game.angle + (e.key === 'ArrowLeft' ? -0.04 : 0.04), -MAX_ANGLE, MAX_ANGLE);
      game.interacted = true;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat || !canDraw()) return;
      game.keyDrawing = true;
      game.keyDrawStart = performance.now();
      game.interacted = true;
      setHint(HINTS.drawing);
    }
  }

  function onKeyUp(e) {
    if ((e.key === ' ' || e.key === 'Enter') && game.keyDrawing) {
      e.preventDefault();
      game.keyDrawing = false;
      release();
    }
  }

  // ----- Shooting -----
  function release() {
    if (game.pull < MIN_PULL) {
      game.pull = 0;
      setHint(HINTS.tooShort);
      return;
    }

    const { p0, v0 } = shotParams(game.pull);
    const result = traceShot(p0, v0);
    game.flight = { p0, v0, result, startedAt: performance.now() };
    game.ready = false;
    game.twangAt = performance.now();
    game.twangAmp = game.pull * 0.3;
    game.pull = 0;

    // Start the music inside the release gesture so browsers allow playback.
    if (result.hit && game.hits + 1 >= HITS_TO_OPEN) {
      playMusic();
    }
  }

  function reload() {
    setTimeout(() => {
      if (game.done) return;
      game.ready = true;
      game.nockedAt = performance.now();
    }, RELOAD_MS);
  }

  function endFlight(flight) {
    const { result } = flight;
    if (!result.hit) {
      setHint(HINTS.misses[game.misses++ % HINTS.misses.length]);
      reload();
      return;
    }

    game.hits++;
    const v = velAt(flight.v0, result.t);
    embedArrow(result.x, result.y, v);

    if (game.hits >= HITS_TO_OPEN) {
      openEnvelope(result.x, result.y);
    } else {
      burstHearts(result.x, result.y);
      playEnvelopeAnimation('shake');
      setHint(HINTS.firstHit);
      reload();
    }
  }

  // Convert a canvas point into the envelope's own (unrotated) coordinates.
  function toEnvelopeLocal(x, y) {
    const er = envelopeEl.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const sx = envelopeEl.offsetWidth / er.width || 1;
    const sy = envelopeEl.offsetHeight / er.height || 1;
    return { x: (x + cr.left - er.left) * sx, y: (y + cr.top - er.top) * sy };
  }

  function embedArrow(x, y, v) {
    const speed = Math.hypot(v.x, v.y) || 1;
    const depth = 16; // the arrowhead sinks into the paper
    const tip = toEnvelopeLocal(x + (v.x / speed) * depth, y + (v.y / speed) * depth);
    const deg = (Math.atan2(v.x, -v.y) * 180) / Math.PI;

    const arrow = document.createElement('div');
    arrow.className = 'stuck-arrow';
    arrow.style.left = `${tip.x}px`;
    arrow.style.top = `${tip.y}px`;
    arrow.style.rotate = `${deg}deg`;
    arrow.dataset.deg = String(deg);
    arrow.innerHTML = STUCK_ARROW_SVG;
    envelopeEl.appendChild(arrow);
  }

  function burstHearts(x, y) {
    const origin = toEnvelopeLocal(x, y);
    const glyphs = ['♥', '♡', '❤'];
    for (let i = 0; i < 9; i++) {
      const heart = document.createElement('span');
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 45;
      heart.className = 'burst-heart';
      heart.textContent = glyphs[i % glyphs.length];
      heart.style.left = `${origin.x}px`;
      heart.style.top = `${origin.y}px`;
      heart.style.fontSize = `${0.6 + Math.random() * 0.6}rem`;
      heart.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      heart.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      envelopeEl.appendChild(heart);
      setTimeout(() => heart.remove(), 1000);
    }
  }

  async function showerHearts(impactX, impactY) {
    const shower = document.createElement('div');
    shower.className = 'heart-shower';
    shower.setAttribute('aria-hidden', 'true');
    document.body.appendChild(shower);

    const { width, height } = shower.getBoundingClientRect();
    const spacing = Math.max(58, Math.sqrt(width * height / 104));
    const columns = Math.max(1, Math.ceil(width / spacing));
    const rows = Math.max(1, Math.ceil(height / spacing));
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    const diagonal = Math.hypot(width, height) || 1;
    const colors = ['#A93455', '#C4525A', '#D8738C', '#E8A0B4', '#F5C7D2', '#F8DDCF'];
    const hearts = [];

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const heart = document.createElement('span');
        const targetX = (column + 0.32 + Math.random() * 0.36) * cellWidth;
        const targetY = (row + 0.32 + Math.random() * 0.36) * cellHeight;
        const size = Math.max(cellWidth, cellHeight) * (1.45 + Math.random() * 0.55);
        const distance = Math.hypot(targetX - impactX, targetY - impactY);
        heart.className = 'shower-heart';
        heart.style.left = `${targetX}px`;
        heart.style.top = `${targetY}px`;
        heart.style.animationDelay = `${distance / diagonal * 145 + Math.random() * 35}ms`;
        heart.style.setProperty('--heart-size', `${size}px`);
        heart.style.setProperty('--heart-color', colors[Math.floor(Math.random() * colors.length)]);
        heart.style.setProperty('--impact-x', `${impactX - targetX}px`);
        heart.style.setProperty('--impact-y', `${impactY - targetY}px`);
        heart.style.setProperty('--fall-distance', `${height - targetY + size}px`);
        heart.style.setProperty('--drift', `${(Math.random() - 0.5) * size}px`);
        heart.style.setProperty('--tilt', `${(Math.random() - 0.5) * 66}deg`);
        hearts.push(heart);
      }
    }

    shower.append(...hearts);
    await afterMotion(...hearts);
    shower.remove();
  }

  function playEnvelopeAnimation(name) {
    envelopeEl.classList.remove('shake', 'thud');
    void envelopeEl.offsetWidth;
    envelopeEl.classList.add(name);
  }

  async function openEnvelope(impactX, impactY) {
    game.done = true;
    canvas.style.cursor = '';
    canvas.tabIndex = -1;
    setHint(HINTS.open);
    envelopeScreen.classList.add('is-opening');

    if (reducedMotion.matches) {
      game.running = false;
      musicToggle.classList.add('visible');
      showScreen('letter1');
      return;
    }

    const canvasBounds = canvas.getBoundingClientRect();
    playEnvelopeAnimation('thud');
    setTimeout(() => {
      envelopeEl.querySelectorAll('.stuck-arrow').forEach(arrow => {
        const deg = Number(arrow.dataset.deg) || 0;
        arrow.style.rotate = `${deg + (deg >= 0 ? 50 : -50)}deg`;
        arrow.classList.add('falling');
      });
    }, 250);

    await showerHearts(canvasBounds.left + impactX, canvasBounds.top + impactY);
    await wait(160);
    envelopeEl.classList.add('is-open');
    await wait(800);

    const paper = envelopeEl.querySelector('.env-letter');
    const paperHeight = paper.offsetHeight;
    const paperTop = envelopeEl.getBoundingClientRect().top + paper.offsetTop;
    const availableRise = Math.max(0, paperTop - 8);
    paper.style.setProperty('--slide-distance', `${-Math.min(paperHeight * 1.12, availableRise)}px`);
    envelopeEl.classList.add('letter-out');
    await afterMotion(paper);

    const stage = envelopeScreen.getBoundingClientRect();
    const visibleCenter = (Math.max(stage.top, 0) + Math.min(stage.bottom, window.innerHeight)) / 2;
    const paperCenter = envelopeEl.getBoundingClientRect().top + paper.offsetTop + paper.offsetHeight / 2;
    paper.style.setProperty('--unfold-offset', `${visibleCenter - paperCenter}px`);
    envelopeEl.classList.add('is-unfolding');
    envelopeScreen.classList.add('is-unfolding');
    await afterMotion(paper);

    paper.classList.add('is-unfolded');
    await afterMotion(...paper.querySelectorAll('.env-fold'));
    await wait(170);
    await revealOpenedLetter();
  }

  async function revealOpenedLetter() {
    transitioning = true;
    const first = screens.letter1;
    const nav = first.querySelector('.letter-nav');
    prepareTyping(first);

    envelopeScreen.style.top = `${envelopeScreen.getBoundingClientRect().top}px`;
    envelopeScreen.inert = true;
    envelopeScreen.classList.add('is-handing-off');
    first.inert = true;
    first.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
    await afterMotion(envelopeScreen);

    envelopeScreen.classList.remove('active', 'is-handing-off');
    envelopeScreen.style.top = '';
    game.running = false;
    musicToggle.classList.add('visible');
    first.inert = false;
    first.focus({ preventScroll: true });
    queueTyping(nav, 200);
    transitioning = false;
  }

  // ----- Drawing -----
  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // Arrow with its tip at (0, 0), pointing up (-y).
  function drawArrow(c) {
    const L = ARROW_LENGTH;
    c.lineCap = 'round';
    c.strokeStyle = '#9C6B47';
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(0, 12);
    c.lineTo(0, L - 3);
    c.stroke();

    c.fillStyle = '#E8A0B4';
    c.beginPath();
    c.moveTo(0, L - 28);
    c.quadraticCurveTo(-9, L - 20, -8, L - 4);
    c.lineTo(0, L - 8);
    c.closePath();
    c.fill();

    c.fillStyle = '#D4849A';
    c.beginPath();
    c.moveTo(0, L - 28);
    c.quadraticCurveTo(9, L - 20, 8, L - 4);
    c.lineTo(0, L - 8);
    c.closePath();
    c.fill();

    c.fillStyle = '#C4525A';
    c.fillRect(-2, L - 4, 4, 4);

    c.fillStyle = '#6B6F76';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(5.5, 15);
    c.lineTo(0, 12);
    c.lineTo(-5.5, 15);
    c.closePath();
    c.fill();

    c.fillStyle = 'rgba(255, 255, 255, 0.35)';
    c.beginPath();
    c.moveTo(0, 1);
    c.lineTo(-4.5, 14);
    c.lineTo(0, 11.5);
    c.closePath();
    c.fill();
  }

  function drawBow(now) {
    const pull = game.pull;
    const tipX = 74 - pull * 0.1;
    const tipY = STRING_REST + pull * 0.16;
    const bend = pull * 0.08;

    let twang = 0;
    if (game.twangAt) {
      const t = (now - game.twangAt) / 1000;
      if (t < 0.5) twang = -game.twangAmp * Math.cos(t * 70) * Math.exp(-t * 9);
      else game.twangAt = 0;
    }
    const nockY = STRING_REST + pull + twang;

    ctx.save();
    ctx.translate(game.anchor.x, game.anchor.y);
    ctx.rotate(game.angle);

    // String
    ctx.strokeStyle = 'rgba(92, 61, 46, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-tipX, tipY);
    ctx.lineTo(0, nockY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Limbs
    const limbPath = () => {
      ctx.beginPath();
      ctx.moveTo(-tipX, tipY);
      ctx.bezierCurveTo(-tipX - 4, tipY - 34 - bend, -36, -8, 0, -4);
      ctx.bezierCurveTo(36, -8, tipX + 4, tipY - 34 - bend, tipX, tipY);
    };
    const wood = ctx.createLinearGradient(-tipX, 0, tipX, 0);
    wood.addColorStop(0, '#6E452D');
    wood.addColorStop(0.5, '#A8734D');
    wood.addColorStop(1, '#6E452D');
    limbPath();
    ctx.strokeStyle = wood;
    ctx.lineWidth = 6.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(0, -1.6);
    limbPath();
    ctx.strokeStyle = 'rgba(255, 236, 214, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Limb tips
    ctx.fillStyle = '#5C3D2E';
    ctx.beginPath();
    ctx.arc(-tipX, tipY, 3, 0, Math.PI * 2);
    ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Grip
    roundRectPath(ctx, -11, -13, 22, 17, 5);
    ctx.fillStyle = '#C4525A';
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♥', 0, -4.5);

    // Nocked arrow
    if (game.ready && !game.done) {
      const fade = clamp((now - game.nockedAt) / 250, 0, 1);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(0, nockY - ARROW_LENGTH + (1 - fade) * 14);
      drawArrow(ctx);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawAimGuide() {
    const { p0, v0 } = shotParams(game.pull);
    const power = game.pull / MAX_PULL;
    const dots = 4 + Math.round(power * 7);
    for (let i = 1; i <= dots; i++) {
      const p = posAt(p0, v0, i * 0.012);
      ctx.fillStyle = `rgba(196, 82, 90, ${0.55 * (1 - i / (dots + 1))})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawInvite(now) {
    const t = now / 1000;
    const center = toWorld(0, STRING_REST * 0.4);
    const pulse = (Math.sin(t * 3) + 1) / 2;

    ctx.strokeStyle = `rgba(212, 132, 154, ${0.18 + pulse * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 34 + pulse * 8, 0, Math.PI * 2);
    ctx.stroke();

    // Little chevrons showing "pull down"
    const base = toWorld(0, STRING_REST + 22 + pulse * 10);
    ctx.strokeStyle = `rgba(196, 82, 90, ${0.35 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const y = base.y + i * 8;
      ctx.beginPath();
      ctx.moveTo(base.x - 7, y);
      ctx.lineTo(base.x, y + 6);
      ctx.lineTo(base.x + 7, y);
      ctx.stroke();
    }
  }

  function drawFocusRing() {
    const center = toWorld(0, STRING_REST * 0.6);
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(196, 82, 90, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlight(now) {
    const f = game.flight;
    const t = Math.min((now - f.startedAt) / 1000, f.result.t);
    const p = posAt(f.p0, f.v0, t);
    const v = velAt(f.v0, t);

    // Soft trail
    for (let i = 1; i <= 4; i++) {
      const tp = posAt(f.p0, f.v0, Math.max(0, t - i * 0.018));
      ctx.fillStyle = `rgba(232, 160, 180, ${0.3 - i * 0.06})`;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 3 - i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(v.x, -v.y));
    drawArrow(ctx);
    ctx.restore();
  }

  function frame(now) {
    if (!game.running) return;

    if (game.keyDrawing) {
      game.pull = MAX_PULL * clamp((now - game.keyDrawStart) / KEY_DRAW_MS, 0, 1);
    }

    if (game.flight && now - game.flight.startedAt >= game.flight.result.t * 1000) {
      const finished = game.flight;
      game.flight = null;
      endFlight(finished);
    }

    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    ctx.clearRect(0, 0, game.width, game.height);

    if (!game.done) {
      if (!game.interacted && game.ready) drawInvite(now);
      if (game.focused) drawFocusRing();
      if ((game.drawing || game.keyDrawing) && game.pull >= MIN_PULL) drawAimGuide();
    }
    drawBow(now);
    if (game.flight) drawFlight(now);

    requestAnimationFrame(frame);
  }

  function initArchery() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(envelopeScreen);
    document.fonts?.ready.then(resizeCanvas);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('focus', () => { game.focused = canvas.matches(':focus-visible'); });
    canvas.addEventListener('blur', () => {
      game.focused = false;
      if (game.keyDrawing) {
        game.keyDrawing = false;
        game.pull = 0;
      }
    });

    envelopeEl.addEventListener('animationend', e => {
      if (e.target === envelopeEl) envelopeEl.classList.remove('shake', 'thud');
    });

    requestAnimationFrame(frame);
  }

  // ===== Init =====
  createFloatingHearts();
  createSparkles();
  initArchery();
})();
