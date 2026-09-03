// tools/headless-canvas.mjs — enough of Canvas2D to run js/render.js in Node,
// plus a PNG writer, in Node built-ins only (SPEC §1 allows this in tools/).
//
// WHY THIS EXISTS. SPEC §10 is blunt: "Do not author pixel art blind — it does
// not work." The renderer generates art procedurally — grass types, cliff
// faces, waterfalls — and none of it can be judged without looking at it. A
// browser is one way to look; this is the other, and it has three advantages
// that turned out to matter more than expected:
//
//   * it runs in the test suite and in CI, so the checks that a picture cannot
//     make (does every click land where the player aimed? does a full map hold
//     60fps? is every pixel a palette colour?) run automatically,
//   * it is deterministic, so a rendering regression is a diff and not a
//     judgement call,
//   * it does not need a browser tab, which on a project with eight parallel
//     owners is a contended resource.
//
// SCOPE. Exactly the Canvas2D surface js/render.js uses and not one method
// more: createImageData / putImageData / getImageData, 3-argument drawImage,
// clearRect, fillRect + fillStyle, save / restore / beginPath / rect / clip,
// globalAlpha. Everything the renderer draws is per-pixel ImageData or a blit
// of another canvas, because SPEC §3 forbids path drawing for sprite edges —
// which is exactly why this shim can be this small.

import { deflateSync } from 'node:zlib';

const HEX = /^#([0-9a-f]{6})$/i;
const RGBA = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

function parseHex(s) {
  const str = String(s).trim();
  const m = HEX.exec(str);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  // js/render.js paints every overlay in rgba() and strokes the hover diamond
  // in one, so the alpha here is the overlay's whole visual language.
  const r = RGBA.exec(str);
  if (r) return [Number(r[1]) & 255, Number(r[2]) & 255, Number(r[3]) & 255, Math.round((r[4] === undefined ? 1 : Number(r[4])) * 255)];
  return [0, 0, 0, 255];
}

class ImageDataShim {
  constructor(w, h, data) {
    this.width = w;
    this.height = h;
    this.data = data || new Uint8ClampedArray(w * h * 4);
  }
}

