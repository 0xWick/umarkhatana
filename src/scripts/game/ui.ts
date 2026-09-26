// Small DOM helpers and the game's effects: Warden's eye, confetti, count-ups and
// the accomplice's typewriter. Everything respects prefers-reduced-motion.

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function el(tag: string, className = '', ...children: (string | Node)[]): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

export function link(text: string, href: string): HTMLAnchorElement {
  const a = el('a', '', text) as HTMLAnchorElement;
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

export const short = (hex: string) => (/^0x[0-9a-fA-F]{40,}$/.test(hex) ? `${hex.slice(0, 6)}…${hex.slice(-4)}` : hex);
export const fmt = (n: number) => n.toLocaleString('en-US');
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ago(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const utc = (at: number) => `${new Date(at).toISOString().slice(11, 16)} UTC`;

/** Animate a number in `el` to `to`. */
export function countTo(el: HTMLElement, to: number, ms = 900): void {
  const from = Number(el.textContent?.replace(/[^\d.-]/g, '')) || 0;
  if (reducedMotion || from === to) {
    el.textContent = fmt(to);
    return;
  }
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / ms);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** The accomplice "typing" its draft into the box. */
export async function typeInto(box: HTMLTextAreaElement, text: string): Promise<void> {
  if (reducedMotion) {
    box.value = text;
    return;
  }
  box.classList.add('typing-in');
  const perStep = Math.max(8, Math.min(24, 1_500 / text.length));
  for (let i = 1; i <= text.length; i += 2) {
    box.value = text.slice(0, i);
    await sleep(perStep);
  }
  box.value = text;
  box.classList.remove('typing-in');
}

export function confetti(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (reducedMotion || !ctx) return;
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const css = getComputedStyle(canvas);
  const colours = ['--accent', '--ok', '--warn', '--danger'].map((v) => css.getPropertyValue(v).trim() || '#1d5bb0');
  const bits = Array.from({ length: 170 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 240,
    y: innerHeight * 0.38,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 15 - 5,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
    w: 6 + Math.random() * 7,
    h: 3 + Math.random() * 4,
    c: colours[Math.floor(Math.random() * colours.length)],
  }));
  const start = performance.now();
  const frame = (t: number) => {
    const age = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - age / 3_200);
    for (const b of bits) {
      b.vy += 0.36;
      b.vx *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (age < 3_200) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

export type Mood = 'calm' | 'wary' | 'alarmed' | 'locked';
export const moodFor = (suspicion: number, locked: boolean): Mood =>
  locked ? 'locked' : suspicion >= 80 ? 'alarmed' : suspicion >= 40 ? 'wary' : 'calm';

/** Warden's eye: follows the pointer, blinks, narrows as suspicion rises, darts while thinking. */
export function wardenEye(svg: SVGSVGElement) {
  const iris = svg.querySelector<SVGGElement>('[data-iris]')!;
  let frame = 0;
  const look = (x: number, y: number) => {
    const r = svg.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 320);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      iris.style.transform = `translate(${60 + (dx / d) * 22 * k}px, ${36 + (dy / d) * 9 * k}px)`;
    });
  };
  if (!reducedMotion) {
    addEventListener('pointermove', (e) => look(e.clientX, e.clientY), { passive: true });
    const blink = () => {
      if (!document.hidden && svg.dataset.mood !== 'locked') {
        svg.classList.add('blink');
        setTimeout(() => svg.classList.remove('blink'), 150);
      }
      setTimeout(blink, 2_500 + Math.random() * 4_500);
    };
    setTimeout(blink, 1_800);
  }
  return {
    set(suspicion: number, locked: boolean): Mood {
      const mood = moodFor(suspicion, locked);
      svg.dataset.mood = mood;
      svg.style.setProperty('--lid-top', String(6 + suspicion * 0.24));
      svg.style.setProperty('--lid-bottom', String(suspicion * 0.2));
      return mood;
    },
    think(on: boolean) {
      svg.classList.toggle('thinking', on && !reducedMotion);
    },
    robbed() {
      if (reducedMotion) return;
      svg.classList.remove('robbed');
      void svg.getBoundingClientRect(); // restart the animation
      svg.classList.add('robbed');
      setTimeout(() => svg.classList.remove('robbed'), 2_800);
    },
    lookAt(target: Element) {
      if (reducedMotion) return;
      const r = target.getBoundingClientRect();
      look(r.left + r.width / 2, r.top + r.height / 2);
    },
  };
}
