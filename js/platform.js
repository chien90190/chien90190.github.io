// Platform 9¾: an unmarked spot at the right of the hero (styles in css/platform.css).
// Hovering it (or tapping on touch) tears open a glowing wound that sheds drifting spores; clicking it steps through
// to another world (an old wizarding newspaper, css/worlds/newspaper.css, or the Upside Down, css/worlds/upside.css),
// and a click on the portrait leads back home.
const platform = document.querySelector('.platform');
if (platform) {
  const avatarWrap = document.querySelector('.avatar-wrap');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touch = window.matchMedia('(hover: none)');
  const spores = platform.querySelector('.spores');
  const haze = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'upside-down' }));
  const random = (min, max) => min + Math.random() * (max - min);
  let sporeTimer;

  // Draw the tear fresh on each load, so no two visits see the same crack.
  // Drawn in a 140 × 240 box with the seam running down the middle.
  const W = 140, H = 240, mid = W / 2;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = markup => {
    const el = document.createElementNS(svgNS, 'svg');
    el.setAttribute('viewBox', `0 0 ${W} ${H}`);
    el.setAttribute('preserveAspectRatio', 'none');
    el.innerHTML = markup;
    return el;
  };
  const point = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

  // Shaped like a slash in skin: a long, barely open slit at each end, flaring (concave) into a diamond-like gape
  // in the middle with straight sides and a softly rounded widest point. The bottom tail runs longer than the top.
  // The seam wanders a little, and each side tears unevenly with fine, sharp jitter that dies out along the tails.
  const tail = 0.06; // how open the tails are, as a share of the widest gape
  const gape = { start: 0.1, peak: 0.48, end: 0.84 };
  const profile = (t, { start, peak, end }) => {
    if (t <= start) return tail * t / start;
    if (t >= end) return tail * (1 - t) / (1 - end);
    const u = t < peak ? (t - start) / (peak - start) : (end - t) / (end - peak);
    // Smoothstep: flat where it leaves the tail (the concave flare), straight through the sides, rounded at the peak
    return tail + (1 - tail) * u * u * (3 - 2 * u);
  };
  const steps = 96;
  const seam = [];
  let wander = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    wander += random(-1.2, 1.2);
    wander *= 0.9;
    // Pin the seam at the very ends so the tails stay on one clean line
    const pin = Math.sin(Math.PI * t);
    // Each point keeps its own jitter, so the outline can be redrawn (longer, when it rips) without twitching
    seam.push({ x: mid + wander * pin, y: t * H, t, swell: profile(t, gape), jr: Math.random(), jl: Math.random() });
  }
  // When the gate is stepped through, the slit rips longer: its tails stop narrowing to a point and run on past
  // both tips as part of the same outline (see ripOpen below)
  let runUp = [];
  let runDown = [];
  const outline = () => [...runUp, ...seam, ...runDown];
  // Like lips of a wound, one side bows a little less and its gape sits slightly higher
  const lids = {
    1: { bow: 0.82, shape: { start: 0.11, peak: 0.46, end: 0.83 } },
    [-1]: { bow: 1, shape: { start: 0.09, peak: 0.5, end: 0.85 } }
  };

  // As it rips, the lips are pried apart too: `spread` is how far, as a multiple of the usual gape, and `reach` how
  // far lengthwise the parting runs, past the gape and on along the rip. Prying pulls the lips outward rather than
  // scaling the wound up, so each edge keeps its roughness. They part most in the middle, bowing round, while the far
  // ends stay a fine line. Returns how far the charred surface moves out at a point along the slit
  // (t runs 0 to 1 between the old tips, and on past them along the rip).
  let spread = 1;
  let reach = 0;
  const parted = (t, { start, end }) => {
    if (spread === 1) return 0;
    const from = start - reach;
    const to = end + reach;
    if (t <= from || t >= to) return 0;
    return 14 * (spread - 1) * Math.sin(Math.PI * (t - from) / (to - from)) ** 0.6;
  };

  // The tear's layers, from the charred rim in to the white-hot seam: how wide each is at the widest gape, how
  // unevenly its edge tears, and how much of the lips' parting it follows (`give`). Like skin pulled apart, the
  // charred surface moves out furthest, so more and more scorched lip shows. The seam follows half, so each lip moves
  // out as fast as the white gap widens (it grows from both sides at once), and the molten band more than the seam,
  // so the flesh thickens as it's pried rather than looking squeezed thin between the growing char and light.
  const layers = {
    rim: { width: 15, jitter: 4, give: 1 },
    band: { width: 10, jitter: 3, give: 0.8 },
    seam: { width: 3, jitter: 1.5, give: 0.5 }
  };
  const edge = (side, { width, jitter, give }) => {
    const { bow, shape } = lids[side];
    const ripping = runUp.length > 0;
    return outline().map(p => {
      // While ripping, the tails hold their width out to the tips and the run tapers off beyond them
      const open = p.taper !== undefined ? tail * p.taper
        : ripping && (p.t <= shape.start || p.t >= shape.end) ? tail
        : profile(p.t, shape);
      const out = open * (width + jitter * (side > 0 ? p.jr : p.jl)) + give * parted(p.t ?? p.y / H, shape);
      return [p.x + side * bow * out, p.y];
    });
  };
  const lens = layer => {
    const right = edge(1, layer);
    const left = edge(-1, layer).reverse();
    return 'M' + [...right, ...left].map(point).join('L') + 'Z';
  };

  // The wound is drawn the first time the gate opens, so visitors who never find it don't pay for building it
  const rift = platform.querySelector('.rift');
  let shadow;
  let tear; // the tear's own elements, redrawn as it rips and is pried open
  let crackRoots; // the cracks around it, grouped by where they leave the wound, with that point's side and t
  let built = false;
  const build = () => {
    if (built) return;
    built = true;
    // Hairline cracks branch off the edges and splinter as they run out across the wall, like a wound tearing outward.
    // Each crack is a run of short segments, so it can taper to nothing and grow like a real fracture:
    // it bursts out fast where the wound pushes on it, then slows as it runs out of force.
    const crack = (into, x, y, angle, length, width, time, depth) => {
      const segments = Math.ceil(length / 6);
      const step = length / segments;
      for (let i = 0; i < segments; i++) {
        const progress = i / segments;
        angle += random(-0.45, 0.45);
        const nx = x + Math.cos(angle) * step;
        const ny = y + Math.sin(angle) * step;
        const speed = 650 * (1 - 0.75 * progress); // px per second
        const duration = step / speed;
        into.push({ d: `M${point([x, y])}L${point([nx, ny])}`, width: width * (1 - 0.8 * progress), time, duration });
        time += duration;
        x = nx;
        y = ny;
        // A fork sets off the moment the crack front reaches it, already thinner than its parent
        if (depth < 2 && i < segments - 1 && Math.random() < 0.3) {
          const fork = angle + random(0.4, 0.9) * (Math.random() < 0.5 ? -1 : 1);
          crack(into, x, y, fork, (length - step * (i + 1)) * random(0.5, 0.9), width * (1 - 0.8 * progress) * 0.7, time, depth + 1);
        }
      }
    };
    // Cracks are grouped by where they leave the wound, so each can be carried out with its lip when it's pried open
    const roots = [];
    seam.forEach(({ x, y, t, swell }, i) => {
      if (i % 3 || swell < 0.2 || Math.random() < 0.3) return;
      const side = Math.random() < 0.5 ? -1 : 1;
      // Lean outward and a little up or down, so cracks fan away from the tear rather than run level
      const angle = (side > 0 ? 0 : Math.PI) + side * random(-0.7, 0.7);
      // A crack starts once the wound has been sliced this far out and has begun to gape: the middle first, the tips after
      const start = 0.14 + 0.06 * Math.abs(y - H / 2) / (H / 2) + random(0, 0.03);
      const segments = [];
      crack(segments, x + side * swell * 9, y, angle, random(18, 52) * swell, random(0.6, 1), start, 0);
      roots.push({ side, t, segments });
    });
    const segmentMarkup = ({ d, width, time, duration }) => {
      const timing = `--delay:${time.toFixed(3)}s;--duration:${duration.toFixed(3)}s`;
      return `<path class="rift-crack" pathLength="1" d="${d}" stroke-width="${(width * 1.6).toFixed(2)}" style="stroke:var(--rift-deep);${timing}" opacity="0.6"/>` +
        `<path class="rift-crack" pathLength="1" d="${d}" stroke="url(#rift-crack-fade)" stroke-width="${(width * 0.5).toFixed(2)}" style="${timing}"/>`;
    };
    const crackMarkup = roots.map(({ segments }) => `<g class="rift-crack-root">${segments.map(segmentMarkup).join('')}</g>`).join('');

    // The cracks sit on the same layer as the tear, so their roots stay on its edge as it springs open
    rift.querySelector('.rift-open').prepend(svg(`
      <defs>
        <radialGradient id="rift-crack-fade" gradientUnits="userSpaceOnUse" cx="${mid}" cy="${H / 2}" r="${W / 2}">
          <stop offset="0" stop-color="#a8140c"/><stop offset="0.5" stop-color="#5a0606"/><stop offset="1" style="stop-color:var(--rift-deep)"/>
        </radialGradient>
      </defs>
      ${crackMarkup}`));
    const rootEls = rift.querySelectorAll('.rift-crack-root');
    crackRoots = roots.map(({ side, t }, i) => ({ side, t, el: rootEls[i] }));
    // The tear itself: a charred rim, a molten band, then a white-hot seam, each edge roughened with noise
    // (their outlines are filled in by redraw). Something on the other side sometimes moves past the light,
    // behind the flesh, so its shadow is clipped to the white-hot seam.
    rift.querySelector('.rift-open').append(svg(`
      <defs>
        <filter id="rift-rough" x="-50%" y="-5%" width="200%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09 0.03" numOctaves="3" seed="${Math.floor(random(0, 999))}"/>
          <feDisplacementMap in="SourceGraphic" scale="3"/>
        </filter>
        <linearGradient id="rift-heat" x1="0" x2="1">
          <stop offset="0" stop-color="#b3120c"/><stop class="rift-heat-in" style="stop-color:var(--rift-hot)"/>
          <stop class="rift-heat-core" offset="0.5" stop-color="#ffd9b8"/>
          <stop class="rift-heat-out" style="stop-color:var(--rift-hot)"/><stop offset="1" stop-color="#b3120c"/>
        </linearGradient>
        <clipPath id="rift-gap"><path class="rift-gap"/></clipPath>
        <linearGradient id="rift-hairline" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}">
          <stop offset="${gape.start + 0.04}" stop-color="#ffd9b8" stop-opacity="0.9"/><stop offset="${gape.start + 0.12}" stop-color="#ffd9b8" stop-opacity="0"/>
          <stop offset="${gape.end - 0.12}" stop-color="#ffd9b8" stop-opacity="0"/><stop offset="${gape.end - 0.04}" stop-color="#ffd9b8" stop-opacity="0.9"/>
        </linearGradient>
        <filter id="rift-blur" x="-100%" y="-50%" width="300%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      <g class="rift-core"><g filter="url(#rift-rough)">
        <g class="rift-run-cracks"></g>
        <path class="rift-rim" style="fill:var(--rift-deep)"/>
        <path class="rift-band" fill="url(#rift-heat)"/>
        <path class="rift-seam" fill="#fff6ec"/>
      </g>
      <!-- The shadow sits outside the roughening: it's blurred anyway, and moving it inside would redo the noise every frame -->
      <g clip-path="url(#rift-gap)">
        <g class="rift-shadow" filter="url(#rift-blur)" transform="translate(-60 0)">
          <ellipse cx="0" cy="62" rx="9" ry="12"/>
          <ellipse cx="0" cy="150" rx="22" ry="72"/>
        </g>
      </g>
      <!-- Out past the gape, the cut runs on as a single fine line to each tip (kept out of the roughening, which would break it up) -->
      <path class="rift-hairline" fill="none" stroke="url(#rift-hairline)" stroke-width="0.7" stroke-linecap="round"/>
      </g>`));
    shadow = rift.querySelector('.rift-shadow');
    const find = name => rift.querySelector(`.rift-${name}`);
    tear = {
      rim: find('rim'), band: find('band'), gap: find('gap'), seam: find('seam'), hairline: find('hairline'),
      heatIn: find('heat-in'), heatOut: find('heat-out'), runCracks: find('run-cracks')
    };
    redraw();
    // Settle the new pieces in their closed state first, so they animate open like the rest
    rift.getBoundingClientRect();
  };

  // The shadow either walks straight past, or creeps in partway, lingers as if looking through, and pulls back
  let shadowTimer;
  const passShadow = () => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const from = mid - dir * 60;
    const lift = random(-25, 25);
    const at = x => ({ transform: `translate(${x}px, ${lift}px)` });
    if (Math.random() < 0.65) {
      shadow.animate([at(from), at(mid + dir * 60)], { duration: random(500, 1100), easing: 'cubic-bezier(0.4, 0, 0.6, 1)' });
    } else {
      const peek = mid - dir * random(4, 16);
      shadow.animate([at(from), { ...at(peek), offset: 0.3 }, { ...at(peek + dir * 3), offset: 0.7 }, at(from)],
        { duration: random(1800, 2800), easing: 'ease-in-out' });
    }
    shadowTimer = setTimeout(passShadow, random(2500, 5500));
  };

  const shedSpore = () => {
    const spore = Object.assign(document.createElement('span'), { className: 'spore' });
    spore.style.setProperty('--size', `${random(2, 5)}px`);
    spore.style.top = `${random(15, 85)}%`;
    spores.appendChild(spore);
    // Spores float up and away, wandering as they go, like ash on a slow wind
    const drift = random(-90, 90);
    spore.animate([
      { transform: 'translate(0, 0)', opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: `translate(${drift * 0.4}px, -60px)`, offset: 0.5 },
      { transform: `translate(${drift}px, -${random(120, 200)}px)`, opacity: 0 }
    ], { duration: random(2800, 4800), easing: 'ease-out' }).finished.finally(() => spore.remove());
  };

  // Stepping through the gate turns the page into another world, set on <html> as data-world, and the portrait
  // leads back. Each world's stylesheet and fonts are fetched quietly once the page has finished loading (or the
  // first time the gate opens, if that comes sooner), so they're ready by the time anyone clicks.
  const worlds = {
    // An old wizarding newspaper
    paper: {
      css: 'css/worlds/newspaper.css',
      fonts: [
        'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=Old+Standard+TT:wght@400;700&display=swap',
        // The blackletter only sets the masthead, the nav name and the drop cap (and in the evening edition the name
        // and the section heads), so fetch just those letters
        'https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap&text=' +
          encodeURIComponent('The Daily Evening Chien Chrissy I About News Publications')
      ],
      waitFor: ['1em UnifrakturMaguntia', '1em "IM Fell English"', '700 1em "Old Standard TT"']
    },
    // The Upside Down
    upside: {
      css: 'css/worlds/upside.css',
      fonts: ['https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Merriweather:wght@700;900&display=swap'],
      waitFor: ['900 1em Merriweather', '1em "Courier Prime"']
    },
    // The Grand Line (reached by the straw hat in the top bar, not the gate)
    grandline: {
      css: 'css/worlds/grandline.css',
      fonts: ['https://fonts.googleapis.com/css2?family=Noto+Serif+Display:wdth,wght@62.5..100,400..900&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400&display=swap'],
      waitFor: ['900 1em "Noto Serif Display"', '1em Nunito']
    }
  };
  // Which world the gate leads to depends on where it's clicked: the upper half opens onto the newspaper,
  // the lower half onto the Upside Down. Without a click position (the keyboard), one is picked at random.
  const worldAt = clientY => {
    const { top, height } = platform.getBoundingClientRect();
    return clientY < top + height / 2 ? 'paper' : 'upside';
  };
  const gateWorlds = ['paper', 'upside'];
  const randomWorld = () => gateWorlds[Math.floor(Math.random() * gateWorlds.length)];

  const root = document.documentElement;
  const stylesheet = href => new Promise(resolve => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
    link.onload = link.onerror = resolve;
    document.head.appendChild(link);
  });
  const loaded = {};
  const loadWorld = name => loaded[name] ??= Promise.all([
    stylesheet(worlds[name].css),
    ...worlds[name].fonts.map(stylesheet)
  ]).then(() => Promise.race([
    // Don't reveal the world with stand-in fonts, but don't hang on a slow network either
    Promise.all(worlds[name].waitFor.map(font => document.fonts.load(font))),
    new Promise(resolve => setTimeout(resolve, 2500))
  ])).catch(() => {});
  // Once the page is done, fetch both worlds while the browser is idle, so a first trip through the gate doesn't sit
  // on the light waiting for fonts (a phone's two quick taps leave no time to fetch them). Skipped for visitors saving data.
  const preloadWorlds = () => {
    if (navigator.connection?.saveData) return;
    const idle = window.requestIdleCallback ?? (fn => setTimeout(fn, 200));
    idle(() => Object.keys(worlds).forEach(loadWorld));
  };
  if (document.readyState === 'complete') preloadWorlds();
  else window.addEventListener('load', preloadWorlds, { once: true });

  const mastheadDate = document.getElementById('masthead-date');
  if (mastheadDate) mastheadDate.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Like the Prophet, the paper comes out twice a day: the Daily from six in the morning, the Evening from six at
  // night, by the visitor's own clock (css/worlds/newspaper.css). ?daily or ?evening in the address picks one.
  // Options in the address (this, and ?slow below), read leniently so ?slow&daily and ?slow?daily both work
  const asked = new Set(location.search.slice(1).split(/[?&]/));
  const hour = new Date().getHours();
  const evening = asked.has('evening') || (!asked.has('daily') && (hour >= 18 || hour < 6));
  root.dataset.edition = evening ? 'evening' : 'daily';
  if (evening) document.querySelectorAll('[data-evening]').forEach(el => el.textContent = el.dataset.evening);
  // The evening edition sets the name along an arch: each letter is told where it sits along it, from -1 to 1
  const letters = document.querySelectorAll('.hero-text .title .char');
  letters.forEach((letter, i) => letter.style.setProperty('--arc', (i / Math.max(1, letters.length - 1) * 2 - 1).toFixed(3)));

  // The way home from another world is quiet: click the portrait and the page glides back into its usual layout
  const goBack = () => {
    if (!root.dataset.world || crossing) return;
    const goHome = () => {
      // Keep whatever the visitor was reading in the same spot, though the masthead and the type change above it
      const parts = [...document.querySelectorAll('.hero, main section[id], .site-footer')];
      const anchor = parts.find(part => part.getBoundingClientRect().bottom > 0) ?? parts[0];
      const before = anchor.getBoundingClientRect().top;
      delete root.dataset.world;
      window.scrollBy({ top: anchor.getBoundingClientRect().top - before, behavior: 'instant' });
      window.dispatchEvent(new Event('resize'));
    };
    if (reduceMotion.matches) return goHome();
    if (document.startViewTransition) {
      // Gliding each part home means snapshotting each one whole, and on a phone the sections run thousands of
      // pixels tall, which stalls and flickers; so touch screens dissolve the screen into home instead. The newspaper's
      // layout is nothing like home's, so blending the two straight together looks like a cut; it fades out to bare
      // paper first, and home fades in from there. The Grand Line's ship, pier and chest are nothing like home's
      // either, on any screen, so it always fades out the same way, to open sea.
      const way = root.dataset.world === 'grandline' ? ['is-dissolving-home', 'is-through-sea']
        : !touch.matches ? ['is-going-home']
        : root.dataset.world === 'paper' ? ['is-dissolving-home', 'is-through-paper'] : ['is-dissolving-home'];
      root.classList.add(...way);
      document.startViewTransition(goHome).finished.finally(() => root.classList.remove(...way));
      return;
    }
    goHomeByHand(goHome);
  };
  if (avatarWrap) avatarWrap.addEventListener('click', goBack);

  // The same trip home for browsers without view transitions, built from plain animations: the newspaper photograph
  // flips away as the masthead fades; at the halfway point the page switches back, each part slides from where it
  // was into its usual place, and the portrait flips in from the other side
  let goingHome = false;
  const goHomeByHand = async goHome => {
    if (goingHome) return;
    goingHome = true;
    const half = 350;
    const flip = angle => `perspective(900px) rotateY(${angle}deg)`;
    const masthead = document.querySelector('.masthead');
    const fade = masthead?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: half, easing: 'ease-in', fill: 'forwards' });
    await avatarWrap.animate([{ transform: flip(0) }, { transform: flip(90) }],
      { duration: half, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' }).finished;

    const parts = [...document.querySelectorAll('.site-nav, .hero, main section[id], .site-footer')];
    const before = new Map(parts.map(part => [part, part.getBoundingClientRect().top]));
    goHome();
    fade?.cancel();
    parts.forEach(part => {
      const shift = before.get(part) - part.getBoundingClientRect().top;
      if (Math.abs(shift) > 0.5) part.animate([{ transform: `translateY(${shift}px)` }, { transform: 'none' }],
        { duration: half, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' });
    });
    await avatarWrap.animate([{ transform: flip(-90) }, { transform: flip(0) }],
      { duration: half, easing: 'cubic-bezier(0.1, 0.5, 0.5, 1)' }).finished;
    goingHome = false;
  };

  // Draw the tear's outline: at its usual length, ripped longer, or pried open
  const redraw = () => {
    const seamPath = lens(layers.seam);
    tear.rim.setAttribute('d', lens(layers.rim));
    tear.band.setAttribute('d', lens(layers.band));
    tear.seam.setAttribute('d', seamPath);
    tear.gap.setAttribute('d', seamPath);
    tear.hairline.setAttribute('d', 'M' + outline().map(({ x, y }) => point([x, y])).join('L'));
    // The band glows from red at its outer edge to hot where the seam begins, but its gradient spans the whole wound,
    // so as the gap widens the glow would stretch away under the seam and leave the band dull red, looking thinner.
    // Keep the hot stop at the seam's edge instead.
    const moved = parted(gape.peak, gape);
    const { band, seam: core } = layers;
    const hot = 0.5 * (1 - (core.width + core.give * moved) / (band.width + band.give * moved));
    tear.heatIn.setAttribute('offset', hot.toFixed(3));
    tear.heatOut.setAttribute('offset', (1 - hot).toFixed(3));
    // The wall is dragged along too: each crack rides out with the lip it leaves from
    crackRoots.forEach(({ el, side, t }) => {
      const { bow, shape } = lids[side];
      el.setAttribute('transform', `translate(${(side * bow * parted(t, shape)).toFixed(2)} 0)`);
    });
  };
  // The run past one tip: it keeps drifting the way the seam does, tapers off, and splinters a few hairline cracks
  const runFrom = ({ x, y }, length, dir) => {
    const run = [];
    let drift = 0;
    let cracks = '';
    for (let d = 5; d <= length; d += 5) {
      drift = (drift + random(-0.8, 0.8)) * 0.92;
      const px = x + drift * Math.min(1, d / 40);
      const py = y + dir * d;
      run.push({ x: px, y: py, taper: 1 - 0.85 * d / length, jr: Math.random(), jl: Math.random() });
      if (d % 30 || Math.random() < 0.4) continue;
      const side = Math.random() < 0.5 ? -1 : 1;
      // Lean the way the rip is running, as a tearing edge pulls its cracks along
      let angle = (side > 0 ? 0 : Math.PI) + side * dir * random(0.3, 0.9);
      const pts = [[px, py]];
      for (let j = 0, cx = px, cy = py; j < 3; j++) {
        angle += random(-0.4, 0.4);
        cx += Math.cos(angle) * random(3, 6);
        cy += Math.sin(angle) * random(3, 6);
        pts.push([cx, cy]);
      }
      cracks += `<path d="M${pts.map(point).join('L')}" fill="none" stroke="#6a0806" stroke-width="0.6" stroke-linecap="round" opacity="0.8"/>`;
    }
    return { run: dir < 0 ? run.reverse() : run, cracks };
  };

  // Stepping through rips the slit on from both tips and pries its lips apart: a small jolt at first, then faster and
  // faster as the wound gives way, so it's still tearing wider when the light swallows it. The rip is uncovered just
  // ahead of the parting as it runs lengthwise, as if the prying is what tears it on. It runs until the wound heals
  // (healRip below), and returns the animation that uncovers the rip, for healRip to cancel.
  const ripOpen = () => {
    const up = random(110, 160);
    const down = random(120, 170);
    const above = runFrom(seam[0], up, -1);
    const below = runFrom(seam[seam.length - 1], down, 1);
    runUp = above.run;
    runDown = below.run;
    tear.runCracks.innerHTML = above.cracks + below.cracks;
    const lead = 30; // how far the rip runs ahead of the parting (px)
    // How much of the rip past a tip is uncovered, given how far in from that tip the gape starts (`from`, as a share of the slit)
    const uncovered = (from, run) => Math.min(run + 10, Math.max(H * 0.02, (reach - from) * H + lead));
    const reveal = rift.querySelector('.rift-open').animate([], { duration: 1, fill: 'forwards' });
    const start = performance.now();
    const frame = now => {
      if (!runUp.length) return;
      // In seconds, at the same pace as the light swelling over it (so slowed down with it under ?slow)
      const t = (now - start) / 1000 / slow;
      const pull = 0.3 * (1 - Math.exp(-t / 0.05)) + 0.8 * t + 6 * t * t;
      spread = 1 + 0.8 * pull;
      reach = 0.4 * pull;
      redraw();
      const clip = `inset(-${uncovered(gape.start, up).toFixed(1)}px -100% -${uncovered(1 - gape.end, down).toFixed(1)}px -100%)`;
      reveal.effect.setKeyframes([{ clipPath: clip }, { clipPath: clip }]);
      requestAnimationFrame(frame);
    };
    frame(start);
    return reveal;
  };
  // Heal the slit back to its usual length, out of sight, for the trip home
  const healRip = reveal => {
    reveal.cancel();
    runUp = [];
    runDown = [];
    spread = 1;
    reach = 0;
    tear.runCracks.innerHTML = '';
    redraw();
  };

  // Into the newspaper. The wound closes as it usually does, and as it squeezes shut a thick drop of paper wells up
  // out of it and hangs, and the wound shutting cuts it loose to fall whole. Where it lands it spreads into a pool of
  // paper over the whole page, the page turns to the newspaper under it, and as the pool clears, the newspaper's
  // print rises up through the paper (see intoPaper below, and css/worlds/newspaper.css).
  // The feel is tuned here, as a whole. Add ?slow to the address to watch it at quarter speed, and press R in the
  // newspaper to play it again.
  const drip = {
    ooze: 270, // how long it takes to well up and hang: as long as the wound takes to shut, which lets it go (ms)
    sag: 6, // how far it sags as it hangs (px)
    radius: 8, // how wide the drop is, as it lets go (half-width, px)
    fall: 150, // how far it falls (px)
    drop: 320, // how long it takes to fall (ms)
    root: 16, // how far up the seam the ink seeps from, until the seam shuts in past that (px)
    spread: 400, // how long the pool takes to spread over the whole page, paced as the Upside Down's light (ms)
    splash: 0.15, // how much of the pool's spread is carried straight on from the drop's landing, the rest gathering pace
    rim: 10, // how wide the pool's darker wet rim is, once it's spread (px)
    fade: 160, // how long the pool takes to clear off the newspaper under it (ms)
    dry: 900, // how long the paper takes to dry after it (ms)
    dryGrows: 8 // how far the dry patch spreads, as a multiple of how large it starts
  };
  const slow = asked.has('slow') ? 4 : 1;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Stepping through. A click that lands before the slit has finished opening (a quick hover, or a quick second tap)
  // waits for it, so each crossing starts from the same open wound. Once crossing, nothing else opens or closes the
  // wound (see the listeners below) until the crossing is done with it.
  let crossing = false;
  const settled = () => Promise.all(rift.querySelector('.rift-open').getAnimations().map(motion => motion.finished)).catch(() => {});
  const arrive = world => {
    root.dataset.world = world;
    // The sliding nav underline needs re-measuring in the new type
    window.dispatchEvent(new Event('resize'));
  };
  // Each world's own way of coming in (in its stylesheet, lasting up to about 2.5s), held back `after` (ms) if it's to
  // start later
  const settleIn = (after = 0) => {
    root.style.setProperty('--arrive-after', `${after}ms`);
    root.classList.add('is-arriving');
    setTimeout(() => {
      root.classList.remove('is-arriving');
      root.style.removeProperty('--arrive-after');
    }, after + 2600 * slow);
  };
  const crossOver = async world => {
    if (crossing || root.dataset.world) return;
    crossing = true;
    // Whatever was walking past behind the wound keeps out of sight while someone steps through
    clearTimeout(shadowTimer);
    shadow?.getAnimations().forEach(animation => animation.cancel());
    const ready = loadWorld(world);
    await settled();
    await (world === 'paper' ? intoPaper : intoUpsideDown)(ready);
    crossing = false;
  };

  // The newspaper's print doesn't come in down the page like a printer's, but seeps up through the paper outward
  // from where the drop landed, as ink spreads over the Marauder's Map from the wand's tip: each heading, line, list
  // entry and picture rises once the spread reaches it, at its own pace (css/worlds/newspaper.css). This picks out
  // those pieces, outermost first so none is counted twice. The paper's ruled lines come with the ink too, so the
  // paper the pool clears off is truly bare: the parts that carry them (`inkFrames`) come in as well, as the
  // spread reaches their nearest edge, so always ahead of the print inside them, but simply, in one step rather than
  // in waves, and the print inside them rises over that, going as faint as both together. Only what's on screen
  // takes part; the rest is simply there, unseen, with nothing for the browser to draw.
  const inkPieces = [
    '.masthead span', '.masthead-title', '.nav-brand', '.nav-links > a', '.theme-toggle',
    '.avatar-wrap', '.hero-text > :not(.badges)', '.badges > *',
    'h2', 'p', '.side-label', '.news-item > *', '.edu-list > li > *', 'li:not(.news-item, .edu-list > li)',
    '.pub-media-wrap', '.pub-body > *', '.site-footer > *'
  ].join(', ');
  const inkFrames = '.masthead, .site-nav, main > section:not(.hero), .site-footer';
  const inkSpread = 300; // ms the spread takes to reach the farthest corner of the screen
  const inkJitter = 60; // ms up to which each piece of print may lag behind it, so the spread isn't a perfect ring
  const inkRises = [400, 750]; // ms each piece takes to rise: some come up quickly, some slowly
  // Picks the pieces from the page as it now stands (so after it has turned to the newspaper), spreading out from
  // `from` (a point on screen), and lets them go again once the last has risen, `after` (ms) from now
  const scatterInk = (after = 0, from = { x: innerWidth / 2, y: innerHeight / 2 }) => {
    const onScreen = el => {
      const { top, bottom, width } = el.getBoundingClientRect();
      return width > 0 && bottom > 0 && top < innerHeight;
    };
    const pieces = [...document.querySelectorAll(inkPieces)]
      .filter(piece => !piece.closest('.platform') && !piece.parentElement.closest(inkPieces) && onScreen(piece));
    const frames = [...document.querySelectorAll(inkFrames)].filter(onScreen);
    // How far the spread has to go to reach an element's nearest edge, as a share of the way to the farthest corner
    const farthest = Math.hypot(Math.max(from.x, innerWidth - from.x), Math.max(from.y, innerHeight - from.y));
    const reach = el => {
      const { left, right, top, bottom } = el.getBoundingClientRect();
      return Math.hypot(Math.max(left - from.x, 0, from.x - right), Math.max(top - from.y, 0, from.y - bottom)) / farthest;
    };
    const ink = (el, jitter, kind = '') => {
      el.style.setProperty('--ink-delay', `${Math.round(reach(el) * inkSpread + random(0, jitter))}ms`);
      el.style.setProperty('--ink-for', `${Math.round(random(...inkRises))}ms`);
      el.dataset.ink = kind;
    };
    pieces.forEach(piece => ink(piece, inkJitter));
    frames.forEach(frame => ink(frame, 0, 'frame'));
    setTimeout(() => [...pieces, ...frames].forEach(el => {
      delete el.dataset.ink;
      el.style.removeProperty('--ink-delay');
      el.style.removeProperty('--ink-for');
    }), after + inkSpread + inkJitter + inkRises[1] + 100);
  };

  // Before the print, ink runs along the newspaper's rules, as the Marauder's Map draws its corridors before the
  // names: each rule across the page (a top or bottom border on something without side borders) is hidden, and an
  // ink line just like it is laid over it, running out both ways from the point nearest `from` once the spread
  // reaches that. Some rules belong to print that's still rising (a heading's own rule, say), so the lines hand back
  // to the rules only once all the print is up. Only rules on screen take part; the lines are pinned to the screen,
  // so if the page is scrolled meanwhile they hand back at once.
  const inkRun = 3; // px a line of ink runs along a rule each ms
  const inkRunsFor = 350; // ms a line of ink takes at the least, so even a short rule (on a phone, say) is seen to run
  // `after` (ms) holds it all back, until there's nothing over the page to hide it
  const ruleInk = (from = { x: innerWidth / 2, y: innerHeight / 2 }, after = 0) => {
    const farthest = Math.hypot(Math.max(from.x, innerWidth - from.x), Math.max(from.y, innerHeight - from.y));
    const runs = [];
    const lines = [];
    for (const el of document.body.querySelectorAll('*')) {
      const box = el.getBoundingClientRect();
      if (box.width < 40 || box.bottom < 0 || box.top > innerHeight || el.closest('.platform')) continue;
      const style = getComputedStyle(el);
      if (parseFloat(style.borderLeftWidth) || parseFloat(style.borderRightWidth)) continue;
      for (const edge of ['top', 'bottom']) {
        const width = parseFloat(style.getPropertyValue(`border-${edge}-width`));
        const kind = style.getPropertyValue(`border-${edge}-style`);
        if (!width || kind === 'none' || kind === 'hidden') continue;
        const y = edge === 'top' ? box.top : box.bottom - width;
        const start = Math.min(Math.max(from.x - box.left, 0), box.width);
        const line = Object.assign(document.createElement('div'), { className: 'world-rule' });
        Object.assign(line.style, {
          left: `${box.left}px`, top: `${y}px`, width: `${box.width}px`, transformOrigin: `${start}px 0`,
          borderTop: `${width}px ${kind} ${style.getPropertyValue(`border-${edge}-color`)}`
        });
        document.body.appendChild(line);
        el.style.setProperty(`border-${edge}-color`, 'transparent');
        lines.push({ line, el, edge });
        const reach = Math.hypot(Math.max(box.left - from.x, 0, from.x - box.right), y - from.y) / farthest;
        const run = line.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
          duration: Math.max(inkRunsFor, Math.max(start, box.width - start) / inkRun) * slow,
          delay: after + reach * inkSpread * 0.5 * slow,
          easing: 'cubic-bezier(0.3, 0.6, 0.4, 1)',
          fill: 'backwards'
        });
        runs.push(run.finished.catch(() => {}));
      }
    }
    let handed = false;
    const handBack = () => {
      if (handed) return;
      handed = true;
      removeEventListener('scroll', handBack);
      lines.forEach(({ line, el, edge }) => {
        el.style.removeProperty(`border-${edge}-color`);
        line.remove();
      });
    };
    addEventListener('scroll', handBack, { passive: true });
    Promise.all([...runs, wait(after + inkSpread + inkJitter + inkRises[1] + 100)]).then(handBack);
  };

  // Stepping through in a flood of light from the wound. Once the wound has been made ready (`tear`, which returns
  // how to mend it again), a ball of light centred on it swells over the page; as it reaches the edges its light
  // settles evenly over everything, the wound included, while the page changes underneath (`arrived` is called once
  // it has); then the light fades fast on the other world. The ball is placed inside the page's own layer, just under
  // the wound, so the wound stays whole on top of it. Each world's light is coloured in css/platform.css.
  // `reach` is how far past the farthest corner the ball grows, for a ball whose light is clear of the corners only
  // well inside its rim, and `size` how large it's drawn (px), so one blown up far is drawn larger and stays smooth.
  // `easing` is how it swells: by default it gathers before it spreads.
  const flood = async (ready, world, { grow, fade, tear, arrived, reach = 2.6, size = 100, easing = 'cubic-bezier(0.4, 0, 0.7, 0.4)' }) => {
    const { left, top, width, height } = rift.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const flash = Object.assign(document.createElement('div'), { className: `world-flash is-${world}` });
    flash.style.setProperty('--x', `${x}px`);
    flash.style.setProperty('--y', `${y}px`);
    // A layer in the page, under the wound: centred on it, `size` across, or the whole screen without one
    const layer = (className, size) => {
      const el = Object.assign(document.createElement('div'), { className });
      el.style.setProperty('--x', `${x}px`);
      el.style.setProperty('--y', `${y}px`);
      if (size) Object.assign(el.style, { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px` });
      return document.querySelector('main').appendChild(el);
    };
    let leak, mend;

    if (!reduceMotion.matches) {
      root.classList.add('is-crossing');
      mend = await tear();
      leak = layer(`world-leak is-${world}`, size);
      // Its glow fades out toward its rim, so it grows well past the farthest corner to leave no dim edge
      const cover = reach * Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) / size;
      // From 40px across, through 120px
      const swell = leak.animate([
        { opacity: 0, transform: `scale(${40 / size})` },
        { opacity: 0.9, transform: `scale(${120 / size})`, offset: 0.35 },
        { opacity: 1, transform: `scale(${cover})` }
      ], { duration: grow * slow, easing, fill: 'forwards' });
      // Timed from the ball, so slowing the ball never lets the light cover it early
      const covered = wait(grow * 0.8 * slow).then(() => {
        document.body.appendChild(flash);
        return flash.animate([{ opacity: 0 }, { opacity: 1 }], { duration: grow * 0.2 * slow, easing: 'ease-in', fill: 'forwards' }).finished;
      });
      await swell.finished;
      // The wound heals back below, so wait until the light has truly covered it, even on a slow frame
      await covered;
      await wait(30);
    } else {
      document.body.appendChild(flash);
      await flash.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' }).finished;
    }

    await ready;
    leak?.remove();
    root.classList.remove('is-crossing');
    mend?.();
    setOpen(false);
    arrive(world);
    arrived();
    await flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade * slow, easing: 'ease-out', fill: 'forwards' }).finished;
    flash.remove();
  };

  // Into the newspaper by a drop of paper (see drip above). Where the drop lands it spreads into a pool of paper
  // over the whole page (css/platform.css), the page turns to the newspaper under it, and as the pool clears, the
  // newspaper's print rises out from where the drop landed.
  const intoPaper = async ready => {
    // For visitors who'd rather less moved, the page simply fades through paper
    if (reduceMotion.matches) return flood(ready, 'paper', {
      grow: 300,
      fade: drip.fade,
      tear: () => setOpen(false),
      arrived: () => {
        scatterInk(drip.fade * slow);
        settleIn(drip.fade * slow);
      }
    });

    // The wound closes as it usually does: its lips press together, then it shuts in from both tips to the middle
    setOpen(false);
    if (slow > 1) rift.getAnimations({ subtree: true }).forEach(motion => motion.playbackRate = 1 / slow);

    // From the moment it starts closing, ink wells up out of the wound, fed from along the seam, swelling and hanging
    // heavier as the wound squeezes in on it. The wound shutting is what cuts it off: the seam it seeps from shortens
    // as the wound shuts in from both tips, and the moment it's shut the whole drop lets go, all of it at once, and
    // falls, from rest and quickening as gravity would have it, drawn out a little by its speed, the tail it hung by
    // rounding up as it goes. It's drawn as one shape all the way, from a point (its `tip`), widening smoothly down
    // a neck into the body of the drop.
    const { left, top, width, height } = rift.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const mix = (from, to, way) => from + (to - from) * way;
    // Drawn to the wound's own size (smaller on small screens, css/platform.css)
    const scale = height / H;
    const R = drip.radius * scale;
    // It lands on screen, wherever the wound is (falling less far if it's near the foot of the screen), so the pool
    // is seen to open where it lands
    const fall = Math.max(40, Math.min(drip.fall, innerHeight - 24 - y - R * 4 - 6 - drip.sag));
    // How far the open seam still reaches either side of the middle (px), `time` (ms) into the closing: it shuts in
    // from both tips over the last 150ms of it (css/platform.css)
    const seamAt = time => {
      const way = Math.min(1, Math.max(0, (time - drip.ooze + 150) / 150));
      return (1 - way * way * (3 - 2 * way)) * height / 2;
    };
    // `time` (ms) in: where its tip is, how thick the neck it tapers up into it by (a half-width), and where the
    // middle of the drop is and how wide and tall (half-sizes), all in px from the point where the wound shuts
    const shape = time => {
      if (time < drip.ooze) {
        const way = time / drip.ooze;
        const rx = R * mix(0.2, 1, Math.sqrt(way));
        const ry = rx * mix(1, 1.15, way);
        const c = ry + mix(0, 6, way) + drip.sag * way * way;
        return {
          tip: -Math.min(drip.root * scale, seamAt(time)), neck: mix(rx * 0.8, 3 * scale, way),
          c, rx, ry, opacity: Math.min(1, way / 0.25)
        };
      }
      const way = (time - drip.ooze) / drip.drop;
      const hung = R * 1.15 + 6 + drip.sag;
      const c = hung + fall * way * way;
      const rx = R * mix(1, 0.82, way);
      const ry = R * mix(1.15, 1.5, way);
      // The tail it hung by draws up into the drop over the first part of the fall
      const rounding = 1 - (1 - Math.min(1, way / 0.4)) ** 2;
      const tail = mix(hung - R * 1.15, ry * 0.4, rounding);
      return { tip: c - ry - tail, neck: mix(3 * scale, 0, rounding), c, rx, ry, opacity: 1 };
    };
    const total = drip.ooze + drip.drop;
    // Liquid has no corners, so its edge is one smooth curve: how wide it is, all the way from its tip down to the
    // middle of the drop, blends a neck tapering up to the tip with the full body of the drop below; under that it
    // rounds off as the bottom of the drop. The body's upper half takes up about as much of the way as its lower
    // half (`full`, an exponent fitted to that), however long the neck above it.
    const outline = ({ tip, neck, c, rx, ry }) => {
      const length = c - tip;
      const thread = Math.min(0.9, neck / rx);
      const half = Math.sin(Math.PI / 2 * Math.max(0.05, 1 - 0.8 * ry / length));
      const full = Math.max(0.5, Math.log(0.5) / Math.log(half));
      const side = Array.from({ length: 41 }, (_, k) => {
        const way = Math.sin(Math.PI / 2 * k / 40);
        return [rx * (thread * way ** 0.7 + (1 - thread) * way ** full), tip + length * k / 40];
      });
      const down = side.map(([w, y]) => `${(-w).toFixed(2)} ${y.toFixed(2)}`).join('L');
      const up = side.reverse().map(([w, y]) => `${w.toFixed(2)} ${y.toFixed(2)}`).join('L');
      return `M${down}A${rx} ${ry} 0 0 0 ${up}Z`;
    };
    const end = shape(total);
    const depth = end.c + end.ry + 40;
    const ns = 'http://www.w3.org/2000/svg';
    const drop = document.createElementNS(ns, 'svg');
    drop.setAttribute('class', 'world-drop');
    drop.setAttribute('viewBox', `-40 -20 80 ${depth}`);
    Object.assign(drop.style, { left: `${x - 40}px`, top: `${y - 20}px`, width: '80px', height: `${depth}px` });
    // Lit from the drop's body, so the neck and the lip it hangs from are the darker, thinner edges of the same ink
    drop.innerHTML = `<defs><radialGradient id="ink-sheen" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fffaf0"/><stop offset="0.3" stop-color="#f1e6c8"/>
      <stop offset="0.6" stop-color="#d9c497"/><stop offset="1" stop-color="#b09060"/></radialGradient>
      <linearGradient id="ink-seep" gradientUnits="userSpaceOnUse" x1="0" x2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <mask id="ink-root" maskUnits="userSpaceOnUse" x="-40" y="-20" width="80" height="${depth}">
      <rect x="-40" y="-20" width="80" height="${depth}" fill="url(#ink-seep)"/></mask></defs>
      <path fill="url(#ink-sheen)" stroke="#8a6a3a" stroke-width="0.6" stroke-opacity="0.7" mask="url(#ink-root)"/>`;
    const sheen = drop.querySelector('radialGradient');
    const seep = drop.querySelector('linearGradient');
    const ink = drop.querySelector('path');
    const draw = now => {
      const time = Math.min(total, now / slow);
      const at = shape(time);
      ink.setAttribute('d', outline(at));
      sheen.setAttribute('cx', at.rx * 0.25);
      sheen.setAttribute('cy', at.c - at.ry * 0.3);
      sheen.setAttribute('r', Math.max(at.rx, at.ry) * 1.8);
      // Fading out up the seam, from where it leaves the wound to its tip, while it's still seeping from there
      const root = Math.max(0, -at.tip);
      seep.setAttribute('y1', -root - 0.01);
      seep.setAttribute('y2', root * 0.6);
      drop.style.opacity = at.opacity;
      return time < total;
    };
    draw(0);
    document.querySelector('main').appendChild(drop);
    const start = performance.now();
    const landAt = start + total * slow;
    const falling = new Promise(resolve => {
      const frame = now => draw(now - start) ? requestAnimationFrame(frame) : resolve();
      requestAnimationFrame(frame);
    });
    const landX = x;
    const landY = y + end.c + end.ry * 0.5;

    // Where it lands it spreads into a pool of paper, and it's only ever moved, never redrawn, so even a phone can
    // keep up with it: a blob with a darker wet rim, drawn at the size it ends up and shrunk to nothing to start
    // with, its rim no more than a hairline then. Its lumps (corners each rounded a little differently) stay within
    // about 85% of its reach, so it ends up just past the farthest corner of the screen.
    const farthest = Math.hypot(Math.max(landX, innerWidth - landX), Math.max(landY, innerHeight - landY));
    const reach = farthest / 0.85 + drip.rim;
    const lumps = Array.from({ length: 8 }, () => `${random(44, 56).toFixed(1)}%`);
    const pool = Object.assign(document.createElement('div'), { className: 'world-pool' });
    Object.assign(pool.style, {
      left: `${landX - reach}px`, top: `${landY - reach}px`, width: `${reach * 2}px`, height: `${reach * 2}px`,
      borderWidth: `${drip.rim}px`, borderRadius: `${lumps.slice(0, 4).join(' ')} / ${lumps.slice(4).join(' ')}`
    });
    // Splashing straight out from where it landed, carried on by the drop's own speed, then gathering pace and
    // rushing out to the edges, as the Upside Down's light does, turning a little as it goes
    const turned = random(-0.6, 0.6);
    const spread = Array.from({ length: 25 }, (_, k) => {
      const step = k / 24;
      const grown = Math.max(0.001, drip.splash * step + (1 - drip.splash) * step ** 3);
      return { transform: `rotate(${(turned * step).toFixed(3)}rad) scale(${grown.toFixed(4)})` };
    });

    await falling;
    await ready;
    // It becomes the pool
    drop.remove();
    document.body.appendChild(pool);
    await pool.animate(spread, { duration: drip.spread * slow, easing: 'linear', fill: 'forwards' }).finished;

    // Under it, the page turns to the newspaper with its print not yet risen, so just the same bare paper; once
    // that's laid out, the pool clears off it, ink runs along the rules and the print rises, outward from where the
    // drop landed
    const landed = { x: landX, y: landY };
    arrive('paper');
    scatterInk(drip.fade * slow, landed);
    settleIn(0);
    // The paper's still damp where the pool was, and dries outward from where the drop landed: a darker layer
    // drawn with a dry patch at its middle, only ever scaled up from there (so its dampness always reaches the
    // screen's farthest corner) and faded as it goes (css/platform.css)
    const dampReach = farthest * 1.05;
    const dryAtFirst = 0.6 * farthest / (drip.dryGrows * dampReach);
    const damp = Object.assign(document.createElement('div'), { className: 'world-damp' });
    Object.assign(damp.style, {
      left: `${landX - dampReach}px`, top: `${landY - dampReach}px`, width: `${dampReach * 2}px`, height: `${dampReach * 2}px`
    });
    damp.style.setProperty('--dry', `${(dryAtFirst * 100).toFixed(2)}%`);
    document.body.appendChild(damp);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // Only once the newspaper's laid out (which takes a phone a while), and timed to start running as the pool's
    // half cleared, so none of it's spent out of sight
    ruleInk(landed, drip.fade * 0.5 * slow);
    damp.animate([
      { transform: 'scale(1)', opacity: 1 },
      { opacity: 1, offset: 0.35 },
      { transform: `scale(${drip.dryGrows})`, opacity: 0 }
    ], { duration: drip.dry * slow, easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)', fill: 'forwards' }).finished.then(() => damp.remove());
    await pool.animate([{ opacity: 1 }, { opacity: 0 }], { duration: drip.fade * slow, easing: 'ease-out', fill: 'forwards' }).finished;
    pool.remove();
  };

  // Into the Upside Down: the slit rips open (see ripOpen above) while red light swells out of it
  const intoUpsideDown = ready => flood(ready, 'upside', {
    grow: 400,
    fade: 220,
    tear: () => {
      const reveal = ripOpen();
      return () => healRip(reveal);
    },
    arrived: () => settleIn()
  });

  const setOpen = open => {
    if (open === platform.classList.contains('is-open')) return;
    if (open) build();
    // Either half may be clicked, so get both worlds ready
    if (open) gateWorlds.forEach(loadWorld);
    platform.classList.toggle('is-open', open);
    haze.classList.toggle('is-open', open);
    clearTimeout(sporeTimer);
    clearInterval(sporeTimer);
    clearTimeout(shadowTimer);
    clearTimeout(healTimer);
    if (!open) shadow?.getAnimations().forEach(animation => animation.cancel());
    if (open && !reduceMotion.matches) shadowTimer = setTimeout(passShadow, random(700, 1600));
    // Let the slit split open before anything comes through it
    if (open && !reduceMotion.matches) sporeTimer = setTimeout(() => {
      sporeTimer = setInterval(shedSpore, 140);
    }, 150);
  };

  platform.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') setOpen(true);
  });
  platform.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse' && !crossing) setOpen(false);
  });
  // Touch has no hover, so the first tap opens the gate and a second tap steps through.
  // Nor does a finger ever leave it, so a wound opened by a tap heals over by itself after a while.
  let openedByTap = false;
  let healTimer;
  platform.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || platform.classList.contains('is-open')) return;
    setOpen(true);
    openedByTap = true;
    healTimer = setTimeout(() => crossing || setOpen(false), 5000);
  });
  platform.addEventListener('click', event => {
    if (openedByTap) openedByTap = false;
    else crossOver(worldAt(event.clientY));
  });
  platform.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    crossOver(randomWorld());
  });
  // While tuning (?slow), R in the newspaper jumps straight home and plays the crossing again
  if (slow > 1) document.addEventListener('keydown', event => {
    if (event.key !== 'r' || root.dataset.world !== 'paper' || crossing) return;
    delete root.dataset.world;
    window.dispatchEvent(new Event('resize'));
    setOpen(true);
    setTimeout(() => crossOver('paper'), 500);
  });
  platform.addEventListener('focus', () => setOpen(true));
  platform.addEventListener('blur', () => crossing || setOpen(false));

  // The straw hat: lying faintly in the top bar (css/platform.css). Hovering the spot (or a tap) and it lights up;
  // clicking it, a fist punches it up, spinning, straight at the visitor until it hits the screen in a yellow smash,
  // and behind that the page turns to the Grand Line, the hero now a wanted poster whose bounty counts up
  // (css/worlds/grandline.css).
  const hatSpot = document.querySelector('.hat-spot');
  if (hatSpot) {
    const hat = hatSpot.querySelector('.straw-hat');
    let hatTapped = false;
    let hatHealTimer;
    const setHat = open => {
      if (open && root.dataset.world) return;
      if (open === hatSpot.classList.contains('is-open')) return;
      if (open) loadWorld('grandline');
      hatSpot.classList.toggle('is-open', open);
      clearTimeout(hatHealTimer);
    };

    // The feel, tuned as a whole (all slowed down under ?slow). Each stage starts the instant the last one lands, so
    // the hit carries straight through to the smash
    const toss = {
      punch: 120, // how long the fist takes to shoot up to the hat (ms)
      flight: 440, // how long the hat takes to fly up at the screen (ms)
      spins: 1.25, // how many times it turns over on the way
      fills: 1.6, // how large it ends up, as it comes right at the visitor: this many times the screen's longer side
      smash: 180, // how long the yellow smash takes to fill the screen (ms)
      clear: 200 // how long the smash takes to clear off the new world, as quick as the other worlds' (ms)
    };
    const ns = 'http://www.w3.org/2000/svg';

    // A comic-book smash, spiky and lopsided, yellow inside a black outline, drawn 200px across around (x, y)
    const drawSmash = (x, y) => {
      const spikes = 16;
      const points = Array.from({ length: spikes * 2 }, (_, k) => {
        const angle = k / (spikes * 2) * Math.PI * 2;
        const r = (k % 2 ? 62 : 100) * random(0.82, 1.1);
        return point([Math.cos(angle) * r, Math.sin(angle) * r]);
      }).join(' ');
      const smash = document.createElementNS(ns, 'svg');
      smash.setAttribute('class', 'world-burst');
      smash.setAttribute('viewBox', '-100 -100 200 200');
      Object.assign(smash.style, { left: `${x - 100}px`, top: `${y - 100}px`, width: '200px', height: '200px' });
      smash.innerHTML = `<polygon points="${points}" fill="#ffd23b" stroke="#1a1a1a" stroke-width="4" stroke-linejoin="round"/>`;
      return document.body.appendChild(smash);
    };

    // The hat is knocked flying: a fist punches up from below the screen into it, and it spins up off the bar,
    // straight at the visitor, growing until it hits the screen in a yellow smash that fills it, and the page changes
    // behind that
    const throwHat = async () => {
      if (crossing || root.dataset.world) return;
      crossing = true;
      const ready = loadWorld('grandline');
      // The hat lights down (the copy that's thrown keeps its colour, css/platform.css)
      setHat(false);
      const x = innerWidth / 2;
      const y = innerHeight / 2;
      let smash;

      if (reduceMotion.matches) {
        smash = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'world-flash is-grandline' }));
        await smash.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' }).finished;
      } else {
        // The hat is lifted out of the bar onto the screen, just where it lies (it only ever fades in place, so its box is
        // exactly where it's drawn), and the fist aims at the same spot
        const { left, top, width, height } = hat.getBoundingClientRect();
        const bottom = top + height;
        const flying = hat.cloneNode(true);
        flying.classList.add('is-thrown');
        Object.assign(flying.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
        document.body.appendChild(flying);

        const punch = toss.punch * slow;
        const flight = toss.flight * slow;
        // A rubber arm stretches up from below the screen, behind the hat, its knuckles (24px above the arm's end)
        // meeting the underside of the brim; it follows through a little and stays up there, held, until the smash
        // covers it
        const fist = Object.assign(document.createElement('div'), { className: 'rubber-punch' });
        fist.style.left = `${left + width / 2}px`;
        document.body.appendChild(fist);
        const reach = innerHeight - (bottom - 4) - 24;
        fist.animate([
          { height: '0px', easing: 'cubic-bezier(0.5, 0, 1, 1)' },
          { height: `${reach}px`, offset: 0.7, easing: 'ease-out' },
          { height: `${reach + 14}px` }
        ], { duration: punch / 0.7, fill: 'forwards' });

        // The hat leaves the moment it's hit: squashed by the blow, knocked up off the bar, then on down at the
        // visitor, growing faster the nearer it comes, at a steady pace so it never hangs
        const dx = x - (left + width / 2);
        const dy = y - (top + height / 2);
        const turn = toss.spins * 360;
        const grows = toss.fills * Math.max(innerWidth, innerHeight) / width;
        flying.animate([
          { transform: 'translate(0, 0) rotate(0deg) scale(1, 1)' },
          { transform: 'translate(0, -4px) rotate(0deg) scale(1.2, 0.75)', offset: 0.03, easing: 'cubic-bezier(0.1, 0.9, 0.3, 1)' },
          { transform: `translate(${dx * 0.15}px, -36px) rotate(${turn * 0.3}deg) scale(1.8)`, offset: 0.15 },
          { transform: `translate(${dx * 0.65}px, ${dy * 0.6}px) rotate(${turn * 0.7}deg) scale(${grows * 0.15})`, offset: 0.6 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${turn}deg) scale(${grows})` }
        ], { duration: flight, delay: punch, fill: 'forwards' });

        // And as it reaches the screen, it bursts into the smash (held at nothing until then)
        smash = drawSmash(x, y);
        await smash.animate([
          { transform: 'scale(0) rotate(-10deg)' },
          { transform: 'scale(0.3) rotate(-10deg)', offset: 0.01 },
          { transform: `scale(${2.4 * Math.hypot(x, y) / 100}) rotate(8deg)` }
        ], { duration: toss.smash * slow, delay: punch + flight, easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)', fill: 'both' }).finished;
        flying.remove();
        fist.remove();
      }

      // As with the other worlds, the page changes under the cover and settles in as the cover clears off it
      await ready;
      arrive('grandline');
      window.scrollTo({ top: 0, behavior: 'instant' });
      settleIn(toss.clear * slow);
      setTimeout(countBounty, toss.clear * slow);
      await smash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: toss.clear * slow, easing: 'ease-out', fill: 'forwards' }).finished;
      smash.remove();
      crossing = false;
    };

    // The bounty on the poster rolls up from nothing to its full sum
    const countBounty = () => {
      const amount = document.querySelector('.bounty-amount');
      if (!amount) return;
      const full = amount.dataset.full ??= amount.textContent;
      const sum = Number(full.replace(/,/g, ''));
      const start = performance.now();
      const roll = now => {
        const t = Math.min(1, (now - start) / (1600 * slow));
        amount.textContent = Math.round(sum * (1 - (1 - t) ** 4)).toLocaleString('en-US');
        if (t < 1) requestAnimationFrame(roll);
      };
      requestAnimationFrame(roll);
    };

    hatSpot.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') setHat(true);
    });
    hatSpot.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse' && !crossing) setHat(false);
    });
    // As at the gate, the first tap brings the hat up and a second reaches for it; left alone, it slips back down
    hatSpot.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || hatSpot.classList.contains('is-open') || root.dataset.world) return;
      setHat(true);
      hatTapped = true;
      hatHealTimer = setTimeout(() => crossing || setHat(false), 5000);
    });
    hatSpot.addEventListener('click', () => {
      if (hatTapped) hatTapped = false;
      else throwHat();
    });
    hatSpot.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      throwHat();
    });
    hatSpot.addEventListener('focus', () => setHat(true));
    hatSpot.addEventListener('blur', () => crossing || setHat(false));
  }
}