class Ctx2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.imageSmoothingEnabled = true;
    this.fillStyle = '#000000';
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this._clip = null; // {x0,y0,x1,y1} or null for the whole canvas
    this._path = null;
    this._poly = null; // moveTo/lineTo points, in DEVICE pixels
    this._stack = [];
    // Only the uniform scale-and-translate js/render.js uses:
    // setTransform(z, 0, 0, z, tx, ty). Skew and rotation are not iso.
    this._t = { s: 1, x: 0, y: 0 };
  }

  setTransform(a, b, c, d, e, f) {
    if (b || c) throw new Error('headless-canvas: only scale+translate, not skew/rotate');
    if (a !== d) throw new Error('headless-canvas: only a UNIFORM scale');
    this._t = { s: a, x: e, y: f };
  }

  save() {
    this._stack.push({ clip: this._clip, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, globalAlpha: this.globalAlpha, t: { ...this._t } });
  }

  restore() {
    const s = this._stack.pop();
    if (!s) return;
    this._clip = s.clip;
    this.fillStyle = s.fillStyle;
    this.strokeStyle = s.strokeStyle;
    this.lineWidth = s.lineWidth;
    this.globalAlpha = s.globalAlpha;
    this._t = s.t;
  }

  /** User space -> device pixels. */
  _dx(x) { return x * this._t.s + this._t.x; }
  _dy(y) { return y * this._t.s + this._t.y; }

  beginPath() {
    this._path = null;
    this._poly = null;
  }

  moveTo(x, y) {
    this._poly = [[this._dx(x), this._dy(y)]];
  }

  lineTo(x, y) {
    if (!this._poly) this._poly = [];
    this._poly.push([this._dx(x), this._dy(y)]);
  }

  closePath() {
    if (this._poly && this._poly.length > 2) this._poly.push([...this._poly[0]]);
  }

  /** Even-odd scanline fill of the moveTo/lineTo polygon (the iso tile diamond). */
  fill() {
    const poly = this._poly;
    if (!poly || poly.length < 3) return;
    const [r, g, bl, pa] = parseHex(this.fillStyle);
    const alpha = (pa / 255) * this.globalAlpha;
    if (alpha <= 0) return;
    const b = this._bounds();
    let ymin = Infinity, ymax = -Infinity;
    for (const [, y] of poly) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
    const y0 = Math.max(b.y0, Math.ceil(ymin));
    const y1 = Math.min(b.y1, Math.ceil(ymax));
    const xs = [];
    for (let y = y0; y < y1; y++) {
      xs.length = 0;
      for (let k = 0; k < poly.length; k++) {
        const [ax, ay] = poly[k];
        const [bx, by] = poly[(k + 1) % poly.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((m, n) => m - n);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const sx = Math.max(b.x0, Math.ceil(xs[k]));
        const ex = Math.min(b.x1, Math.ceil(xs[k + 1]));
        for (let x = sx; x < ex; x++) this._blend(x, y, r, g, bl, alpha);
      }
    }
  }

  /** The polygon's edges, lineWidth rounded to whole pixels. */
  stroke() {
    const poly = this._poly;
    if (!poly || poly.length < 2) return;
    const [r, g, bl, pa] = parseHex(this.strokeStyle);
    const alpha = (pa / 255) * this.globalAlpha;
    if (alpha <= 0) return;
    const w = Math.max(1, Math.round(this.lineWidth * this._t.s));
    for (let k = 0; k + 1 < poly.length; k++) this._line(poly[k], poly[k + 1], r, g, bl, alpha, w);
  }

  _line(a, b, r, g, bl, alpha, w) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    const half = (w - 1) / 2;
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * i) / steps);
      const y = Math.round(a[1] + ((b[1] - a[1]) * i) / steps);
      for (let oy = -Math.floor(half); oy <= Math.ceil(half); oy++) {
        for (let ox = -Math.floor(half); ox <= Math.ceil(half); ox++) this._blend(x + ox, y + oy, r, g, bl, alpha);
      }
    }
  }

  _blend(x, y, r, g, bl, alpha) {
    const c = this.canvas;
    const k = this._clip;
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
    if (k && (x < k.x0 || y < k.y0 || x >= k.x1 || y >= k.y1)) return;
    const d = c._data;
    const t = (y * c.width + x) * 4;
    const inv = 1 - alpha;
    d[t] = r * alpha + d[t] * inv;
    d[t + 1] = g * alpha + d[t + 1] * inv;
    d[t + 2] = bl * alpha + d[t + 2] * inv;
    d[t + 3] = Math.min(255, alpha * 255 + d[t + 3] * inv);
  }

  rect(x, y, w, h) {
    this._path = { x0: x, y0: y, x1: x + w, y1: y + h };
  }

  clip() {
    if (!this._path) return;
    const p = this._path;
    this._clip = this._clip
      ? {
          x0: Math.max(this._clip.x0, p.x0),
          y0: Math.max(this._clip.y0, p.y0),
          x1: Math.min(this._clip.x1, p.x1),
          y1: Math.min(this._clip.y1, p.y1),
        }
      : { ...p };
  }

  /** The clip rectangle intersected with the canvas, as integers. */
  _bounds() {
    const c = this.canvas;
    const k = this._clip;
    return {
      x0: Math.max(0, Math.round(k ? k.x0 : 0)),
      y0: Math.max(0, Math.round(k ? k.y0 : 0)),
      x1: Math.min(c.width, Math.round(k ? k.x1 : c.width)),
      y1: Math.min(c.height, Math.round(k ? k.y1 : c.height)),
    };
  }

  createImageData(w, h) {
    return new ImageDataShim(w, h);
  }

  /** Real putImageData ignores the clip and the alpha. So does this one. */
  putImageData(img, dx, dy) {
    const c = this.canvas;
    const d = c._data;
    for (let y = 0; y < img.height; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= c.height) continue;
      for (let x = 0; x < img.width; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= c.width) continue;
        const s = (y * img.width + x) * 4;
        const t = (ty * c.width + tx) * 4;
        d[t] = img.data[s];
        d[t + 1] = img.data[s + 1];
        d[t + 2] = img.data[s + 2];
        d[t + 3] = img.data[s + 3];
      }
    }
  }

  getImageData(x, y, w, h) {
    const c = this.canvas;
    const out = new ImageDataShim(w, h);
    for (let j = 0; j < h; j++) {
      const sy = y + j;
      if (sy < 0 || sy >= c.height) continue;
      for (let i = 0; i < w; i++) {
        const sx = x + i;
        if (sx < 0 || sx >= c.width) continue;
        const s = (sy * c.width + sx) * 4;
        const t = (j * w + i) * 4;
        out.data[t] = c._data[s];
        out.data[t + 1] = c._data[s + 1];
        out.data[t + 2] = c._data[s + 2];
        out.data[t + 3] = c._data[s + 3];
      }
    }
    return out;
  }

  clearRect(x, y, w, h) {
    const c = this.canvas;
    const b = this._bounds();
    const x0 = Math.max(b.x0, Math.round(x));
    const y0 = Math.max(b.y0, Math.round(y));
    const x1 = Math.min(b.x1, Math.round(x + w));
    const y1 = Math.min(b.y1, Math.round(y + h));
    for (let j = y0; j < y1; j++) {
      c._data.fill(0, (j * c.width + x0) * 4, (j * c.width + x1) * 4);
    }
  }

  fillRect(x, y, w, h) {
    const c = this.canvas;
    const [r, g, bl, pa] = parseHex(this.fillStyle);
    const b = this._bounds();
    const x0 = Math.max(b.x0, Math.round(this._dx(x)));
    const y0 = Math.max(b.y0, Math.round(this._dy(y)));
    const x1 = Math.min(b.x1, Math.round(this._dx(x + w)));
    const y1 = Math.min(b.y1, Math.round(this._dy(y + h)));
    const alpha = (pa / 255) * this.globalAlpha;
    if (alpha < 1) {
      for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) this._blend(i, j, r, g, bl, alpha);
      return;
    }
    for (let j = y0; j < y1; j++) {
      for (let i = x0; i < x1; i++) {
        const t = (j * c.width + i) * 4;
        c._data[t] = r;
        c._data[t + 1] = g;
        c._data[t + 2] = bl;
        c._data[t + 3] = 255;
      }
    }
  }

  /**
   * 3-argument drawImage, source-over, respecting the clip, globalAlpha and
   * the current scale. The scale is NEAREST-NEIGHBOUR, which is not an
   * approximation: js/render.js sets imageSmoothingEnabled = false because
   * SPEC §3 wants whole pixels, so this is what the browser does too.
   */
  drawImage(src, dx, dy) {
    const c = this.canvas;
    const d = c._data;
    const s = src._data;
    if (!s) return;
    const b = this._bounds();
    const z = this._t.s;
    const ox = Math.round(this._dx(dx));
    const oy = Math.round(this._dy(dy));
    const ga = this.globalAlpha;
    const y0 = Math.max(b.y0, oy);
    const y1 = Math.min(b.y1, oy + Math.round(src.height * z));
    const x0 = Math.max(b.x0, ox);
    const x1 = Math.min(b.x1, ox + Math.round(src.width * z));
    for (let ty = y0; ty < y1; ty++) {
      const sy = z === 1 ? ty - oy : Math.min(src.height - 1, ((ty - oy) / z) | 0);
      for (let tx = x0; tx < x1; tx++) {
        const sx = z === 1 ? tx - ox : Math.min(src.width - 1, ((tx - ox) / z) | 0);
        const si = (sy * src.width + sx) * 4;
        let a = s[si + 3];
        if (!a) continue;
        if (ga !== 1) a = a * ga;
        const ti = (ty * c.width + tx) * 4;
        if (a >= 255) {
          d[ti] = s[si];
          d[ti + 1] = s[si + 1];
          d[ti + 2] = s[si + 2];
          d[ti + 3] = 255;
        } else {
          const al = a / 255;
          const inv = 1 - al;
          d[ti] = s[si] * al + d[ti] * inv;
          d[ti + 1] = s[si + 1] * al + d[ti + 1] * inv;
          d[ti + 2] = s[si + 2] * al + d[ti + 2] * inv;
          d[ti + 3] = Math.min(255, a + d[ti + 3] * inv);
        }
      }
    }
  }
}

