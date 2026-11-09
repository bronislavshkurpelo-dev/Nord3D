// NORD 3D — Универсальный легковесный бэкенд и веб-сервер
// Работает на стандартной библиотеке Node.js без внешних зависимостей (Zero Dependencies)
// Архитектура v2.0: SQLite (node:sqlite) + ACID Транзакции + WebSockets + Хранение файлов + Scrypt Auth
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const slicer = require('./slicer');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SQLITE_FILE = path.join(DATA_DIR, 'nord3d.db');
const AUTH_SECRET = process.env.AUTH_SECRET || 'nord3d_arctic_secret_2026';

// Создание системных директорий
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// MIME типы для статики
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.stl': 'model/stl',
  '.3mf': 'model/3mf',
  '.gcode': 'text/x-gcode',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// ==========================================================================
// 1. ИНИЦИАЛИЗАЦИЯ И СХЕМА SQLITE (node:sqlite)
// ==========================================================================
const sqlite = new DatabaseSync(SQLITE_FILE);

function initSQLiteSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      json TEXT,
      updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      status TEXT,
      budget REAL,
      printerId TEXT,
      customerId TEXT,
      json TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS chats (
      threadKey TEXT PRIMARY KEY,
      json TEXT,
      updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS presence (
      userId TEXT PRIMARY KEY,
      lastSeen INTEGER
    );
    CREATE TABLE IF NOT EXISTS wallets (
      userId TEXT PRIMARY KEY,
      userRole TEXT,
      balance REAL,
      frozenEscrow REAL,
      updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      userId TEXT,
      type TEXT,
      amount REAL,
      description TEXT,
      orderId TEXT,
      timestamp INTEGER
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      orderId TEXT,
      printerId TEXT,
      customerName TEXT,
      score REAL,
      json TEXT,
      date INTEGER
    );
    CREATE TABLE IF NOT EXISTS portfolio (
      id TEXT PRIMARY KEY,
      printerId TEXT,
      orderId TEXT,
      json TEXT,
      date INTEGER
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE,
      role TEXT,
      name TEXT,
      district TEXT,
      passwordHash TEXT,
      salt TEXT,
      createdAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT,
      role TEXT,
      name TEXT,
      phone TEXT,
      expiresAt INTEGER
    );
  `);
}
initSQLiteSchema();

// Начальные демо-данные (Seed)
function getInitialData() {
  const day = 86400000, now = Date.now();
  const iso = (d) => new Date(now + d * day).toISOString().slice(0, 10);
  return {
    printers: [
      {
        id: "p79001112233",
        name: "Алексей К.",
        phone: "+7 900 111-22-33",
        telegram: "@nord_print_alex",
        district: "Норильск (центр)",
        tech: ["fdm", "scan"],
        equipment: "Bambu Lab P1S, Creality K1 Max",
        buildArea: "300 × 300 × 300 мм",
        scannerEquipment: "Revopoint POP 3 / RANGE 2",
        scannerAccuracy: "Оптический, до 0.05 мм",
        materials: ["PLA", "PETG", "ABS"],
        specMaterials: ["NYLON", "CARBON"],
        materialPrices: { PLA: 9, PETG: 11, ABS: 12, NYLON: 22, CARBON: 28 },
        pricePerGram: 9,
        minOrder: 400,
        services: ["scanning", "modeling", "urgent", "delivery"],
        about: "Печатаю 4 года. Оптическое 3D-сканирование и реверс-инжиниринг сломанных деталей для авто, снегоходов и техники.",
        rating: 4.9,
        reviews: 37,
        done: 52,
        since: "2022"
      },
      {
        id: "p79002223344",
        name: "Мастерская «Полярный слой»",
        phone: "+7 900 222-33-44",
        telegram: "@polar_layer",
        district: "Талнах",
        tech: ["fdm", "scan"],
        equipment: "3× Prusa MK4, Voron 2.4",
        buildArea: "350 × 350 × 350 мм",
        scannerEquipment: "Creality CR-Scan Ferret Pro",
        scannerAccuracy: "Мобильный лазерный, до 0.1 мм",
        materials: ["PLA", "PETG", "ABS", "TPU"],
        specMaterials: ["PC", "ASA"],
        materialPrices: { PLA: 10, PETG: 11, ABS: 13, TPU: 18, PC: 24, ASA: 16 },
        pricePerGram: 10,
        minOrder: 500,
        services: ["scanning", "modeling", "postprocess", "urgent"],
        about: "Небольшая ферма из 4 принтеров + 3D-сканер деталей. Берём тиражи до 500 шт., делаем покраску и реверс.",
        rating: 4.8,
        reviews: 64,
        done: 118,
        since: "2021"
      },
      {
        id: "p79003334455",
        name: "Дарья М.",
        phone: "+7 900 333-44-55",
        telegram: "@daria_3d_norilsk",
        district: "Кайеркан",
        tech: ["fdm", "sla"],
        equipment: "Bambu Lab A1 + AMS lite, Anycubic Photon Mono M5s",
        buildArea: "220 × 220 × 250 мм",
        materials: ["PLA", "RESIN"],
        materialPrices: { PLA: 8, RESIN: 25 },
        pricePerGram: 8,
        minOrder: 300,
        services: ["postprocess", "delivery"],
        about: "Многоцветная печать и высокодетализированный фотополимер (0.05 мм): фигурки, миниатюры, подарки, таблички.",
        rating: 5.0,
        reviews: 15,
        done: 19,
        since: "2024"
      },
      {
        id: "p79004445566",
        name: "Игорь С.",
        phone: "+7 900 444-55-66",
        telegram: "@igor_print69",
        district: "Норильск (центр)",
        tech: ["fdm"],
        equipment: "Creality Ender-3 V3, Anycubic Kobra 2",
        buildArea: "250 × 250 × 260 мм",
        materials: ["PLA", "PETG"],
        materialPrices: { PLA: 8, PETG: 10 },
        pricePerGram: 8,
        minOrder: 350,
        services: ["urgent"],
        about: "Срочная печать стандартных деталей и шестерней. Работаю без выходных, забирать на Ленина.",
        rating: 4.7,
        reviews: 22,
        done: 41,
        since: "2023"
      }
    ],
    orders: [
      {
        id: "ord-1",
        title: "Крышка редуктора снегохода BRP",
        category: "auto",
        type: "print",
        file: { name: "brp_gearbox_cover.stl", size: 4200000 },
        material: "PETG",
        color: "Черный",
        infill: 40,
        size: [140, 95, 32],
        budget: 1800,
        deadline: iso(3),
        district: "Норильск (центр)",
        comment: "Нужен прочный пластик под масло и мороз -45°C. Толщина стенок от 3 мм.",
        createdAt: now - 3 * 3600000,
        status: "open",
        customer: { id: "c79990001122", name: "Сергей (Норникель)", phone: "+7 999 000-11-22" },
        responses: [
          {
            id: "r-1",
            printerId: "p79001112233",
            printerName: "Алексей К.",
            price: 1600,
            days: 1,
            comment: "Напечатаю сегодня из высокотемпературного PETG или Nylon. Стенки 4 периметра.",
            createdAt: now - 2 * 3600000
          }
        ]
      },
      {
        id: "ord-scan-1",
        title: "3D-сканирование и реверс крыльчатки насоса Grundfos",
        category: "scan",
        type: "scan",
        file: { name: "impeller_photos (4 фото).zip", size: 3100000 },
        material: "PETG",
        color: "Черный",
        size: [130, 130, 45],
        budget: 3500,
        deadline: iso(2),
        district: "Талнах",
        comment: "Отломаны две лопасти. Нужно отсканировать целые лопасти, восстановить геометрию в CAD и напечатать готовую деталь.",
        createdAt: now - 1 * 3600000,
        status: "open",
        customer: { id: "c79990001122", name: "Сергей (Норникель)", phone: "+7 999 000-11-22" },
        responses: [
          {
            id: "r-scan-1",
            printerId: "p79001112233",
            printerName: "Алексей К.",
            price: 3200,
            days: 2,
            comment: "Сделаю оптический скан на Revopoint POP 3, восстановлю шаг лопастей в STEP и напечатаю из ударопрочного Nylon.",
            createdAt: now - 30 * 60000
          }
        ],
        scanDetails: {
          photosCount: 4,
          dimensions: "130 × 130 × 45 мм",
          originalMaterial: "Технический пластик (литье)",
          goalFormat: "Полный реверс-инжиниринг (STEP / CAD)",
          needsPrint: true,
          printMaterial: "PETG",
          printQty: 1,
          printColor: "Черный",
          handoverMethod: "Привезу мастеру лично (Норильск / Талнах / Кайеркан)"
        }
      }
    ],
    chats: {},
    presence: {}
  };
}

// Загрузка и миграция данных в SQLite
function migrateSeedToSQLite() {
  const count = sqlite.prepare("SELECT COUNT(*) as c FROM printers").get().c;
  if (count > 0) return; // Уже заполнено

  let seed = null;
  if (fs.existsSync(DB_FILE)) {
    try {
      seed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {}
  }
  if (!seed) seed = getInitialData();

  const insertP = sqlite.prepare("INSERT OR REPLACE INTO printers (id, json, updatedAt) VALUES (?, ?, ?)");
  for (const p of (seed.printers || [])) {
    insertP.run(p.id, JSON.stringify(p), Date.now());
  }

  const insertO = sqlite.prepare("INSERT OR REPLACE INTO orders (id, status, budget, printerId, customerId, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const o of (seed.orders || [])) {
    insertO.run(o.id, o.status || 'open', Number(o.budget) || 0, o.printerId || null, o.customer?.id || null, JSON.stringify(o), o.createdAt || Date.now(), Date.now());
  }

  const insertC = sqlite.prepare("INSERT OR REPLACE INTO chats (threadKey, json, updatedAt) VALUES (?, ?, ?)");
  for (const [k, v] of Object.entries(seed.chats || {})) {
    insertC.run(k, JSON.stringify(v), Date.now());
  }

  console.log('✅ Данные успешно мигрированы в SQLite (nord3d.db)');
}
migrateSeedToSQLite();

// ==========================================================================
// 2. ACID ТРАНЗАКЦИИ ДЛЯ ЭСКРОУ И КОШЕЛЬКОВ
// ==========================================================================
function getWalletSQLite(userId, role = 'customer') {
  const row = sqlite.prepare("SELECT * FROM wallets WHERE userId = ?").get(userId);
  if (row) return { userId: row.userId, userRole: row.userRole, balance: row.balance, frozenEscrow: row.frozenEscrow };
  const initial = { userId, userRole: role, balance: role === 'customer' ? 5000 : 0, frozenEscrow: 0 };
  sqlite.prepare("INSERT INTO wallets (userId, userRole, balance, frozenEscrow, updatedAt) VALUES (?, ?, ?, ?, ?)")
    .run(userId, role, initial.balance, initial.frozenEscrow, Date.now());
  return initial;
}

function saveWalletSQLite(w) {
  sqlite.prepare("INSERT OR REPLACE INTO wallets (userId, userRole, balance, frozenEscrow, updatedAt) VALUES (?, ?, ?, ?, ?)")
    .run(w.userId, w.userRole, w.balance, w.frozenEscrow, Date.now());
}

function addTransactionSQLite(tx) {
  const id = tx.id || 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  sqlite.prepare("INSERT INTO transactions (id, userId, type, amount, description, orderId, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, tx.userId, tx.type, Number(tx.amount) || 0, tx.description || '', tx.orderId || null, tx.timestamp || Date.now());
  return id;
}

const EscrowService = {
  freeze(orderId, customerId, amount) {
    amount = Number(amount) || 0;
    sqlite.exec("BEGIN TRANSACTION");
    try {
      const w = getWalletSQLite(customerId, 'customer');
      if (w.balance < amount) {
        throw new Error("Недостаточно средств для заморозки эскроу");
      }
      w.balance -= amount;
      w.frozenEscrow += amount;
      saveWalletSQLite(w);

      addTransactionSQLite({
        userId: customerId,
        type: 'escrow_hold',
        amount: -amount,
        description: `Заморозка средств (Гарант NORD 3D) по заказу #${orderId}`,
        orderId: orderId
      });

      // Обновляем заказ в SQLite
      const orderRow = sqlite.prepare("SELECT json FROM orders WHERE id = ?").get(orderId);
      if (orderRow) {
        const o = JSON.parse(orderRow.json);
        o.escrow = { status: 'held', amount: amount, heldAt: Date.now() };
        sqlite.prepare("UPDATE orders SET json = ?, updatedAt = ? WHERE id = ?").run(JSON.stringify(o), Date.now(), orderId);
      }

      sqlite.exec("COMMIT");
      broadcastWs({ type: 'escrow_updated', orderId, status: 'held', amount });
      return { success: true, balance: w.balance, frozenEscrow: w.frozenEscrow };
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },

  release(orderId, customerId, printerId, amount, commissionPercent = 10) {
    amount = Number(amount) || 0;
    sqlite.exec("BEGIN TRANSACTION");
    try {
      const custW = getWalletSQLite(customerId, 'customer');
      custW.frozenEscrow = Math.max(0, custW.frozenEscrow - amount);
      saveWalletSQLite(custW);

      const commission = Math.round(amount * (commissionPercent / 100));
      const payout = amount - commission;

      const printW = getWalletSQLite(printerId, 'printer');
      printW.balance += payout;
      saveWalletSQLite(printW);

      // Казна сервиса
      const treasury = getWalletSQLite('system_treasury', 'admin');
      treasury.balance += commission;
      saveWalletSQLite(treasury);

      addTransactionSQLite({
        userId: customerId,
        type: 'escrow_release',
        amount: 0,
        description: `Оплата заказа #${orderId} перечислена исполнителю`,
        orderId: orderId
      });

      addTransactionSQLite({
        userId: printerId,
        type: 'payout',
        amount: payout,
        description: `Выплата за заказ #${orderId} (за вычетом ${commissionPercent}% комиссии)`,
        orderId: orderId
      });

      addTransactionSQLite({
        userId: 'system_treasury',
        type: 'commission',
        amount: commission,
        description: `Комиссия сервиса за гарант по заказу #${orderId}`,
        orderId: orderId
      });

      const orderRow = sqlite.prepare("SELECT json FROM orders WHERE id = ?").get(orderId);
      if (orderRow) {
        const o = JSON.parse(orderRow.json);
        o.escrow = { status: 'released', amount, payout, commission, releasedAt: Date.now() };
        o.status = 'done';
        sqlite.prepare("UPDATE orders SET status = 'done', json = ?, updatedAt = ? WHERE id = ?").run(JSON.stringify(o), Date.now(), orderId);
      }

      sqlite.exec("COMMIT");
      broadcastWs({ type: 'escrow_updated', orderId, status: 'released', payout, commission });
      return { success: true, payout, commission, printerBalance: printW.balance };
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },

  refund(orderId, customerId, amount) {
    amount = Number(amount) || 0;
    sqlite.exec("BEGIN TRANSACTION");
    try {
      const custW = getWalletSQLite(customerId, 'customer');
      custW.frozenEscrow = Math.max(0, custW.frozenEscrow - amount);
      custW.balance += amount;
      saveWalletSQLite(custW);

      addTransactionSQLite({
        userId: customerId,
        type: 'escrow_refund',
        amount: amount,
        description: `Возврат средств по заказу #${orderId}`,
        orderId: orderId
      });

      const orderRow = sqlite.prepare("SELECT json FROM orders WHERE id = ?").get(orderId);
      if (orderRow) {
        const o = JSON.parse(orderRow.json);
        o.escrow = { status: 'refunded', amount, refundedAt: Date.now() };
        o.status = 'cancelled';
        sqlite.prepare("UPDATE orders SET status = 'cancelled', json = ?, updatedAt = ? WHERE id = ?").run(JSON.stringify(o), Date.now(), orderId);
      }

      sqlite.exec("COMMIT");
      broadcastWs({ type: 'escrow_updated', orderId, status: 'refunded', amount });
      return { success: true, balance: custW.balance };
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  }
};

// ==========================================================================
// 3. БЕЗОПАСНАЯ АУТЕНТИФИКАЦИЯ (SCRYPT HASH + HTTPONLY COOKIES)
// ==========================================================================
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(c => {
    const parts = c.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.n3d_session;
  if (!token) return null;
  const row = sqlite.prepare("SELECT * FROM sessions WHERE token = ? AND expiresAt > ?").get(token, Date.now());
  if (!row) return null;
  return { id: row.userId, role: row.role, name: row.name, phone: row.phone };
}

// ==========================================================================
// 4. ДВУСТОРОННИЙ WEBSOCKET СЕРВЕР (RFC 6455)
// ==========================================================================
const wsClients = new Set();

function encodeWsFrame(data) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const payload = Buffer.from(jsonStr, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeWsFrame(buffer) {
  if (buffer.length < 2) return null;
  const isMasked = (buffer[1] & 0x80) === 0x80;
  let payloadLength = buffer[1] & 0x7f;
  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  let maskingKey = null;
  if (isMasked) {
    if (buffer.length < offset + 4) return null;
    maskingKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + payloadLength) return null;
  const payload = buffer.subarray(offset, offset + payloadLength);
  if (isMasked && maskingKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskingKey[i % 4];
    }
  }
  return { text: payload.toString('utf8'), totalLength: offset + payloadLength };
}

function broadcastWs(msg, excludeSocket = null) {
  const frame = encodeWsFrame(msg);
  for (const client of wsClients) {
    if (client === excludeSocket) continue;
    try {
      client.write(frame);
    } catch {
      wsClients.delete(client);
    }
  }
}

// Server-Sent Events (SSE) подписчики
const sseClients = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
  broadcastWs({ type: event, ...data });
}

// ==========================================================================
// 5. ОСНОВНОЙ HTTP И REST API СЕРВЕР
// ==========================================================================
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50 МБ для STL и фото
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data, extraHeaders = {}) {
  const json = JSON.stringify(data);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  }, extraHeaders));
  res.end(json);
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Healthcheck
  if (pathname === '/api/health') {
    const printersCount = sqlite.prepare("SELECT COUNT(*) as c FROM printers").get().c;
    const ordersCount = sqlite.prepare("SELECT COUNT(*) as c FROM orders").get().c;
    return jsonResponse(res, 200, {
      status: 'ok',
      engine: 'node:sqlite (ACID)',
      printersCount,
      ordersCount,
      wsConnections: wsClients.size,
      uptime: process.uptime(),
      time: new Date().toISOString()
    });
  }

  // 2. Real-time Server-Sent Events (SSE)
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 3. Загрузка бинарных файлов (POST /api/upload)
  if (pathname === '/api/upload' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.data) return jsonResponse(res, 400, { error: 'Данные файла отсутствуют' });

      // Определение расширения
      let ext = '.bin';
      const cleanName = (body.filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      if (cleanName.includes('.')) ext = path.extname(cleanName);

      // Преобразование из Base64
      let rawBase64 = body.data;
      if (rawBase64.includes('base64,')) {
        rawBase64 = rawBase64.split('base64,')[1];
      }
      const buffer = Buffer.from(rawBase64, 'base64');
      const uuid = crypto.randomUUID();
      const storedFileName = `${uuid}${ext}`;
      const filePath = path.join(UPLOADS_DIR, storedFileName);

      fs.writeFileSync(filePath, buffer);
      const relativeUrl = `/uploads/${storedFileName}`;

      return jsonResponse(res, 200, {
        ok: true,
        url: relativeUrl,
        filename: cleanName,
        size: buffer.length
      });
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  // 4. Аутентификация (POST /api/auth/register, /api/auth/login, /api/auth/logout, GET /api/auth/me)
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const phone = (body.phone || '').replace(/\D/g, '');
      if (!phone) return jsonResponse(res, 400, { error: 'Укажите номер телефона' });

      const role = body.role === 'printer' ? 'printer' : 'customer';
      const id = (role === 'printer' ? 'p' : 'c') + phone;
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(body.password || 'nord123', salt);

      sqlite.prepare("INSERT OR REPLACE INTO users (id, phone, role, name, district, passwordHash, salt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, phone, role, body.name || 'Пользователь NORD 3D', body.district || 'Норильск', hash, salt, Date.now());

      const token = crypto.randomBytes(32).toString('hex');
      sqlite.prepare("INSERT INTO sessions (token, userId, role, name, phone, expiresAt) VALUES (?, ?, ?, ?, ?, ?)")
        .run(token, id, role, body.name || 'Пользователь NORD 3D', phone, Date.now() + 7 * 86400000);

      const cookie = `n3d_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`;
      const user = { id, phone, role, name: body.name || 'Пользователь NORD 3D', district: body.district || 'Норильск' };
      return jsonResponse(res, 200, { success: true, user }, { 'Set-Cookie': cookie });
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const phone = (body.phone || '').replace(/\D/g, '');
      const userRow = sqlite.prepare("SELECT * FROM users WHERE phone = ?").get(phone);

      const role = body.role || (userRow ? userRow.role : 'customer');
      const userId = userRow ? userRow.id : (role === 'printer' ? 'p' : 'c') + phone;
      const userName = userRow ? userRow.name : (role === 'printer' ? 'Мастер Норильска' : 'Заказчик');

      // Проверка хэша пароля, если пользователь зарегистрирован
      if (userRow && body.password) {
        const inputHash = hashPassword(body.password, userRow.salt);
        if (inputHash !== userRow.passwordHash) {
          return jsonResponse(res, 401, { error: 'Неверный пароль' });
        }
      }

      const token = crypto.randomBytes(32).toString('hex');
      sqlite.prepare("INSERT INTO sessions (token, userId, role, name, phone, expiresAt) VALUES (?, ?, ?, ?, ?, ?)")
        .run(token, userId, role, userName, phone, Date.now() + 7 * 86400000);

      const cookie = `n3d_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`;
      const user = { id: userId, phone, role, name: userName, district: userRow ? userRow.district : 'Норильск' };
      return jsonResponse(res, 200, { success: true, user }, { 'Set-Cookie': cookie });
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    if (cookies.n3d_session) {
      sqlite.prepare("DELETE FROM sessions WHERE token = ?").run(cookies.n3d_session);
    }
    return jsonResponse(res, 200, { success: true }, {
      'Set-Cookie': 'n3d_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const u = getSessionUser(req);
    if (!u) return jsonResponse(res, 401, { error: 'Не авторизован' });
    return jsonResponse(res, 200, { user: u });
  }

  // 5. Безопасные сделки (Эскроу транзакции)
  if (pathname === '/api/escrow/freeze' && req.method === 'POST') {
    try {
      const b = await parseBody(req);
      const resData = EscrowService.freeze(b.orderId, b.customerId, b.amount);
      return jsonResponse(res, 200, resData);
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/escrow/release' && req.method === 'POST') {
    try {
      const b = await parseBody(req);
      const resData = EscrowService.release(b.orderId, b.customerId, b.printerId, b.amount, b.commissionPercent || 10);
      return jsonResponse(res, 200, resData);
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/escrow/refund' && req.method === 'POST') {
    try {
      const b = await parseBody(req);
      const resData = EscrowService.refund(b.orderId, b.customerId, b.amount);
      return jsonResponse(res, 200, resData);
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  // 6. Мастера (/api/printers)
  if (pathname === '/api/printers') {
    if (req.method === 'GET') {
      const rows = sqlite.prepare("SELECT json FROM printers ORDER BY updatedAt DESC").all();
      const printers = rows.map(r => JSON.parse(r.json));
      return jsonResponse(res, 200, printers);
    }
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        if (!body.id) body.id = 'p' + Date.now();
        sqlite.prepare("INSERT OR REPLACE INTO printers (id, json, updatedAt) VALUES (?, ?, ?)")
          .run(body.id, JSON.stringify(body), Date.now());
        broadcast('printer_updated', body);
        return jsonResponse(res, 200, body);
      } catch (e) {
        return jsonResponse(res, 400, { error: e.message });
      }
    }
  }

  if (pathname.startsWith('/api/printers/') && (req.method === 'PUT' || (req.method === 'POST' && pathname !== '/api/printers'))) {
    const printerId = decodeURIComponent(pathname.replace('/api/printers/', ''));
    const row = sqlite.prepare("SELECT json FROM printers WHERE id = ?").get(printerId);
    if (!row) return jsonResponse(res, 404, { error: 'Printer not found' });
    try {
      const body = await parseBody(req);
      const updated = Object.assign(JSON.parse(row.json), body);
      sqlite.prepare("UPDATE printers SET json = ?, updatedAt = ? WHERE id = ?")
        .run(JSON.stringify(updated), Date.now(), printerId);
      broadcast('printer_updated', updated);
      return jsonResponse(res, 200, updated);
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  if (pathname.startsWith('/api/printers/') && req.method === 'DELETE') {
    const printerId = decodeURIComponent(pathname.replace('/api/printers/', ''));
    sqlite.prepare("DELETE FROM printers WHERE id = ?").run(printerId);
    broadcast('printer_deleted', { id: printerId });
    return jsonResponse(res, 200, { success: true });
  }

  // 7. Заказы (/api/orders)
  if (pathname === '/api/orders') {
    if (req.method === 'GET') {
      const rows = sqlite.prepare("SELECT json FROM orders ORDER BY createdAt DESC").all();
      const orders = rows.map(r => JSON.parse(r.json));
      return jsonResponse(res, 200, orders);
    }
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        if (!body.id) body.id = 'ord-' + Date.now().toString(36);
        sqlite.prepare("INSERT OR REPLACE INTO orders (id, status, budget, printerId, customerId, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(body.id, body.status || 'open', Number(body.budget) || 0, body.printerId || null, body.customerId || body.customer?.id || null, JSON.stringify(body), body.createdAt || Date.now(), Date.now());
        broadcast('order_updated', body);
        broadcastWs({ type: 'order_updated', order: body });
        return jsonResponse(res, 200, body);
      } catch (e) {
        return jsonResponse(res, 400, { error: e.message });
      }
    }
  }

  if (pathname.startsWith('/api/orders/') && (req.method === 'PUT' || (req.method === 'POST' && pathname !== '/api/orders'))) {
    const orderId = decodeURIComponent(pathname.replace('/api/orders/', ''));
    const row = sqlite.prepare("SELECT json FROM orders WHERE id = ?").get(orderId);
    if (!row) return jsonResponse(res, 404, { error: 'Order not found' });
    try {
      const body = await parseBody(req);
      const updated = Object.assign(JSON.parse(row.json), body);
      sqlite.prepare("UPDATE orders SET status = ?, budget = ?, printerId = ?, customerId = ?, json = ?, updatedAt = ? WHERE id = ?")
        .run(updated.status || 'open', Number(updated.budget) || 0, updated.printerId || null, updated.customerId || updated.customer?.id || null, JSON.stringify(updated), Date.now(), orderId);
      broadcast('order_updated', updated);
      broadcastWs({ type: 'order_updated', order: updated });
      return jsonResponse(res, 200, updated);
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  if (pathname.startsWith('/api/orders/') && req.method === 'DELETE') {
    const orderId = decodeURIComponent(pathname.replace('/api/orders/', ''));
    sqlite.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
    broadcast('order_deleted', { id: orderId });
    broadcastWs({ type: 'order_deleted', id: orderId });
    return jsonResponse(res, 200, { success: true });
  }

  // 8. Чаты и сообщения (/api/chats)
  if (pathname === '/api/chats' && req.method === 'GET') {
    const rows = sqlite.prepare("SELECT threadKey, json FROM chats").all();
    const chats = {};
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.json);
        if (Array.isArray(parsed)) {
          const parts = r.threadKey.split('__');
          chats[r.threadKey] = {
            customerId: parts[0],
            printerId: parts[1],
            orderId: parts[2] !== 'direct' ? parts[2] : null,
            customerName: 'Заказчик',
            messages: parsed
          };
        } else {
          chats[r.threadKey] = parsed;
        }
      } catch {
        chats[r.threadKey] = { messages: [] };
      }
    }
    return jsonResponse(res, 200, chats);
  }

  if (pathname.startsWith('/api/chats/') && req.method === 'POST') {
    const threadKey = decodeURIComponent(pathname.replace('/api/chats/', ''));
    try {
      const msg = await parseBody(req);
      if (!msg.id) msg.id = 'm_' + Date.now().toString(36);
      if (!msg.t) msg.t = Date.now();
      if (!msg.time) msg.time = msg.t;

      const row = sqlite.prepare("SELECT json FROM chats WHERE threadKey = ?").get(threadKey);
      let threadObj;
      if (row) {
        try {
          const parsed = JSON.parse(row.json);
          if (Array.isArray(parsed)) {
            const parts = threadKey.split('__');
            threadObj = {
              customerId: parts[0],
              printerId: parts[1],
              orderId: parts[2] !== 'direct' ? parts[2] : null,
              customerName: 'Заказчик',
              messages: parsed
            };
          } else {
            threadObj = parsed;
          }
        } catch {
          threadObj = { messages: [] };
        }
      } else {
        const parts = threadKey.split('__');
        threadObj = {
          customerId: parts[0],
          printerId: parts[1],
          orderId: parts[2] !== 'direct' ? parts[2] : null,
          customerName: 'Заказчик',
          messages: []
        };
      }
      if (!Array.isArray(threadObj.messages)) threadObj.messages = [];
      if (!threadObj.messages.some(m => m.id === msg.id)) {
        threadObj.messages.push(msg);
      }
      threadObj.updatedAt = Date.now();

      sqlite.prepare("INSERT OR REPLACE INTO chats (threadKey, json, updatedAt) VALUES (?, ?, ?)")
        .run(threadKey, JSON.stringify(threadObj), Date.now());

      broadcast('chat_message', { threadKey, message: msg });
      broadcastWs({ type: 'chat_message', threadKey, message: msg });
      return jsonResponse(res, 200, msg);
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  // 9. Кошельки и транзакции (/api/wallets, /api/transactions)
  if (pathname.startsWith('/api/wallets/') && req.method === 'GET') {
    const userId = decodeURIComponent(pathname.replace('/api/wallets/', ''));
    const w = getWalletSQLite(userId);
    return jsonResponse(res, 200, w);
  }

  if (pathname === '/api/transactions' && req.method === 'GET') {
    const userId = parsedUrl.searchParams.get('userId');
    let rows;
    if (userId) {
      rows = sqlite.prepare("SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC LIMIT 100").all(userId);
    } else {
      rows = sqlite.prepare("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 200").all();
    }
    return jsonResponse(res, 200, rows);
  }

  // 10. Статистика платформы (/api/stats)
  if (pathname === '/api/stats' && req.method === 'GET') {
    const ordersRows = sqlite.prepare("SELECT json FROM orders").all();
    const orders = ordersRows.map(r => JSON.parse(r.json));
    const printersRows = sqlite.prepare("SELECT json FROM printers").all();
    const printers = printersRows.map(r => JSON.parse(r.json));

    const totalBudget = orders.reduce((acc, o) => acc + (Number(o.budget) || 0), 0);
    const scanOrders = orders.filter(o => o.isScan || o.type === 'scan' || o.category === 'scan').length;
    const printOrders = orders.length - scanOrders;
    const verifiedPrinters = printers.filter(p => p.verified !== false).length;

    return jsonResponse(res, 200, {
      ordersCount: orders.length,
      totalBudget,
      scanOrders,
      printOrders,
      printersCount: printers.length,
      verifiedPrinters,
      uptime: process.uptime()
    });
  }

  // 11. Онлайн-статус (/api/presence)
  if (pathname === '/api/presence') {
    if (req.method === 'GET') {
      const rows = sqlite.prepare("SELECT userId, lastSeen FROM presence").all();
      const pres = {};
      for (const r of rows) pres[r.userId] = r.lastSeen;
      return jsonResponse(res, 200, pres);
    }
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        if (body.userId) {
          sqlite.prepare("INSERT OR REPLACE INTO presence (userId, lastSeen) VALUES (?, ?)")
            .run(body.userId, Date.now());
        }
        return jsonResponse(res, 200, { ok: true });
      } catch (e) {
        return jsonResponse(res, 400, { error: e.message });
      }
    }
  }

  // 12. Серверный слайсер (/api/slice, /api/slice/profiles)
  if (pathname === '/api/slice/profiles' && req.method === 'GET') {
    return jsonResponse(res, 200, slicer.getAvailableProfiles());
  }

  if (pathname === '/api/slice' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const fileUrl = body.fileUrl || body.filename || body.file;
      if (!fileUrl && !body.data) return jsonResponse(res, 400, { error: 'Укажите fileUrl или данные модели для нарезки' });

      let filePath;
      if (fileUrl) {
        const fileName = path.basename(fileUrl);
        filePath = path.join(UPLOADS_DIR, fileName);
      } else {
        const uuid = crypto.randomUUID();
        filePath = path.join(UPLOADS_DIR, `model_${uuid}.stl`);
      }

      // Сохранение base64 данных, если присланы
      if (body.data) {
        let rawBase64 = body.data;
        if (rawBase64.includes('base64,')) rawBase64 = rawBase64.split('base64,')[1];
        fs.writeFileSync(filePath, Buffer.from(rawBase64, 'base64'));
      }

      if (!fs.existsSync(filePath)) {
        return jsonResponse(res, 404, { error: 'Файл модели не найден на сервере' });
      }

      const sliceRes = await slicer.sliceModel(filePath, {
        profile: body.profile || 'arctic_petg_0.20',
        material: body.material || 'PETG',
        infill: body.infill || 30,
        layerHeight: body.layerHeight || 0.20
      });

      return jsonResponse(res, 200, sliceRes);
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }
  }

  // ==========================================================================
  // 6. РАЗДАЧА СТАТИЧЕСКИХ ФАЙЛОВ И ДИРЕКТОРИИ UPLOADS
  // ==========================================================================
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(fallback)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(fallback).pipe(res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404: Страница не найдена');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isHtml = ext === '.html';

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': isHtml ? 'no-cache' : (/\.(css|js)$/.test(filePath) ? 'no-cache, must-revalidate' : 'public, max-age=604800'),
      'X-Content-Type-Options': 'nosniff'
    };

    const acceptEncoding = req.headers['accept-encoding'] || '';
    const shouldGzip = /text|javascript|json|svg/.test(contentType) && acceptEncoding.includes('gzip');

    if (shouldGzip) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
    } else {
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

// ==========================================================================
// 7. WEBSOCKET UPGRADE HANDLER (RFC 6455)
// ==========================================================================
server.on('upgrade', (req, socket, head) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (parsedUrl.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    'Sec-WebSocket-Accept: ' + accept
  ];

  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
  wsClients.add(socket);

  socket.on('data', buffer => {
    try {
      const frame = decodeWsFrame(buffer);
      if (!frame || !frame.text) return;
      const msg = JSON.parse(frame.text);

      if (msg.type === 'chat_message') {
        const { threadKey, message } = msg;
        if (threadKey && message) {
          const row = sqlite.prepare("SELECT json FROM chats WHERE threadKey = ?").get(threadKey);
          const list = row ? JSON.parse(row.json) : [];
          list.push(message);
          sqlite.prepare("INSERT OR REPLACE INTO chats (threadKey, json, updatedAt) VALUES (?, ?, ?)")
            .run(threadKey, JSON.stringify(list), Date.now());
          broadcastWs(msg);
        }
      } else if (msg.type === 'typing_start' || msg.type === 'typing_stop') {
        // Пересылаем всем участникам кроме отправителя
        broadcastWs(msg, socket);
      } else if (msg.type === 'ping') {
        socket.write(encodeWsFrame({ type: 'pong', time: Date.now() }));
      }
    } catch (e) {
      console.warn('[N3D WS Frame Error]:', e.message);
    }
  });

  socket.on('close', () => wsClients.delete(socket));
  socket.on('error', () => wsClients.delete(socket));
});

// Запуск сервера
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const ifaces = os.networkInterfaces();
    const ips = [];
    for (const [name, addrs] of Object.entries(ifaces)) {
      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal) {
          ips.push({ name, address: a.address });
        }
      }
    }
    ips.sort((a, b) => (b.address.startsWith('192.168.') ? 1 : 0) - (a.address.startsWith('192.168.') ? 1 : 0));
    const lanIp = ips[0] ? ips[0].address : '127.0.0.1';

    console.log(`====================================================`);
    console.log(` 🚀 NORD 3D Сервер готов к презентации!`);
    console.log(` 💻 На этом компьютере:       http://localhost:${PORT}`);
    console.log(` 📱 Со смартфона (по Wi-Fi):   http://${lanIp}:${PORT}`);
    console.log(` 🌐 Удалённо (через 4G / интернет): `);
    console.log(`    Вариант 1 (SSH без утилит): ssh -p 443 -R0:localhost:${PORT} a.pinggy.io`);
    console.log(`    Вариант 2 (через Node):     npx localtunnel --port ${PORT}`);
    console.log(` 💾 База данных:  SQLite (data/nord3d.db)`);
    console.log(` ⚡ WebSockets:   ws://${lanIp}:${PORT}/ws`);
    console.log(` ⚙️ Слайсер:      PrusaSlicer CLI (/api/slice)`);
    console.log(`====================================================`);
  });
}

module.exports = { server, sqlite, EscrowService, hashPassword };
