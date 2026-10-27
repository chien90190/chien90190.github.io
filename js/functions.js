// Author linking
const authorLinks = {
  "Yu-Lun Liu": "https://yulunalexliu.github.io/",
  "Yi-Chuan Huang": "https://yichuanh.github.io/",
  "Chung-Ho Wu": "https://kkennethwu.github.io/",
  "Chin-Yang Lin": "https://linjohnss.github.io/",
  "Wei-Lun Chao": "https://sites.google.com/view/wei-lun-harry-chao",
  "Jiewen Chan": "https://jiewenchan.github.io/"

};

function linkAuthors() {
  document.querySelectorAll('.pub-meta').forEach(meta => {
    let html = meta.innerHTML;
    Object.keys(authorLinks).forEach(name => {
      const regex = new RegExp(name, 'g');
      html = html.replace(regex, `<a href="${authorLinks[name]}" target="_blank" rel="noopener">${name}</a>`);
    });
    meta.innerHTML = html;
  });
}


// Name wave: split the title into letters that ripple like a stadium wave on hover
const title = document.querySelector('.hero-text .title');
if (title) {
  const text = title.textContent.trim();
  title.setAttribute('aria-label', text);
  title.innerHTML = [...text].map((ch, i) => ch === ' '
    ? '<span class="char space" aria-hidden="true"> </span>'
    : `<span class="char" aria-hidden="true" style="--i:${i}">${ch}</span>`
  ).join('');

  const chars = title.querySelectorAll('.char:not(.space)');
  const stopTimers = new Map();
  let isHovering = false;

  const startWave = () => chars.forEach(char => {
    clearTimeout(stopTimers.get(char));
    char.classList.add('is-waving');
  });

  // Let each letter finish its current cycle before resting, so stopping never snaps.
  // Timed from the animation itself, since animationiteration events are unreliable on mobile.
  const stopWave = () => chars.forEach(char => {
    clearTimeout(stopTimers.get(char));
    const animation = char.getAnimations()[0];
    if (!animation) {
      char.classList.remove('is-waving');
      return;
    }
    const { delay, duration } = animation.effect.getComputedTiming();
    const elapsed = (animation.currentTime ?? 0) - delay;
    const remaining = elapsed < 0 ? duration - elapsed : duration - (elapsed % duration);
    stopTimers.set(char, setTimeout(() => {
      if (!isHovering) char.classList.remove('is-waving');
    }, remaining));
  });

  // Mouse: wave while hovering. Touch: a tap plays a single wave (touch has no "leave").
  title.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    isHovering = true;
    startWave();
  });

  title.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    isHovering = false;
    stopWave();
  });

  title.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    isHovering = false;
    startWave();
    stopWave();
  });
}