class CanvasShim {
  constructor(w = 300, h = 150) {
    this._w = 0;
    this._h = 0;
    this.style = {};
    this.width = w;
    this.height = h;
  }

  get width() {
    return this._w;
  }

  set width(v) {
    this._w = v | 0;
    this._alloc();
  }

  get height() {
    return this._h;
  }

  set height(v) {
    this._h = v | 0;
    this._alloc();
  }

  // js/render.js sizes itself from the CSS box and rebuilds when it disagrees
  // with the backing store. Off-screen there is no CSS box, so the two are the
  // same thing by definition and resize() is a no-op: the caller sets .width
  // and .height and the renderer honours them.
  get clientWidth() {
    return this._w;
  }

  get clientHeight() {
    return this._h;
  }

  _alloc() {
    this._data = new Uint8ClampedArray(Math.max(0, this._w * this._h * 4));
    this._ctx = null;
  }

  getContext() {
    if (!this._ctx) this._ctx = new Ctx2D(this);
    return this._ctx;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this._w, height: this._h };
  }
}

/**
 * Install the shim as a global `document`. Idempotent, and it never replaces a
 * real DOM — so a page that imports this by accident is unharmed.
 */
export function installCanvas() {
  if (typeof globalThis.document !== 'undefined' && globalThis.document) return globalThis.document;
  const doc = {
    createElement(tag) {
      if (String(tag).toLowerCase() !== 'canvas') throw new Error(`headless-canvas: only <canvas>, not <${tag}>`);
      return new CanvasShim();
    },
  };
  globalThis.document = doc;
  // js/render.js constructs `new ImageData(data, w, h)` for every rasterised
  // sprite. In a browser that is a platform global; here it is this shim, in
  // the browser's argument order.
  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class extends ImageDataShim {
      constructor(a, b, c) {
        if (typeof a === 'number') super(a, b);
        else super(b, c ?? (a.length / 4 / b), a);
      }
    };
  }
  return doc;
}

export function createCanvas(w, h) {
  return new CanvasShim(w, h);
}

// ---------------------------------------------------------------------------
// PNG out. Filter 0 on every scanline and one zlib block — the point is to be
// readable by a human eye, not small.

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** RGBA canvas (or {width,height,_data}) -> PNG bytes. */
export function encodePNG(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const src = canvas._data;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < w * 4; x++) raw[y * (w * 4 + 1) + 1 + x] = src[y * w * 4 + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Nearest-neighbour zoom, so a 64x32 tile can be looked at honestly. */
export function zoom(canvas, k) {
  const out = new CanvasShim(canvas.width * k, canvas.height * k);
  for (let y = 0; y < out.height; y++) {
    const sy = (y / k) | 0;
    for (let x = 0; x < out.width; x++) {
      const sx = (x / k) | 0;
      const s = (sy * canvas.width + sx) * 4;
      const t = (y * out.width + x) * 4;
      out._data[t] = canvas._data[s];
      out._data[t + 1] = canvas._data[s + 1];
      out._data[t + 2] = canvas._data[s + 2];
      out._data[t + 3] = canvas._data[s + 3];
    }
  }
  return out;
}
