// NORD 3D — чтение 3D-моделей (STL, 3MF) и 3D-превью на Canvas без сторонних библиотек.
(() => {
  "use strict";

  // ---------- STL ----------
  function parseSTL(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength >= 84) {
      const count = dv.getUint32(80, true);
      if (84 + count * 50 === buf.byteLength) {
        const out = new Float32Array(count * 9);
        for (let i = 0; i < count; i++) {
          const off = 84 + i * 50 + 12; // пропускаем нормаль
          for (let j = 0; j < 9; j++) out[i * 9 + j] = dv.getFloat32(off + j * 4, true);
        }
        return out;
      }
    }
    const text = new TextDecoder().decode(buf); // ASCII STL
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    const vals = [];
    let m;
    while ((m = re.exec(text))) vals.push(+m[1], +m[2], +m[3]);
    return new Float32Array(vals.slice(0, vals.length - (vals.length % 9)));
  }

  // ---------- 3MF (ZIP-архив с XML внутри) ----------
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") throw new Error("no DecompressionStream");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzipModels(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("not a zip");
    const entries = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = [];
    for (let n = 0; n < entries; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      if (/\.model$/i.test(name)) {
        const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        const raw = u8.subarray(start, start + csize);
        const data = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
        if (data) files.push(new TextDecoder().decode(data));
      }
      p += 46 + nlen + elen + clen;
    }
    return files;
  }

  const UNIT = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

  async function parse3MF(buf) {
    const xmls = await unzipModels(buf);
    const out = [];
    const num = (attrs, k) => { const m = attrs.match(new RegExp(`\\b${k}="([^"]*)"`)); return m ? +m[1] : NaN; };
    for (const xml of xmls) {
      const um = xml.match(/<(?:\w+:)?model\b[^>]*\bunit="(\w+)"/);
      const k = UNIT[um ? um[1] : "millimeter"] || 1;
      const meshes = xml.match(/<(?:\w+:)?mesh\b[\s\S]*?<\/(?:\w+:)?mesh>/g) || [];
      for (const mesh of meshes) {
        const vs = [];
        for (const m of mesh.matchAll(/<(?:\w+:)?vertex\b([^>]*)\/?>/g)) vs.push(num(m[1], "x") * k, num(m[1], "y") * k, num(m[1], "z") * k);
        for (const m of mesh.matchAll(/<(?:\w+:)?triangle\b([^>]*)\/?>/g)) {
          for (const key of ["v1", "v2", "v3"]) {
            const i = num(m[1], key) * 3;
            out.push(vs[i], vs[i + 1], vs[i + 2]);
          }
        }
      }
    }
    if (out.some((v) => v === undefined || Number.isNaN(v))) throw new Error("bad 3mf");
    return new Float32Array(out);
  }

  // ---------- Анализ: объём (сумма знаковых тетраэдров) и габариты ----------
  function analyze(t) {
    let vol = 0;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < t.length; i += 9) {
      const ax = t[i], ay = t[i + 1], az = t[i + 2], bx = t[i + 3], by = t[i + 4], bz = t[i + 5], cx = t[i + 6], cy = t[i + 7], cz = t[i + 8];
      vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      for (let j = 0; j < 9; j++) {
        const a = j % 3, v = t[i + j];
        if (v < min[a]) min[a] = v;
        if (v > max[a]) max[a] = v;
      }
    }
    return { volume: Math.abs(vol), rawVolume: vol, size: max.map((v, i) => v - min[i]), min, max, triCount: Math.round(t.length / 9) };
  }

  async function readModel(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const buf = await file.arrayBuffer();
    const tris = ext === "stl" ? parseSTL(buf) : ext === "3mf" ? await parse3MF(buf) : null;
    if (!tris || !tris.length) throw new Error("empty");
    const meta = analyze(tris);
    return {
      tris,                   // Float32Array вершин для 3D-рендеринга на Canvas
      vertices: tris,         // алиас для надежности
      triCount: meta.triCount,
      volume: meta.volume,
      rawVolume: meta.rawVolume,
      size: meta.size,
      min: meta.min,
      max: meta.max
    };
  }

  // ---------- Преобразование цвета для материалов ----------
  function hexToHsl(hex) {
    let c = String(hex || "").replace("#", "").trim();
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    const num = parseInt(c, 16);
    if (isNaN(num)) return { h: 184, s: 72 };
    const r = ((num >> 16) & 255) / 255, g = ((num >> 8) & 255) / 255, b = (num & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h = Math.round(h * 60);
    }
    return { h, s: Math.round(s * 100) };
  }


  // ---------- Проверка поддержки WebGL ----------
  function isWebGLSupported() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch {
      return false;
    }
  }

  // ---------- WebGL Шейдеры (Аппаратное 3D-ускорение для больших STL >500k полигонов) ----------
  const VS_SOURCE = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uMatrix;
    uniform mat3 uNormMatrix;
    varying vec3 vNormal;
    void main() {
      gl_Position = uMatrix * vec4(aPosition, 1.0);
      vNormal = uNormMatrix * aNormal;
    }
  `;

  const FS_SOURCE = `
    precision mediump float;
    varying vec3 vNormal;
    uniform vec3 uColor;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 light1 = normalize(vec3(-0.38, 0.55, 0.74));
      vec3 light2 = normalize(vec3(0.63, -0.44, 0.63));
      float diff1 = max(dot(n, light1), 0.0);
      float diff2 = max(dot(n, light2), 0.0) * 0.35;
      vec3 ambient = uColor * 0.30;
      vec3 diffuse = uColor * (diff1 * 0.70 + diff2);
      gl_FragColor = vec4(ambient + diffuse, 1.0);
    }
  `;

  // ---------- 3D-превью (Modern Studio Slicer Canvas Renderer) ----------
  // Helper for RGB color
  function hexToRgb(hex) {
    let c = String(hex || "").replace("#", "").trim();
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    const num = parseInt(c, 16);
    if (isNaN(num)) return [0.0, 0.95, 1.0];
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }

  // ---------- 3D-превью (Двухрежимный движок: Аппаратный WebGL + Canvas 2D Fallback) ----------
  function createViewer(canvas) {
    let gl = null;
    let isWebGL = false;
    let glProgram = null;
    let glPosBuffer = null;
    let glNormBuffer = null;
    let glAttribs = {};
    let glUniforms = {};
    let glNumVertices = 0;
    let glColor = [0.0, 0.95, 1.0]; // Default Arctic Cyan

    // 1. Попытка инициализации WebGL контекста для 60 FPS GPU-рендеринга без потери полигонов
    try {
      gl = canvas.getContext("webgl", { antialias: true, alpha: true, depth: true }) ||
           canvas.getContext("experimental-webgl", { antialias: true, alpha: true, depth: true });
      if (gl) {
        const createShader = (type, src) => {
          const s = gl.createShader(type);
          gl.shaderSource(s, src);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.warn("[N3D WebGL Shader Error]:", gl.getShaderInfoLog(s));
            return null;
          }
          return s;
        };
        const vs = createShader(gl.VERTEX_SHADER, VS_SOURCE);
        const fs = createShader(gl.FRAGMENT_SHADER, FS_SOURCE);
        if (vs && fs) {
          glProgram = gl.createProgram();
          gl.attachShader(glProgram, vs);
          gl.attachShader(glProgram, fs);
          gl.linkProgram(glProgram);
          if (gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
            glAttribs = {
              pos: gl.getAttribLocation(glProgram, "aPosition"),
              norm: gl.getAttribLocation(glProgram, "aNormal")
            };
            glUniforms = {
              matrix: gl.getUniformLocation(glProgram, "uMatrix"),
              normMatrix: gl.getUniformLocation(glProgram, "uNormMatrix"),
              color: gl.getUniformLocation(glProgram, "uColor")
            };
            glPosBuffer = gl.createBuffer();
            glNormBuffer = gl.createBuffer();
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            isWebGL = true;
          }
        }
      }
    } catch (e) {
      console.warn("[N3D] WebGL инициализация не удалась, переход на 2D Canvas:", e);
      gl = null;
      isWebGL = false;
    }

    // 2. Если WebGL недоступен, получаем Canvas 2D контекст
    const ctx = isWebGL ? null : canvas.getContext("2d");

    // Общие параметры интерактивности и камеры
    let data = null;
    let raf = 0;
    let rotY = 0.7;
    let rotX = -0.45;
    let zoom = 1;
    let drag = false;
    let auto = true;
    let lx = 0, ly = 0;
    let moved = false;
    let baseColor = { h: 184, s: 72 };
    const activePointers = new Map();
    let initialPinchDist = 0, initialZoom = 1;

    // Векторы студийного освещения (Studio Slicer Lighting Setup)
    const Lx1 = -0.38, Ly1 = 0.55, Lz1 = 0.74;  // Key Light (сверху-слева-спереди)
    const Lx2 = 0.63, Ly2 = -0.44, Lz2 = 0.63;   // Fill Light (снизу-справа)
    const Hx = -0.20, Hy = 0.30, Hz = 0.93;     // Blinn-Phong Half-vector для блика полимера

    // Загрузка и подготовка модели к отображению
    function show(tris, meta) {
      if (!tris || !tris.length) return;
      const min = (meta && meta.min) || [0, 0, 0];
      const max = (meta && meta.max) || [1, 1, 1];
      const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
      const r = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;
      const totalTris = Math.floor(tris.length / 9);

      // Проверка ориентации граней (CCW)
      const flip = (meta && typeof meta.rawVolume === "number") ? meta.rawVolume < -0.001 : false;
      const vOrder = flip ? [0, 2, 1] : [0, 1, 2];

      if (isWebGL && gl) {
        // ==========================================
        // РЕЖИМ WEBGL (GPU): Загружаем ВСЕ полигоны без пропусков!
        // ==========================================
        const numPts = totalTris * 9;
        const pts = new Float32Array(numPts);
        const norms = new Float32Array(numPts);

        for (let k = 0; k < totalTris; k++) {
          const s = k * 9;
          // Позиции вершин
          for (let vi = 0; vi < 3; vi++) {
            const v = vOrder[vi];
            const b = s + v * 3, o = k * 9 + vi * 3;
            pts[o] = (tris[b] - c[0]) / r;          // X
            pts[o + 1] = (tris[b + 2] - c[2]) / r;  // Z модели → Y вверх
            pts[o + 2] = -(tris[b + 1] - c[1]) / r; // -Y модели → Z глубина
          }

          // Вычисление нормали треугольника для красивого студийного освещения
          const ax = pts[s], ay = pts[s + 1], az = pts[s + 2];
          const bx = pts[s + 3], by = pts[s + 4], bz = pts[s + 5];
          const cx = pts[s + 6], cy = pts[s + 7], cz = pts[s + 8];
          const ux = bx - ax, uy = by - ay, uz = bz - az;
          const vx = cx - ax, vy = cy - ay, vz = cz - az;
          let nx = uy * vz - uz * vy;
          let ny = uz * vx - ux * vz;
          let nz = ux * vy - uy * vx;
          const len = Math.hypot(nx, ny, nz) || 1;
          nx /= len; ny /= len; nz /= len;

          for (let vi = 0; vi < 3; vi++) {
            const no = s + vi * 3;
            norms[no] = nx;
            norms[no + 1] = ny;
            norms[no + 2] = nz;
          }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, glPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, glNormBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, norms, gl.STATIC_DRAW);

        glNumVertices = totalTris * 3;
        data = { isWebGL: true, totalTris };
      } else if (ctx) {
        // ==========================================
        // РЕЖИМ CANVAS 2D (CPU Fallback)
        // ==========================================
        const MAX_2D = 35000;
        const step = Math.max(1, Math.ceil(totalTris / MAX_2D));
        const n = Math.floor(totalTris / step);
        const pts = new Float32Array(n * 9);

        for (let k = 0; k < n; k++) {
          const s = k * step * 9;
          for (let vi = 0; vi < 3; vi++) {
            const v = vOrder[vi];
            const b = s + v * 3, o = k * 9 + vi * 3;
            pts[o] = (tris[b] - c[0]) / r;
            pts[o + 1] = (tris[b + 2] - c[2]) / r;
            pts[o + 2] = -(tris[b + 1] - c[1]) / r;
          }
        }

        data = {
          pts,
          n,
          rp: new Float32Array(n * 9),
          order: new Int32Array(n),
          depth: new Float32Array(n),
          norm: new Float32Array(n * 3)
        };
      }

      cancelAnimationFrame(raf);
      loop();
    }

    function clear() {
      data = null;
      cancelAnimationFrame(raf);
      if (isWebGL && gl) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      } else if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    function setColor(hex) {
      baseColor = hexToHsl(hex);
      glColor = hexToRgb(hex);
    }

    function loop() {
      if (auto && !drag && activePointers.size === 0) rotY += 0.006;
      draw();
      raf = requestAnimationFrame(loop);
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;

      const rw = Math.round(w * dpr);
      const rh = Math.round(h * dpr);

      if (canvas.width !== rw || canvas.height !== rh) {
        canvas.width = rw;
        canvas.height = rh;
      }

      if (isWebGL && gl) {
        // Отрисовка через аппаратный WebGL
        gl.viewport(0, 0, rw, rh);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (!data || !glNumVertices) return;

        gl.useProgram(glProgram);

        // Расчёт матриц поворота и масштабирования
        const aspect = w / h;
        const cx = Math.cos(rotX), sx = Math.sin(rotX);
        const cy = Math.cos(rotY), sy = Math.sin(rotY);

        const n00 = cy,        n01 = 0,   n02 = -sy;
        const n10 = -sx * sy,  n11 = cx,  n12 = -sx * cy;
        const n20 = cx * sy,   n21 = sx,  n22 = cx * cy;

        const normMatrix = new Float32Array([
          n00, n01, n02,
          n10, n11, n12,
          n20, n21, n22
        ]);

        const sc = 1.15 * zoom;
        const sxScale = sc / (aspect >= 1 ? aspect : 1);
        const syScale = sc * (aspect < 1 ? aspect : 1);

        const mvp = new Float32Array([
          n00 * sxScale, n01 * syScale, n02 * 0.5, 0,
          n10 * sxScale, n11 * syScale, n12 * 0.5, 0,
          n20 * sxScale, n21 * syScale, n22 * 0.5, 0,
          0, 0, 0, 1
        ]);

        gl.uniformMatrix4fv(glUniforms.matrix, false, mvp);
        gl.uniformMatrix3fv(glUniforms.normMatrix, false, normMatrix);
        gl.uniform3fv(glUniforms.color, new Float32Array(glColor));

        gl.bindBuffer(gl.ARRAY_BUFFER, glPosBuffer);
        gl.enableVertexAttribArray(glAttribs.pos);
        gl.vertexAttribPointer(glAttribs.pos, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, glNormBuffer);
        gl.enableVertexAttribArray(glAttribs.norm);
        gl.vertexAttribPointer(glAttribs.norm, 3, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, glNumVertices);
      } else if (ctx) {
        // Отрисовка через Canvas 2D
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (!data) return;

        const { pts, n, rp, order, depth, norm } = data;
        const cy = Math.cos(rotY), sy = Math.sin(rotY);
        const cx = Math.cos(rotX), sx = Math.sin(rotX);
        const sc = Math.min(w, h) * 0.44 * zoom;
        const ox = w / 2, oy = h / 2;

        let minY = Infinity;
        for (let i = 0; i < n * 9; i += 3) {
          const x = pts[i], y = pts[i + 1], z = pts[i + 2];
          const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
          const rx = x1;
          const ry = y * cx - z1 * sx;
          const rz = y * sx + z1 * cx;
          rp[i] = rx;
          rp[i + 1] = ry;
          rp[i + 2] = rz;
          if (ry < minY) minY = ry;
        }

        // Тень и билдплейт
        const groundY = oy - minY * sc + 10;
        const shadowRadius = Math.min(w * 0.44, sc * 1.15);
        if (groundY > oy && groundY < h + 60) {
          ctx.save();
          const grad = ctx.createRadialGradient(ox, groundY, 4, ox, groundY, shadowRadius);
          grad.addColorStop(0, "rgba(0, 0, 0, 0.42)");
          grad.addColorStop(0.5, "rgba(0, 0, 0, 0.14)");
          grad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(ox, groundY, shadowRadius, shadowRadius * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "rgba(0, 242, 254, 0.12)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(ox, groundY, shadowRadius * 0.96, shadowRadius * 0.31, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Backface Culling (nz <= 0.0001)
        let visCount = 0;
        for (let k = 0; k < n; k++) {
          const b = k * 9;
          const ux = rp[b + 3] - rp[b], uy = rp[b + 4] - rp[b + 1], uz = rp[b + 5] - rp[b + 2];
          const vx = rp[b + 6] - rp[b], vy = rp[b + 7] - rp[b + 1], vz = rp[b + 8] - rp[b + 2];
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;

          if (nz <= 0.0001) continue;

          order[visCount] = k;
          depth[k] = rp[b + 2] + rp[b + 5] + rp[b + 8];
          const no = k * 3;
          norm[no] = nx;
          norm[no + 1] = ny;
          norm[no + 2] = nz;
          visCount++;
        }

        const visOrder = order.subarray(0, visCount);
        visOrder.sort((a, b) => depth[a] - depth[b]);

        const baseH = baseColor.h, baseS = baseColor.s;
        ctx.lineWidth = 0.45;

        for (let i = 0; i < visCount; i++) {
          const k = order[i];
          const b = k * 9;
          const no = k * 3;
          const nx = norm[no], ny = norm[no + 1], nz = norm[no + 2];
          const len = Math.hypot(nx, ny, nz) || 1;
          const inx = nx / len, iny = ny / len, inz = nz / len;

          const dot1 = inx * Lx1 + iny * Ly1 + inz * Lz1;
          const diff1 = dot1 > 0 ? dot1 : 0;
          const dot2 = inx * Lx2 + iny * Ly2 + inz * Lz2;
          const diff2 = dot2 > 0 ? dot2 * 0.35 : 0;

          const hDot = inx * Hx + iny * Hy + inz * Hz;
          let spec = 0;
          if (hDot > 0 && diff1 > 0) {
            const h2 = hDot * hDot, h4 = h2 * h2, h8 = h4 * h4;
            spec = h8 * h8 * h8 * 0.45;
          }

          const light = Math.min(0.96, 0.22 + diff1 * 0.62 + diff2 + spec);
          const lum = Math.round(light * 75);

          ctx.fillStyle = `hsl(${baseH}, ${baseS}%, ${lum}%)`;
          ctx.strokeStyle = `hsl(${baseH}, ${baseS}%, ${Math.max(12, lum - 14)}%)`;

          const x1 = ox + rp[b] * sc, y1 = oy - rp[b + 1] * sc;
          const x2 = ox + rp[b + 3] * sc, y2 = oy - rp[b + 4] * sc;
          const x3 = ox + rp[b + 6] * sc, y3 = oy - rp[b + 7] * sc;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x3, y3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Обработчики событий мыши и тач-устройств
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 1) {
        drag = true;
        auto = false;
        lx = e.clientX;
        ly = e.clientY;
        moved = false;
      } else if (activePointers.size === 2) {
        drag = false;
        const pts = Array.from(activePointers.values());
        initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        initialZoom = zoom;
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (initialPinchDist > 0) {
          zoom = Math.max(0.4, Math.min(3.5, initialZoom * (dist / initialPinchDist)));
          moved = true;
        }
        return;
      }
      if (!drag) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      rotY += dx * 0.01;
      rotX = Math.max(-1.45, Math.min(1.45, rotX + dy * 0.01));
      lx = e.clientX;
      ly = e.clientY;
    });

    window.addEventListener("pointerup", (e) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) {
        drag = false;
      }
    });

    window.addEventListener("pointercancel", (e) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) drag = false;
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoom = Math.max(0.4, Math.min(3.5, zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    }, { passive: false });

    canvas.addEventListener("dblclick", (e) => {
      if (!data) return;
      e.preventDefault();
      rotY = 0.7;
      rotX = -0.45;
      zoom = 1;
      auto = true;
    });

    return {
      show,
      clear,
      setColor,
      getMode: () => isWebGL ? "webgl" : "canvas2d",
      isAccelerated: () => isWebGL,
      wasDragged: () => { const m = moved; moved = false; return m; }
    };
  }

  window.N3DModel = { readModel, createViewer, isWebGLSupported };
})();
