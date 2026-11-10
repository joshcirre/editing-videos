// The page's clock, run by the renderer instead of the computer. page-frames.mjs injects this
// before any of the page's own scripts, then calls __clock.seek(ms) once per frame, so a frame
// shows the same moment however long it took to draw.
//
// Under the clock: Date, performance.now, setTimeout, setInterval, requestAnimationFrame,
// Math.random (seeded), CSS animations and transitions, the Web Animations API and SVG animation.
// Not under it: <video>, <audio>, GIFs, iframes, workers.
(() => {
  if (window.__clock) return;
  const RealDate = Date;
  const EPOCH = RealDate.UTC(2026, 0, 1); // the wall clock at time 0, the same on every render
  let now = 0; // milliseconds since the page loaded
  let nextId = 1;
  const timers = new Map();
  const frames = new Map();
  const started = new WeakMap(); // animation -> the clock time it began at

  function VirtualDate(...args) {
    if (!new.target) return new RealDate(EPOCH + now).toString();
    return args.length ? new RealDate(...args) : new RealDate(EPOCH + now);
  }
  VirtualDate.prototype = RealDate.prototype;
  VirtualDate.now = () => EPOCH + now;
  VirtualDate.parse = RealDate.parse;
  VirtualDate.UTC = RealDate.UTC;
  window.Date = VirtualDate;
  performance.now = () => now;

  window.setTimeout = (fn, ms = 0, ...args) => {
    timers.set(nextId, { at: now + Math.max(0, +ms || 0), fn, args });
    return nextId++;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const every = Math.max(1, +ms || 0);
    timers.set(nextId, { at: now + every, every, fn, args });
    return nextId++;
  };
  window.clearTimeout = window.clearInterval = (id) => void timers.delete(id);
  window.requestAnimationFrame = (fn) => {
    frames.set(nextId, fn);
    return nextId++;
  };
  window.cancelAnimationFrame = (id) => void frames.delete(id);

  let seed = 0x9e3779b9; // mulberry32: "random" is the same on every render
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const call = (fn, args) => {
    try {
      if (typeof fn === 'function') fn(...args);
      else (0, eval)(String(fn));
    } catch (error) {
      console.error(error);
    }
  };

  // CSS animations, transitions and element.animate(): held, then placed by the clock. One
  // that appears later (a class added by a timer) begins at the clock time it appeared.
  const place = () => {
    for (const animation of document.getAnimations()) {
      if (!started.has(animation)) {
        started.set(animation, now);
        animation.pause();
      }
      if (animation.playState === 'finished') continue;
      const t = now - started.get(animation);
      const end = animation.effect?.getComputedTiming().endTime;
      if (Number.isFinite(end) && t >= end) animation.finish();
      else animation.currentTime = t;
    }
    for (const svg of document.querySelectorAll('svg')) {
      svg.pauseAnimations();
      svg.setCurrentTime(now / 1000);
    }
  };

  // Forward only: timers fire in order at their own times, then one animation frame runs.
  const seek = (ms) => {
    if (ms < now) throw new Error(`the page clock only goes forward (asked for ${ms}, at ${now})`);
    for (let fired = 0; fired < 100000; fired++) {
      let due = null;
      let dueId = 0;
      for (const [id, timer] of timers) {
        if (timer.at <= ms && (!due || timer.at < due.at)) {
          due = timer;
          dueId = id;
        }
      }
      if (!due) break;
      now = Math.max(now, due.at);
      if (due.every) due.at += due.every;
      else timers.delete(dueId);
      call(due.fn, due.args);
      place();
    }
    now = ms;
    const callbacks = [...frames.values()];
    frames.clear();
    for (const fn of callbacks) call(fn, [now]);
    place();
  };

  const ready = async () => {
    if (document.readyState !== 'complete') await new Promise((done) => addEventListener('load', done, { once: true }));
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
    place();
  };

  window.__clock = { seek, ready, now: () => now };
})();