// Avatar: hovering with a mouse (or tapping on touch) sets off a star burst that lights up the whole page
const avatarWrap = document.querySelector('.avatar-wrap');
if (avatarWrap) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sparkColors = ['var(--burst-gold)', 'var(--accent-bright)', 'var(--burst-violet)', 'var(--burst-pale)'];
  const random = (min, max) => min + Math.random() * (max - min);
  let glowTimer;
  let lastBurst = 0;
  const activeBursts = [];

  // Like a wizarding photograph: the portrait stirs on its own every few seconds, and speaks when tapped.
  // The still is a copy of the clip's first frame, so the clip fades in over it invisibly and dissolves back when done.
  const avatarVideo = avatarWrap.querySelector('.avatar-video');
  let stirTimer;

  // When the portrait speaks, the first name in the title waves as it's said
  const nameSpokenAt = 860; // ms into the clip where "Chrissy" starts
  const nameChars = [];
  for (const char of document.querySelectorAll('.hero-text .title .char')) {
    if (char.classList.contains('space')) break;
    nameChars.push(char);
  }
  let cueFrame;
  const waveName = () => nameChars.forEach(char => {
    char.classList.remove('is-called');
    void char.offsetWidth; // restart the wave if it's still running
    char.classList.add('is-called');
    char.addEventListener('animationend', () => char.classList.remove('is-called'), { once: true });
  });

  // Ink caption (laptop variant, data-hint="ink" on the wrap): words write themselves under the portrait,
  // like the Marauder's Map. Hover invites a hello; speaking writes the words as they're said.
  const ink = avatarWrap.querySelector('.avatar-ink');
  const useInk = ink && avatarWrap.dataset.hint === 'ink' && window.matchMedia('(hover: hover)').matches;
  // ms into the clip; each sentence wipes the one before, and a leading \n starts a second row
  // so the caption stays about as wide as the portrait
  const spokenLines = [
    [[100, 'Hi!'], [600, "I'm"], [nameSpokenAt - 100, 'Chrissy.']],
    [[1650, 'I'], [1820, 'work'], [1980, 'on'], [2120, 'research'], [2420, '\nin'], [2600, 'computer'], [3080, 'vision.']]
  ];
  let inkTimers = [];
  const inkCancel = () => {
    inkTimers.forEach(clearTimeout);
    inkTimers = [];
  };
  const inkWrite = (text, { append = false } = {}) => {
    if (append) ink.append(text.startsWith('\n') ? document.createElement('br') : ' ');
    else ink.textContent = '';
    ink.classList.remove('is-fading');
    [...text.trim()].forEach((ch, i) => {
      // A plain space between letters; a span holding only a space would collapse to nothing
      if (ch === ' ') return ink.append(' ');
      const letter = Object.assign(document.createElement('span'), { textContent: ch });
      letter.style.setProperty('--i', i);
      ink.appendChild(letter);
    });
  };
  const inkFade = (delay = 0) => inkTimers.push(setTimeout(() => ink.classList.add('is-fading'), delay));
  // On arriving in another world, the way home stays hidden for a while, so the visitor is left a little lost
  const lostFor = 5000;
  let lostUntil = 0;
  const inkHint = () => {
    if (!useInk || avatarWrap.classList.contains('is-speaking') || avatarWrap.classList.contains('is-spelling')) return;
    if (Date.now() < lostUntil) return;
    inkCancel();
    inkWrite(document.documentElement.dataset.world ? 'take me back' : 'say hello');
  };

  // The very first stir also calls the name, so visitors see the two are linked
  let hasStirred = false;
  // A clip is never cut short: clicks are ignored while it plays (spoken or silent) and while it dissolves back
  let isRewinding = false;
  // The last frame doesn't quite match the first, so dissolve back to the still (a copy of the first frame)
  // and rewind out of sight; the next play then starts from exactly what's on screen
  const dissolve = () => {
    avatarWrap.classList.remove('is-alive');
    isRewinding = true;
    setTimeout(() => {
      isRewinding = false;
      avatarVideo.currentTime = 0;
    }, 300);
  };
  const talk = ({ withSound = false } = {}) => {
    if (!avatarVideo || reduceMotion.matches) return;
    if (!avatarVideo.paused || isRewinding) return;
    clearTimeout(stirTimer);
    cancelAnimationFrame(cueFrame);
    const callName = withSound || !hasStirred;
    hasStirred = true;
    // In the Upside Down the portrait can't be heard, but its silent stirs still get through: the words are spelled
    // out on the Christmas lights instead (css/worlds/upside.css)
    const throughLights = !withSound && useInk && document.documentElement.dataset.world === 'upside';
    avatarWrap.classList.toggle('is-spelling', throughLights);
    avatarVideo.muted = !withSound;
    avatarWrap.classList.toggle('is-speaking', withSound);
    avatarVideo.currentTime = 0;
    avatarVideo.play().then(() => {
      // Cues follow the clip's own clock rather than timers, since phones can take a moment to actually start playing
      const cues = [];
      // Start just ahead of the word so the first letter peaks as it's spoken
      if (callName) cues.push([nameSpokenAt - 150, waveName]);
      if ((withSound && useInk) || throughLights) {
        inkCancel();
        spokenLines.forEach(line => line.forEach(([at, word], i) =>
          cues.push([at, () => inkWrite(word, { append: i > 0 })])));
      }
      cues.sort((a, b) => a[0] - b[0]);
      const runCues = () => {
        while (cues.length && cues[0][0] <= avatarVideo.currentTime * 1000) cues.shift()[1]();
        if (cues.length && !avatarVideo.ended) cueFrame = requestAnimationFrame(runCues);
      };
      runCues();
    }).catch(() => {
      // Blocked (e.g. sound without a fresh click): settle back so the portrait keeps stirring
      avatarWrap.classList.remove('is-speaking', 'is-spelling');
      stirLater();
    });
  };
  const stirLater = (delay = random(4000, 9000)) => {
    clearTimeout(stirTimer);
    stirTimer = setTimeout(() => {
      // No point moving while nobody can see it
      if (document.hidden || avatarWrap.getBoundingClientRect().bottom < 0) stirLater();
      else talk();
    }, delay);
  };
  if (avatarVideo) {
    avatarVideo.addEventListener('playing', () => avatarWrap.classList.add('is-alive'));
    // After the first stir, flash the hint so visitors who never hover still learn it can speak
    let hasHinted = false;
    avatarVideo.addEventListener('ended', () => {
      const wasSpeaking = avatarWrap.classList.contains('is-speaking');
      const wasSpelling = avatarWrap.classList.contains('is-spelling');
      dissolve();
      // Let the spoken (or spelled) words linger a moment before the ink fades
      if (useInk && (wasSpeaking || wasSpelling)) inkFade(800);
      avatarWrap.classList.remove('is-speaking', 'is-spelling');
      // A visitor who clicked already knows it speaks, and spelled words shouldn't be wiped by the hint
      if (wasSpeaking || wasSpelling) hasHinted = true;
      if (!hasHinted) {
        hasHinted = true;
        avatarWrap.classList.add('is-hinting');
        setTimeout(() => avatarWrap.classList.remove('is-hinting'), 2500);
        if (useInk) {
          inkHint();
          inkFade(2500);
        }
      }
      stirLater();
    });
    // Sound needs a real click or tap; browsers block it on hover.
    // In another world (see js/platform.js), a click on the portrait leads back home instead.
    avatarWrap.addEventListener('click', () => {
      if (!document.documentElement.dataset.world) talk({ withSound: true });
    });
    // No right-click menu, so the portrait stays a photograph rather than a media file
    avatarWrap.addEventListener('contextmenu', event => event.preventDefault());
    // First stir comes soon after load, so visitors catch it moving; later ones are spaced out at random
    stirLater(2000);
  }

  const starBurst = event => {
    // In another world the portrait only offers the way home, without the fireworks
    if (document.documentElement.dataset.world) return;
    // A short wait between bursts absorbs accidental doubles (the cursor grazing the edge)
    const now = performance.now();
    if (now - lastBurst < 250) return;
    lastBurst = now;

    // Each burst is heavy to draw, so keep at most three on screen and drop the oldest
    if (activeBursts.length >= 3) activeBursts.shift().remove();

    // On touch there's no hover to hold the glow, so a tap gives a brief one that fades on its own
    if (event.pointerType !== 'mouse') {
      avatarWrap.classList.add('is-glowing');
      clearTimeout(glowTimer);
      glowTimer = setTimeout(() => avatarWrap.classList.remove('is-glowing'), 1200);
    }
    if (reduceMotion.matches) return;

    const rect = avatarWrap.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    // Diameter big enough to reach the farthest corner of the viewport
    const reach = 2 * Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    // Flash and shockwaves are drawn at this small size and scaled up to reach (see style.css)
    const layer = 600;
    const grow = `scale(${reach / layer})`;

    const burst = document.createElement('div');
    burst.className = 'star-burst';
    burst.style.setProperty('--x', `${x}px`);
    burst.style.setProperty('--y', `${y}px`);
    burst.style.setProperty('--layer', `${layer}px`);
    document.body.appendChild(burst);
    activeBursts.push(burst);

    const add = className => burst.appendChild(Object.assign(document.createElement('span'), { className }));
    const shockwave = { duration: 1300, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' };
    const animations = [
      add('wash').animate([
        { opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 0 }
      ], { duration: 1600, easing: 'ease-out' }),
      add('flash').animate([
        { transform: 'scale(0.01)', opacity: 1 },
        { opacity: 1, offset: 0.35 },
        { transform: grow, opacity: 0 }
      ], { duration: 2000, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' }),
      add('shockwave').animate([
        { transform: 'scale(0.01)', opacity: 1 },
        { transform: grow, opacity: 0 }
      ], shockwave),
      add('shockwave echo').animate([
        { transform: 'scale(0.01)', opacity: 1 },
        { transform: grow, opacity: 0 }
      ], { ...shockwave, delay: 180 }),
      // The avatar kicks outward as the burst leaves it
      avatarWrap.animate([
        { scale: 1 },
        { scale: 1.1, offset: 0.25 },
        { scale: 1 }
      ], { duration: 600, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' })
    ];

    for (let i = 0; i < 40; i++) {
      const isStar = i % 3 === 0;
      const spark = add(isStar ? 'spark star' : 'spark');
      const angle = random(0, Math.PI * 2);
      const distance = random(0.2, 1) * reach / 2;
      spark.style.setProperty('--size', `${isStar ? random(10, 22) : random(3, 7)}px`);
      spark.style.setProperty('--color', sparkColors[i % sparkColors.length]);
      animations.push(spark.animate([
        { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
        { opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0.2) rotate(${random(-270, 270)}deg)`, opacity: 0 }
      ], { duration: random(900, 1700), delay: random(0, 80), easing: 'cubic-bezier(0.05, 0.7, 0.3, 1)' }));
    }

    Promise.all(animations.map(animation => animation.finished)).finally(() => {
      burst.remove();
      const index = activeBursts.indexOf(burst);
      if (index !== -1) activeBursts.splice(index, 1);
    });
  };

  avatarWrap.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    starBurst(event);
    inkHint();
  });
  avatarWrap.addEventListener('pointerleave', event => {
    if (!useInk || event.pointerType !== 'mouse' || avatarWrap.matches('.is-speaking, .is-spelling')) return;
    inkCancel();
    inkFade();
  });
  // Stepping into another world (see js/platform.js) starts the time lost. Touch can't hover the portrait to find
  // the way home, so once that's up its caption appears by itself and stays for the rest of the visit.
  let foundTimer;
  if (ink) new MutationObserver(() => {
    clearTimeout(foundTimer);
    if (!document.documentElement.dataset.world) {
      lostUntil = 0;
      if (!useInk) ink.textContent = '';
      return;
    }
    lostUntil = Date.now() + lostFor;
    if (!useInk) foundTimer = setTimeout(() => inkWrite('take me back'), lostFor);
  }).observe(document.documentElement, { attributeFilter: ['data-world'] });
  // A mouse click only makes the portrait speak; touch has no hover, so a tap gets the burst too
  avatarWrap.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') starBurst(event);
  });
}

// Update footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');
const html = document.documentElement;

const currentTheme = localStorage.getItem('theme') || 
  (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

html.setAttribute('data-theme', currentTheme);
if (currentTheme === 'light') {
  sunIcon.style.display = 'none';
  moonIcon.style.display = 'block';
}

themeToggle.addEventListener('click', () => {
  const isLight = html.getAttribute('data-theme') === 'light';

  if (isLight) {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  } else {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  }
});

// Publication videos: play on card hover, or while in view on touch devices
const canHover = window.matchMedia('(hover: hover)').matches;

const videoObserver = canHover ? null : new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.play().catch(() => {});
    else entry.target.pause();
  });
}, { threshold: 0.6 });

document.querySelectorAll('.pub').forEach(card => {
  const video = card.querySelector('.pub-media');
  if (!video) return;

  if (videoObserver) {
    videoObserver.observe(video);
    return;
  }

  card.addEventListener('mouseenter', () => {
    video.play().catch(() => {});
  });

  card.addEventListener('mouseleave', () => {
    video.pause();
    video.currentTime = 0;
  });
});

// Highlight the nav link for the section in view, with a pill that slides between links
const navLinks = document.querySelectorAll('.nav-links a');
const navIndicator = document.querySelector('.nav-indicator');

const moveIndicator = link => {
  if (!navIndicator) return;
  if (!link) {
    navIndicator.classList.remove('is-visible');
    return;
  }
  // The first time it appears, place it without sliding in from the edge
  const firstShow = !navIndicator.classList.contains('is-visible');
  navIndicator.classList.toggle('no-slide', firstShow);
  navIndicator.style.setProperty('--x', `${link.offsetLeft}px`);
  navIndicator.style.setProperty('--w', `${link.offsetWidth}px`);
  navIndicator.classList.add('is-visible');
};
const activeLink = () => document.querySelector('.nav-links a.is-active');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
    });
    moveIndicator(activeLink());
  });
}, { rootMargin: '-45% 0px -50% 0px' });

// With a mouse, the pill follows the cursor across the links and returns to the active one on leave
if (canHover) {
  navLinks.forEach(link => link.addEventListener('mouseenter', () => moveIndicator(link)));
  document.querySelector('.nav-links').addEventListener('mouseleave', () => moveIndicator(activeLink()));
}
// Link widths change when the web font loads or the layout reflows
window.addEventListener('resize', () => moveIndicator(activeLink()));
document.fonts?.ready.then(() => moveIndicator(activeLink()));

document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));

// Copy email function
function copyEmail(event) {
  event.preventDefault();
  const email = 'hjchien90190@nycu.edu.tw';
  navigator.clipboard.writeText(email).then(() => {
    const badge = document.getElementById('email-badge');
    const icon = badge.querySelector('.copy-icon');
    const originalIcon = icon.outerHTML;
    
    icon.outerHTML = '<span style="font-size: 14px;">✓</span>';
    
    setTimeout(() => {
      badge.querySelector('span').outerHTML = originalIcon;
    }, 500);
  });
}

// Toggle publications
function togglePublications() {
  const morePubs = document.getElementById('more-pubs');
  const btn = document.getElementById('toggle-pubs-btn');
  
  if (morePubs.classList.contains('hidden')) {
    morePubs.classList.remove('hidden');
    btn.textContent = 'Show Less Publications ↑';
  } else {
    morePubs.classList.add('hidden');
    btn.textContent = 'Show More Publications ↓';
  }
}

// Toggle the older news, where the whole list is laid out rather than scrolled
function toggleNews(btn) {
  const expanded = document.getElementById('news').classList.toggle('is-expanded');
  btn.textContent = expanded ? 'Less News ↑' : 'Older News ↓';
}

// Call linkAuthors when page loads
linkAuthors();
