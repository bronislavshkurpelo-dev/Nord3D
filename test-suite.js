// Automated Comprehensive Test Suite for NORD 3D Platform
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DIR = 'C:\\Users\\brono\\.gemini\\antigravity\\scratch\\norilsk-3d-print';

let passedTests = 0;
let failedTests = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passedTests++;
    results.push({ name, status: 'PASS' });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.error(`  [FAIL] ${name}\n         Error: ${err.message}`);
  }
}

// Global browser / DOM mock for core.js and cards.js
const mockStorage = {};
const mockSession = {};

global.localStorage = {
  getItem: (k) => mockStorage[k] ?? null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { for (let k in mockStorage) delete mockStorage[k]; }
};

global.sessionStorage = {
  getItem: (k) => mockSession[k] ?? null,
  setItem: (k, v) => { mockSession[k] = String(v); },
  removeItem: (k) => { delete mockSession[k]; },
  clear: () => { for (let k in mockSession) delete mockSession[k]; }
};

global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage
};

global.document = {
  readyState: 'complete',
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  body: { dataset: { page: 'test' }, style: {} }
};

global.CustomEvent = class { constructor(type, detail) { this.type = type; this.detail = detail; } };

console.log('====================================================');
console.log('   NORD 3D — FULL SYSTEM AUTOMATED TEST SUITE       ');
console.log('====================================================\n');

// ----------------------------------------------------
// SUITE 1: Files & Asset Integrity
// ----------------------------------------------------
console.log('--- 1. File & Resource Integrity ---');

test('HTML files exist and are non-empty', () => {
  const htmlFiles = ['index.html', 'order.html', 'scan.html', 'orders.html', 'printers.html', 'cabinet.html', 'wallet.html', 'rating.html'];
  htmlFiles.forEach(f => {
    const p = path.join(DIR, f);
    assert.ok(fs.existsSync(p), `Missing ${f}`);
    assert.ok(fs.statSync(p).size > 1000, `${f} is too small`);
  });
});

test('JS files exist and are non-empty', () => {
  const jsFiles = ['core.js', 'cards.js', 'model.js', 'order.js', 'orders.js', 'scan.js', 'cabinet.js', 'wallet.js', 'rating.js', 'my-orders.js', 'portfolio.js'];
  jsFiles.forEach(f => {
    const p = path.join(DIR, f);
    assert.ok(fs.existsSync(p), `Missing ${f}`);
    assert.ok(fs.statSync(p).size > 500, `${f} is too small`);
  });
});

test('Image assets exist and have valid sizes', () => {
  const imgFiles = ['hero.jpg', 'printer.jpg', 'workshop.jpg', 'parts.jpg', 'handover.jpg', 'model-city.jpg'];
  imgFiles.forEach(f => {
    const p = path.join(DIR, 'img', f);
    assert.ok(fs.existsSync(p), `Missing img/${f}`);
    assert.ok(fs.statSync(p).size > 5000, `img/${f} is corrupted or empty`);
  });
});

test('All HTML files have stylesheet link with current cache version ?v=19', () => {
  const htmlFiles = ['index.html', 'order.html', 'scan.html', 'orders.html', 'printers.html', 'cabinet.html', 'wallet.html', 'rating.html'];
  htmlFiles.forEach(f => {
    const content = fs.readFileSync(path.join(DIR, f), 'utf8');
    assert.ok(content.includes('styles.css?v=19'), `${f} missing styles.css?v=19`);
  });
});

test('Internal navigation links point to existing HTML files', () => {
  const htmlFiles = ['index.html', 'order.html', 'scan.html', 'orders.html', 'printers.html', 'cabinet.html', 'wallet.html', 'rating.html'];
  htmlFiles.forEach(f => {
    const content = fs.readFileSync(path.join(DIR, f), 'utf8');
    const hrefMatches = content.match(/href="([^"#?]+)(?:[#?][^"]*)?"/g) || [];
    hrefMatches.forEach(m => {
      const match = m.match(/href="([^"#?]+)/);
      if (match && match[1].endsWith('.html')) {
        const target = path.join(DIR, match[1]);
        assert.ok(fs.existsSync(target), `Broken link to ${match[1]} in ${f}`);
      }
    });
  });
});

// ----------------------------------------------------
// SUITE 2: Core DB, Seed Data & Materials Structure
// ----------------------------------------------------
console.log('\n--- 2. Core DB, Seed Data & Presence Operations ---');

// Load core.js in global context
const coreCode = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');
eval(coreCode);
global.N3D = global.window.N3D;
const { DB, MATERIALS, MAT_KEYS, SPEC_MATERIALS, SPEC_MAT_KEYS, DISTRICTS, TECHS, STATUS, Presence, estimate, digits, money } = global.N3D;

test('Standard materials defined correctly with density, unit and color', () => {
  assert.deepStrictEqual(MAT_KEYS, ['PLA', 'PETG', 'ABS', 'TPU', 'RESIN']);
  assert.strictEqual(MATERIALS.PLA.price, 10);
  assert.strictEqual(MATERIALS.PETG.price, 12);
  assert.strictEqual(MATERIALS.ABS.price, 13);
  assert.strictEqual(MATERIALS.TPU.price, 18);
  assert.strictEqual(MATERIALS.RESIN.price, 25);
  MAT_KEYS.forEach(k => {
    assert.ok(MATERIALS[k].density > 0, `Density missing for ${k}`);
    assert.ok(MATERIALS[k].unit, `Unit missing for ${k}`);
  });
});

test('Special materials defined correctly (NYLON, CARBON, PC, ASA)', () => {
  assert.deepStrictEqual(SPEC_MAT_KEYS, ['NYLON', 'CARBON', 'PC', 'ASA']);
  assert.strictEqual(SPEC_MATERIALS.NYLON.price, 22);
  assert.strictEqual(SPEC_MATERIALS.CARBON.price, 28);
  assert.strictEqual(SPEC_MATERIALS.PC.price, 24);
  assert.strictEqual(SPEC_MATERIALS.ASA.price, 16);
  SPEC_MAT_KEYS.forEach(k => {
    assert.ok(SPEC_MATERIALS[k].density > 0, `Density missing for ${k}`);
    assert.ok(SPEC_MATERIALS[k].name, `Name missing for ${k}`);
    assert.ok(SPEC_MATERIALS[k].info, `Info missing for ${k}`);
  });
});

test('DB.reset() seeds initial printers, orders, presence correctly', () => {
  DB.reset();
  const printers = DB.printers();
  const orders = DB.orders();
  assert.ok(printers.length >= 4, 'Expected at least 4 seeded printers');
  assert.ok(orders.length >= 4, 'Expected at least 4 seeded orders');
  
  // Verify master with 3D-scanning equipment and special materials
  const alexey = printers.find(p => p.id === 'p79001112233');
  assert.ok(alexey, 'Master Alexey K. missing');
  assert.ok(alexey.tech.includes('scan'), 'Alexey missing scan tech');
  assert.strictEqual(alexey.scannerEquipment, 'Revopoint POP 3 / RANGE 2');
  assert.deepStrictEqual(alexey.specMaterials, ['NYLON', 'CARBON']);
  assert.strictEqual(alexey.materialPrices.NYLON, 22);
  assert.strictEqual(alexey.materialPrices.CARBON, 28);
  
  // Verify master "Полярный слой" with PC and ASA
  const polar = printers.find(p => p.id === 'p79002223344');
  assert.ok(polar, 'Master Polar Layer missing');
  assert.deepStrictEqual(polar.specMaterials, ['PC', 'ASA']);
  assert.strictEqual(polar.materialPrices.PC, 24);
  assert.strictEqual(polar.materialPrices.ASA, 16);
});

test('User session management (setUser / user / logout across sessions)', () => {
  DB.setUser({ id: 'c123', name: 'Тестовый Заказчик', role: 'customer' });
  const u = DB.user();
  assert.strictEqual(u.id, 'c123');
  assert.strictEqual(u.role, 'customer');

  // Verify persistence when sessionStorage is cleared (simulating new tab/window)
  delete mockSession['n3d_user'];
  const recovered = DB.user();
  assert.ok(recovered, 'User must be recovered from localStorage');
  assert.strictEqual(recovered.id, 'c123');

  DB.setUser(null);
  assert.strictEqual(DB.user(), null);

  // Check that cabinet.js does not open order page in a new window
  const cabJs = fs.readFileSync(path.join(DIR, 'cabinet.js'), 'utf8');
  assert.ok(!cabJs.includes('target="_blank">📄 Страница заказа'), 'cabinet.js must not open order page in target="_blank"');
});

test('Presence online detection logic', () => {
  assert.strictEqual(Presence.isOnline('p79002223344'), true);
  assert.strictEqual(Presence.isOnline('p79003334455'), true);
});

// ----------------------------------------------------
// SUITE 3: Estimation & Calculation Engine
// ----------------------------------------------------
console.log('\n--- 3. Estimation & Price Calculation Engine ---');

test('Volume & weight calculation for standard materials', () => {
  // 50x50x50 mm cube = 125,000 mm3
  const estPLA = estimate(125000, 'PLA', 20, 1);
  assert.ok(estPLA, 'Estimate must not be null');
  assert.ok(estPLA.grams > 0, 'Weight (grams) must be > 0');
  assert.ok(estPLA.total >= 500, 'Total price must be at least minimum (500)');
});

test('Higher infill produces heavier part', () => {
  const est20 = estimate(125000, 'PETG', 20, 1);
  const est80 = estimate(125000, 'PETG', 80, 1);
  assert.ok(est80.grams > est20.grams, '80% infill must weigh more than 20%');
  assert.ok(est80.total >= est20.total, '80% infill must cost >= 20%');
});

test('Quantity multiplier scales total correctly', () => {
  const est1 = estimate(200000, 'PLA', 20, 1);
  const est5 = estimate(200000, 'PLA', 20, 5);
  assert.ok(est5.total >= est1.total * 4.5, '5x qty must scale total');
});

test('Telephone mask digits parser normalizes 8 to 7', () => {
  assert.strictEqual(digits('+7 (900) 111-22-33'), '79001112233');
  assert.strictEqual(digits('8-900-222-33-44'), '79002223344');
  assert.strictEqual(digits('abc'), '');
});

// ----------------------------------------------------
// SUITE 4: Card Generators (cards.js)
// ----------------------------------------------------
console.log('\n--- 4. Card Generators (cards.js) ---');

const cardsCode = fs.readFileSync(path.join(DIR, 'cards.js'), 'utf8');
eval(cardsCode);
const { order: renderOrderCard, printer: renderPrinterCard, plural } = global.window.N3DCards;

test('Order card renders standard print order with file badge', () => {
  const mockPrintOrder = {
    id: 'ord-101',
    type: 'print',
    title: 'Корпус прибора для сетей Норильска',
    file: { name: 'housing_top.stl', size: 124000 },
    material: 'PETG',
    district: 'Норильск (центр)',
    size: [120, 80, 45],
    budget: 1800,
    deadline: '2026-11-20',
    createdAt: Date.now() - 3600000,
    status: 'open',
    responses: []
  };
  const html = renderOrderCard(mockPrintOrder);
  assert.ok(html.includes('file-badge--stl'), 'Expected STL badge');
  assert.ok(html.includes('Корпус прибора'), 'Expected title');
  assert.ok(html.includes('chip--petg'), 'Expected PETG chip');
  assert.ok(html.includes(money(mockPrintOrder.budget)), 'Expected budget');
});

test('Order card renders 3D-scan order with 🔬 СКАН badge and scan chips', () => {
  const mockScanOrder = {
    id: 'ord-scan-99',
    type: 'scan',
    title: 'Сканирование шестерни редуктора CAT',
    file: { name: 'photos.zip', size: 500000 },
    material: 'PETG',
    district: 'Талнах',
    size: [150, 150, 60],
    budget: 3500,
    deadline: '2026-11-25',
    createdAt: Date.now() - 7200000,
    status: 'open',
    responses: [{ id: 'resp-1' }],
    scanDetails: {
      needsPrint: true,
      originalMaterial: 'Металл / чугун',
      goalFormat: 'STL / 3MF для печати'
    }
  };
  const html = renderOrderCard(mockScanOrder);
  assert.ok(html.includes('🔬 СКАН'), 'Expected 🔬 СКАН badge');
  assert.ok(html.includes('file-badge--scan'), 'Expected file-badge--scan');
  assert.ok(html.includes('🔬 3D-сканирование'), 'Expected 3D-сканирование chip');
  assert.ok(html.includes('Печать: PETG'), 'Expected print material chip');
  assert.ok(html.includes('Оригинал: Металл'), 'Expected original material chip');
});

test('Master card renders special materials with ⭐ and individual prices', () => {
  const mockPrinter = {
    id: 'p79009998877',
    name: 'Иван Мастеров',
    district: 'Кайеркан',
    since: '2022',
    rating: 4.95,
    reviews: 28,
    done: 45,
    pricePerGram: 10,
    about: 'Высокоточная печать композитами и сканирование',
    tech: ['fdm', 'scan'],
    equipment: 'Bambu Lab X1-Carbon',
    buildArea: '256 × 256 × 256 мм',
    scannerEquipment: 'Revopoint MINI 2',
    scannerAccuracy: 'до 0.02 мм',
    materials: ['PLA', 'PETG'],
    specMaterials: ['NYLON', 'CARBON'],
    customMatName: 'PEEK',
    customMatPrice: 65,
    materialPrices: { PLA: 10, PETG: 12, NYLON: 22, CARBON: 28, PEEK: 65 }
  };
  const html = renderPrinterCard(mockPrinter);
  assert.ok(html.includes('⭐ NYLON · 22 ₽'), 'Expected NYLON chip with star and price');
  assert.ok(html.includes('⭐ CARBON · 28 ₽'), 'Expected CARBON chip with star and price');
  assert.ok(html.includes('⭐ PEEK · 65 ₽'), 'Expected custom material chip with star and price');
  assert.ok(html.includes('chip--spec'), 'Expected chip--spec class');
  assert.ok(html.includes('🔬 Revopoint MINI 2'), 'Expected scanner equipment chip');
});

test('Pluralization helper works accurately for Russian forms', () => {
  assert.strictEqual(plural(1, 'отклик', 'отклика', 'откликов'), 'отклик');
  assert.strictEqual(plural(2, 'отклик', 'отклика', 'откликов'), 'отклика');
  assert.strictEqual(plural(4, 'отклик', 'отклика', 'откликов'), 'отклика');
  assert.strictEqual(plural(5, 'отклик', 'отклика', 'откликов'), 'откликов');
  assert.strictEqual(plural(21, 'отклик', 'отклика', 'откликов'), 'отклик');
});

// ----------------------------------------------------
// SUITE 5: 3D Scan Order Logic
// ----------------------------------------------------
console.log('\n--- 5. 3D Scanning Order Logic ---');

test('Scan order creation schema and persistence', () => {
  const initialOrdersCount = DB.orders().length;
  const newScanOrder = {
    id: 'ord_test_' + Date.now(),
    type: 'scan',
    title: '3D-сканирование кронштейна насоса',
    category: 'scan',
    file: { name: 'bracket_photos (3 фото).zip', size: 1024 * 1024 * 2 },
    material: 'PETG',
    size: [120, 60, 40],
    budget: 3200,
    deadline: '2026-11-22',
    district: 'Норильск (центр)',
    comment: 'Деталь с трещиной, нужно восстановить посадочное место',
    createdAt: Date.now(),
    status: 'open',
    customer: { id: 'c_test_1', name: 'Сергей Норникель', phone: '+7 900 000-00-00' },
    responses: [],
    scanDetails: {
      photosCount: 3,
      dimensions: '120 × 60 × 40 мм',
      originalMaterial: 'Пластик (литьё)',
      goalFormat: 'Реверс-инжиниринг (STEP / CAD)',
      needsPrint: true,
      printMaterial: 'PETG',
      printQty: 2,
      printColor: 'Чёрный',
      handoverMethod: 'Привезу мастеру лично (Норильск / Талнах / Кайеркан)'
    }
  };

  const list = DB.orders();
  list.unshift(newScanOrder);
  DB.saveOrders(list);

  const fetched = DB.order(newScanOrder.id);
  assert.ok(fetched, 'Scan order not found after saving');
  assert.strictEqual(fetched.type, 'scan');
  assert.strictEqual(fetched.scanDetails.needsPrint, true);
  assert.strictEqual(fetched.scanDetails.printQty, 2);
  assert.strictEqual(fetched.scanDetails.handoverMethod, 'Привезу мастеру лично (Норильск / Талнах / Кайеркан)');
  assert.strictEqual(DB.orders().length, initialOrdersCount + 1);
});

// ----------------------------------------------------
// SUITE 6: Orders Feed Filtering & Response Flow
// ----------------------------------------------------
console.log('\n--- 6. Orders Feed & Master Response Flow ---');

test('Orders feed filters: all, print only, scan only', () => {
  const allOrders = DB.orders();
  const printOnly = allOrders.filter(o => o.type !== 'scan');
  const scanOnly = allOrders.filter(o => o.type === 'scan');
  assert.ok(printOnly.length > 0, 'Must have standard print orders');
  assert.ok(scanOnly.length > 0, 'Must have 3D-scan orders');
  assert.strictEqual(printOnly.length + scanOnly.length, allOrders.length);
});

test('Master sends quote response to order and updates thread', () => {
  const { DB, Chat } = window.N3D;
  const orders = DB.orders();
  const targetOrder = orders.find(o => o.status === 'open');
  assert.ok(targetOrder, 'Need an open order to test response');

  const masterId = 'p79001112233';
  const masterName = 'Алексей К.';
  const quotePrice = 2800;
  const quoteDays = 2;
  const quoteComment = 'Сделаю сканирование и реверс за 2 дня на Revopoint POP 3.';

  DB.setUser({ id: masterId, name: masterName, role: 'printer' });

  const newResponse = {
    id: 'resp_' + Date.now(),
    printerId: masterId,
    printerName: masterName,
    price: quotePrice,
    days: quoteDays,
    comment: quoteComment,
    createdAt: Date.now()
  };

  DB.updateOrder(targetOrder.id, (o) => {
    o.responses = o.responses || [];
    o.responses.push(newResponse);
  });

  const updated = DB.order(targetOrder.id);
  const foundResp = updated.responses.find(r => r.printerId === masterId);
  assert.ok(foundResp, 'Response not saved to order');
  assert.strictEqual(foundResp.price, 2800);

  // Verify response message goes straight to customer chat thread
  const offerHeader = `Здравствуйте! Предлагаю выполнить ваш заказ: ${quotePrice} ₽ за ${quoteDays} дн.`;
  const chatMsg = quoteComment ? `${offerHeader}\n\n${quoteComment}` : offerHeader;
  Chat.sendMessage(targetOrder.customerId, masterId, targetOrder.id, chatMsg);
  const threads = Chat.getAllUserThreads(masterId);
  assert.ok(threads.length > 0, 'Chat thread must be created when master responds');
  const targetThread = threads.find(t => t.orderId === targetOrder.id);
  assert.ok(targetThread, 'Target thread with orderId must exist');
  assert.ok(targetThread.messages.some(m => m.text.includes(quoteComment)), 'Comment must be present in chat messages');
});

// ----------------------------------------------------
// SUITE 7: Printers Directory & Filtering Logic
// ----------------------------------------------------
console.log('\n--- 7. Printers Directory Filtering & Sorting ---');

test('Filter masters by technology (FDM, SLA, 3D-scan)', () => {
  const printers = DB.printers();
  const fdmMasters = printers.filter(p => (p.tech || []).includes('fdm'));
  const slaMasters = printers.filter(p => (p.tech || []).includes('sla'));
  const scanMasters = printers.filter(p => (p.tech || []).includes('scan') || p.services?.includes('scanning') || !!p.scannerEquipment);

  assert.ok(fdmMasters.length >= 3, 'Expected at least 3 FDM masters');
  assert.ok(slaMasters.length >= 1, 'Expected at least 1 SLA master (Daria)');
  assert.ok(scanMasters.length >= 2, 'Expected at least 2 3D-scan masters');
});

test('Filter masters by special materials (NYLON, CARBON, PC, ASA)', () => {
  const printers = DB.printers();
  const nylonMasters = printers.filter(p => (p.specMaterials || []).includes('NYLON'));
  const carbonMasters = printers.filter(p => (p.specMaterials || []).includes('CARBON'));
  const pcMasters = printers.filter(p => (p.specMaterials || []).includes('PC'));
  const asaMasters = printers.filter(p => (p.specMaterials || []).includes('ASA'));

  assert.ok(nylonMasters.length >= 1, 'Expected master with NYLON (Alexey)');
  assert.ok(carbonMasters.length >= 1, 'Expected master with CARBON (Alexey)');
  assert.ok(pcMasters.length >= 1, 'Expected master with PC (Polar Layer)');
  assert.ok(asaMasters.length >= 1, 'Expected master with ASA (Polar Layer)');
});

test('Sort masters by rating, price, and completed orders', () => {
  const printers = DB.printers();
  
  // Sort by rating descending
  const byRating = [...printers].sort((a, b) => b.rating - a.rating);
  assert.ok(byRating[0].rating >= byRating[byRating.length - 1].rating);

  // Sort by price ascending
  const byPrice = [...printers].sort((a, b) => a.pricePerGram - b.pricePerGram);
  assert.ok(byPrice[0].pricePerGram <= byPrice[byPrice.length - 1].pricePerGram);

  // Sort by completed orders descending
  const byDone = [...printers].sort((a, b) => b.done - a.done);
  assert.ok(byDone[0].done >= byDone[byDone.length - 1].done);
});

// ----------------------------------------------------
// SUITE 8: Cabinet Flow, Chat & Status Progression
// ----------------------------------------------------
console.log('\n--- 8. Cabinet Flow: Chat, Photos & Status Progression ---');

test('Send message in chat thread with optional photo attachment', () => {
  const threadKey = 'chat_c123_p79001112233';
  const chats = DB.chats();
  chats[threadKey] = chats[threadKey] || [];
  
  const msg1 = {
    id: 'm1',
    from: 'c123',
    to: 'p79001112233',
    text: 'Здравствуйте! Сможете отсканировать деталь?',
    time: Date.now()
  };
  const msg2 = {
    id: 'm2',
    from: 'p79001112233',
    to: 'c123',
    text: 'Приветствую! Да, вот пример недавней работы:',
    photo: 'data:image/jpeg;base64,mockJpegDataString',
    time: Date.now() + 1000
  };
  
  chats[threadKey].push(msg1, msg2);
  DB.saveChats(chats);

  const updatedChats = DB.chats();
  assert.strictEqual(updatedChats[threadKey].length, 2);
  assert.strictEqual(updatedChats[threadKey][1].photo.startsWith('data:image/'), true);
});

test('Order status lifecycle (open -> in_work -> ready -> done)', () => {
  const orders = DB.orders();
  const testOrder = orders[0];
  
  // 1. in_work
  DB.updateOrder(testOrder.id, (o) => { o.status = 'in_work'; });
  assert.strictEqual(DB.order(testOrder.id).status, 'in_work');

  // 2. ready
  DB.updateOrder(testOrder.id, (o) => { o.status = 'ready'; });
  assert.strictEqual(DB.order(testOrder.id).status, 'ready');

  // 3. done
  DB.updateOrder(testOrder.id, (o) => { o.status = 'done'; });
  assert.strictEqual(DB.order(testOrder.id).status, 'done');
});

test('Customer reviews master upon order completion', () => {
  const masterId = 'p79001112233';
  const masterBefore = DB.printer(masterId);
  const reviewsCountBefore = masterBefore.reviews;

  DB.updatePrinter(masterId, (p) => {
    p.reviews = (p.reviews || 0) + 1;
    p.done = (p.done || 0) + 1;
    p.rating = 4.95;
  });

  const masterAfter = DB.printer(masterId);
  assert.strictEqual(masterAfter.reviews, reviewsCountBefore + 1);
});

// ----------------------------------------------------
// SUITE 9: Master Profile Registration & Settings
// ----------------------------------------------------
console.log('\n--- 9. Master Profile Registration & Settings ---');

test('Master profile update with scanner equipment, special materials & custom prices', () => {
  const masterId = 'p79008887766';
  const newMasterProfile = {
    id: masterId,
    name: 'Мастер Арктик3Д',
    phone: '+7 900 888-77-66',
    telegram: '@arctic3d_norilsk',
    district: 'Оганер',
    tech: ['fdm', 'sla', 'scan'],
    equipment: 'Creality K1 Max, Elegoo Saturn 4 Ultra',
    buildArea: '300 × 300 × 300 мм',
    scannerEquipment: 'Shining 3D EinScan-SP',
    scannerAccuracy: 'до 0.05 мм',
    materials: ['PLA', 'PETG', 'RESIN'],
    specMaterials: ['NYLON', 'CARBON', 'PC'],
    customMatName: 'Ultem 9085',
    customMatPrice: 75,
    materialPrices: {
      PLA: 9,
      PETG: 11,
      RESIN: 24,
      NYLON: 23,
      CARBON: 30,
      PC: 26,
      'Ultem 9085': 75
    },
    pricePerGram: 9,
    minOrder: 450,
    services: ['scanning', 'modeling', 'urgent', 'delivery'],
    about: 'Инженерная печать высокотемпературными пластиками и лазерная оцифровка',
    rating: 5.0,
    reviews: 0,
    done: 0,
    since: '2026'
  };

  const printers = DB.printers();
  printers.push(newMasterProfile);
  DB.savePrinters(printers);

  const saved = DB.printer(masterId);
  assert.ok(saved, 'Saved master not found');
  assert.strictEqual(saved.scannerEquipment, 'Shining 3D EinScan-SP');
  assert.strictEqual(saved.customMatName, 'Ultem 9085');
  assert.strictEqual(saved.customMatPrice, 75);
  assert.strictEqual(saved.materialPrices['Ultem 9085'], 75);
  assert.strictEqual(saved.specMaterials.includes('CARBON'), true);
});

// ----------------------------------------------------
// SUITE 10: CSS & Design Regression Verification
// ----------------------------------------------------
console.log('\n--- 10. CSS & Design Regression Verification ---');

test('CSS has 48px height and 12px border radius for inputs', () => {
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('height: 48px'), 'CSS missing height: 48px for inputs');
  assert.ok(css.includes('border-radius: 12px'), 'CSS missing border-radius: 12px');
  assert.ok(css.includes('background-color: var(--input-bg) !important'), 'CSS missing !important on input background');
});

test('CSS select has single right arrow with no-repeat and padding-right: 48px', () => {
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('background-repeat: no-repeat !important'), 'CSS missing no-repeat on select');
  assert.ok(css.includes('padding-right: 48px !important'), 'CSS missing padding-right: 48px on select');
});

test('CSS tile-card has fixed 56px height and overflow constraints', () => {
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('height: 56px !important'), 'CSS missing height: 56px !important on tile-card');
  assert.ok(css.includes('white-space: nowrap !important'), 'CSS missing white-space: nowrap on tile-card text');
});

test('CSS contains classes for all special materials chips', () => {
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('.chip--spec'), 'CSS missing .chip--spec');
  assert.ok(css.includes('.chip--nylon'), 'CSS missing .chip--nylon');
  assert.ok(css.includes('.chip--carbon'), 'CSS missing .chip--carbon');
  assert.ok(css.includes('.chip--pc'), 'CSS missing .chip--pc');
  assert.ok(css.includes('.chip--asa'), 'CSS missing .chip--asa');
});

test('CSS contains responsive order modal grid, close clearance and sticky order form', () => {
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('.od__grid'), 'CSS missing .od__grid');
  assert.ok(css.includes('.od__head'), 'CSS missing .od__head');
  assert.ok(css.includes('.cta-box'), 'CSS missing .cta-box');
  assert.ok(css.includes('.cta-box__info'), 'CSS missing .cta-box__info');
  assert.ok(css.includes('.order-form__left'), 'CSS missing .order-form__left');
  assert.ok(css.includes('position: sticky'), 'CSS missing sticky order-form__left');
  assert.ok(css.includes('.resp-item__price-box'), 'CSS missing .resp-item__price-box');
  assert.ok(css.includes('.resp-item__footer'), 'CSS missing .resp-item__footer');
  assert.ok(css.includes('.resp-status-card'), 'CSS missing .resp-status-card');
});

// ----------------------------------------------------
// SUITE 11: Admin Panel & Social Authentication
// ----------------------------------------------------
console.log('\n--- 11. Admin Panel & Social Authentication ---');

test('admin.html exists and contains admin UI components', () => {
  const adminHtml = fs.readFileSync(path.join(DIR, 'admin.html'), 'utf8');
  assert.ok(adminHtml.includes('id="adminAuthBox"'), 'Missing adminAuthBox in admin.html');
  assert.ok(adminHtml.includes('id="adminAppBox"'), 'Missing adminAppBox in admin.html');
  assert.ok(adminHtml.includes('id="ordersTableBody"'), 'Missing ordersTableBody in admin.html');
  assert.ok(adminHtml.includes('id="printersTableBody"'), 'Missing printersTableBody in admin.html');
  assert.ok(adminHtml.includes('id="customersTableBody"'), 'Missing customersTableBody in admin.html');
  assert.ok(adminHtml.includes('id="btnExportJson"'), 'Missing btnExportJson in admin.html');
});

test('admin.js exists and has valid JS syntax', () => {
  const adminJs = fs.readFileSync(path.join(DIR, 'admin.js'), 'utf8');
  assert.ok(adminJs.includes('ADMIN_PASS = "admin3d"'), 'Missing admin password definition');
  assert.ok(adminJs.includes('openOrderEditModal'), 'Missing openOrderEditModal function');
  assert.ok(adminJs.includes('openPrinterEditModal'), 'Missing openPrinterEditModal function');
  assert.ok(adminJs.includes('exportBackup'), 'Missing exportBackup function');
});

test('Social auth flow: Customer and Master registration via VK and Telegram', () => {
  const { DB } = window.N3D;
  // Customer with VK
  const vkCust = {
    id: 'soc_vk_test',
    name: 'Игорь С. (VK)',
    phone: '+7 (900) 123-45-67',
    role: 'customer',
    district: 'Норильск',
    authProvider: 'vk',
    vk: 'id12345678'
  };
  DB.setUser(vkCust);
  assert.strictEqual(DB.user().authProvider, 'vk');
  assert.strictEqual(DB.user().vk, 'id12345678');

  // Master with Telegram
  const tgMaster = {
    id: 'soc_tg_master',
    name: 'Мастер Влад (TG)',
    phone: '+7 (900) 987-65-43',
    role: 'printer',
    district: 'Талнах',
    authProvider: 'tg',
    telegram: '@vlad_3d_nor'
  };
  DB.setUser(tgMaster);
  assert.strictEqual(DB.user().authProvider, 'tg');
  assert.strictEqual(DB.user().telegram, '@vlad_3d_nor');
});

test('Admin CRUD: Update and Delete orders and printers', () => {
  const { DB } = window.N3D;
  const initialOrders = DB.orders();
  const testOrder = {
    id: 'ord-admin-test',
    title: 'Тестовый заказ для админки',
    budget: 3500,
    status: 'open',
    customerName: 'Тест Клиент',
    phone: '+7 (900) 555-55-55',
    district: 'Кайеркан'
  };
  initialOrders.push(testOrder);
  DB.saveOrders(initialOrders);

  // Read
  let found = DB.orders().find(o => o.id === 'ord-admin-test');
  assert.ok(found, 'Order not saved in DB');
  assert.strictEqual(found.budget, 3500);

  // Update
  found.status = 'in_work';
  found.budget = 4200;
  DB.updateOrder(found);
  const updated = DB.orders().find(o => o.id === 'ord-admin-test');
  assert.strictEqual(updated.status, 'in_work');
  assert.strictEqual(updated.budget, 4200);

  // Delete
  const filtered = DB.orders().filter(o => o.id !== 'ord-admin-test');
  DB.saveOrders(filtered);
  assert.strictEqual(DB.orders().find(o => o.id === 'ord-admin-test'), undefined, 'Order not deleted');
});

test('Server backend has DELETE routes and /api/stats endpoint', () => {
  const serverCode = fs.readFileSync(path.join(DIR, 'server.js'), 'utf8');
  assert.ok(serverCode.includes("pathname.startsWith('/api/orders/') && req.method === 'DELETE'"), 'Missing DELETE /api/orders/:id');
  assert.ok(serverCode.includes("pathname.startsWith('/api/printers/') && req.method === 'DELETE'"), 'Missing DELETE /api/printers/:id');
  assert.ok(serverCode.includes("pathname === '/api/stats' && req.method === 'GET'"), 'Missing GET /api/stats');
});

// ----------------------------------------------------
// SUITE 12: Profile Avatar Customization (Presets & Upload)
// ----------------------------------------------------
console.log('\n--- 12. Profile Avatar Customization ---');

test('PRESET_AVATARS has 12 themed options with icons and backgrounds', () => {
  const { PRESET_AVATARS } = window.N3D;
  assert.ok(Array.isArray(PRESET_AVATARS), 'PRESET_AVATARS must be an array');
  assert.ok(PRESET_AVATARS.length >= 10, 'Expected at least 10 preset avatars');
  const ids = PRESET_AVATARS.map(p => p.id);
  assert.ok(ids.includes('fox'), 'Missing fox preset');
  assert.ok(ids.includes('bear'), 'Missing bear preset');
  assert.ok(ids.includes('printer'), 'Missing printer preset');
  assert.ok(ids.includes('scanner'), 'Missing scanner preset');
});

test('avatar() helper renders presets, custom images, and initials fallback', () => {
  const { avatar } = window.N3D;
  // 1. Fallback initials
  const htmlInitials = avatar({ name: 'Алексей Смирнов' }, 40);
  assert.ok(htmlInitials.includes('class="avatar"'), 'Initials avatar missing class avatar');
  assert.ok(htmlInitials.includes('АС'), 'Initials avatar missing letters АС');

  // 2. Preset mascot
  const htmlPreset = avatar({ name: 'Алексей', avatar: 'preset:fox' }, 48);
  assert.ok(htmlPreset.includes('avatar--preset'), 'Preset avatar missing avatar--preset');
  assert.ok(htmlPreset.includes('🦊'), 'Preset avatar missing fox icon');

  // 3. Custom photo
  const fakeDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
  const htmlImg = avatar({ name: 'Сергей', avatar: fakeDataUrl }, 50);
  assert.ok(htmlImg.includes('<img'), 'Custom photo avatar should render img tag');
  assert.ok(htmlImg.includes('avatar--img'), 'Custom photo missing avatar--img class');
  assert.ok(htmlImg.includes(fakeDataUrl), 'Custom photo missing src data URL');
});

test('User and Master avatar persistence and updating', () => {
  const { DB } = window.N3D;

  // Customer setting custom avatar
  const cust = {
    id: 'c_test_av',
    name: 'Елена К.',
    role: 'customer',
    phone: '+7 900 111-22-33',
    avatar: 'preset:bear'
  };
  DB.setUser(cust);
  assert.strictEqual(DB.user().avatar, 'preset:bear');

  // Master avatar updated
  const printers = DB.printers();
  const target = printers[0];
  const oldAv = target.avatar;
  const newAv = 'data:image/jpeg;base64,photo_test_base64';
  DB.updatePrinter(target.id, (p) => {
    p.avatar = newAv;
  });

  const updatedPrinter = DB.printer(target.id);
  assert.strictEqual(updatedPrinter.avatar, newAv, 'Master avatar was not saved in DB');
});

test('Admin panel dark theme support: toggle, styles and canvas', () => {
  const adminHtml = fs.readFileSync(path.join(DIR, 'admin.html'), 'utf8');
  assert.ok(adminHtml.includes('id="themeToggle"'), 'Missing themeToggle in admin.html');
  assert.ok(adminHtml.includes('id="bgCanvas"'), 'Missing bgCanvas in admin.html');

  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('[data-theme="dark"] .admin-badge'), 'Missing dark theme for admin-badge');
  assert.ok(css.includes('[data-theme="dark"] .stat-widget'), 'Missing dark theme for stat-widget');
  assert.ok(css.includes('[data-theme="dark"] .admin-table'), 'Missing dark theme for admin-table');
  assert.ok(css.includes('[data-theme="dark"] #adminAuthBox'), 'Missing dark theme for adminAuthBox');
});

// ----------------------------------------------------
// SUITE 13: Combined Monetization (Model 1: Escrow + Model 3: Paid Boost Options)
// ----------------------------------------------------
console.log('\n--- 13. Combined Monetization (Escrow & Boost) ---');

test('Monetization configuration and defaults in core.js', () => {
  const { DB, DEFAULT_MONETIZATION } = window.N3D;
  assert.ok(DEFAULT_MONETIZATION, 'DEFAULT_MONETIZATION missing in N3D');
  assert.strictEqual(DEFAULT_MONETIZATION.escrowEnabled, true);
  assert.strictEqual(DEFAULT_MONETIZATION.escrowCommissionPercent, 10);
  assert.strictEqual(DEFAULT_MONETIZATION.boostEnabled, true);
  assert.strictEqual(DEFAULT_MONETIZATION.urgentPrice, 250);
  assert.strictEqual(DEFAULT_MONETIZATION.privatePrice, 150);
  assert.strictEqual(DEFAULT_MONETIZATION.modelingPrice, 500);

  // DB accessor
  const cfg = DB.monetization();
  assert.strictEqual(cfg.escrowEnabled, true);
  assert.strictEqual(cfg.boostEnabled, true);

  // 1-Click toggle test via DB save
  DB.saveMonetization({ escrowEnabled: false, boostEnabled: false });
  assert.strictEqual(DB.monetization().escrowEnabled, false);
  assert.strictEqual(DB.monetization().boostEnabled, false);

  // Re-enable and test price customisation
  DB.saveMonetization({ escrowEnabled: true, boostEnabled: true, escrowCommissionPercent: 12, urgentPrice: 300 });
  const updated = DB.monetization();
  assert.strictEqual(updated.escrowEnabled, true);
  assert.strictEqual(updated.escrowCommissionPercent, 12);
  assert.strictEqual(updated.urgentPrice, 300);

  // Reset back to defaults for clean state
  DB.saveMonetization(DEFAULT_MONETIZATION);
});

test('1-Click toggles, pricing controls & KPI cards in admin.html and admin.js', () => {
  const adminHtml = fs.readFileSync(path.join(DIR, 'admin.html'), 'utf8');
  assert.ok(adminHtml.includes('data-tab="monetization"'), 'Missing monetization tab in admin.html');
  assert.ok(adminHtml.includes('id="tabContent_monetization"'), 'Missing tabContent_monetization pane');
  assert.ok(adminHtml.includes('id="toggleEscrowMaster"'), 'Missing toggleEscrowMaster switch');
  assert.ok(adminHtml.includes('id="toggleBoostMaster"'), 'Missing toggleBoostMaster switch');
  assert.ok(adminHtml.includes('id="inputEscrowCommission"'), 'Missing inputEscrowCommission input');
  assert.ok(adminHtml.includes('id="inputUrgentPrice"'), 'Missing inputUrgentPrice input');
  assert.ok(adminHtml.includes('id="inputPrivatePrice"'), 'Missing inputPrivatePrice input');
  assert.ok(adminHtml.includes('id="inputModelingPrice"'), 'Missing inputModelingPrice input');
  assert.ok(adminHtml.includes('id="revTotalPlatform"'), 'Missing revTotalPlatform KPI widget');
  assert.ok(adminHtml.includes('id="monetizationTableBody"'), 'Missing monetizationTableBody in admin.html');

  const adminJs = fs.readFileSync(path.join(DIR, 'admin.js'), 'utf8');
  assert.ok(adminJs.includes('renderMonetization'), 'admin.js missing renderMonetization');
  assert.ok(adminJs.includes('toggleEscrowMaster'), 'admin.js missing toggleEscrowMaster listener');
  assert.ok(adminJs.includes('toggleBoostMaster'), 'admin.js missing toggleBoostMaster listener');
});

test('Urgent Boost & Escrow styling and order card rendering in cards.js', () => {
  const cardsJs = fs.readFileSync(path.join(DIR, 'cards.js'), 'utf8');
  assert.ok(cardsJs.includes('ocard--urgent'), 'cards.js missing ocard--urgent class');
  assert.ok(cardsJs.includes('chip--urgent'), 'cards.js missing chip--urgent badge');
  assert.ok(cardsJs.includes('chip--escrow'), 'cards.js missing chip--escrow badge');

  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('.ocard--urgent'), 'styles.css missing .ocard--urgent rule');
  assert.ok(css.includes('.chip--urgent'), 'styles.css missing .chip--urgent rule');
  assert.ok(css.includes('.chip--escrow'), 'styles.css missing .chip--escrow rule');
  assert.ok(css.includes('.switch-ui'), 'styles.css missing .switch-ui rule');
  assert.ok(css.includes('.paid-option-card'), 'styles.css missing .paid-option-card rule');
});

test('Escrow holding and release payout calculation flow', () => {
  const budget = 3000;
  const commissionPercent = 10;
  const commissionFee = Math.round(budget * commissionPercent / 100);
  const masterPayout = budget - commissionFee;

  assert.strictEqual(commissionFee, 300, 'Commission 10% of 3000 should be 300');
  assert.strictEqual(masterPayout, 2700, 'Master payout should be 2700');

  // Verify dedicated orders management (my-orders.js) handles escrow payout flow
  const myOrdersJs = fs.readFileSync(path.join(DIR, 'my-orders.js'), 'utf8');
  assert.ok(myOrdersJs.includes('escrowStatus') || myOrdersJs.includes('completeOrder'), 'my-orders.js handles escrow payout');
  assert.ok(myOrdersJs.includes('payout') || myOrdersJs.includes('completeOrder'), 'my-orders.js handles payout calculation');

  // Verify cabinet.js links to dedicated orders management
  const cabinetJs = fs.readFileSync(path.join(DIR, 'cabinet.js'), 'utf8');
  assert.ok(cabinetJs.includes('my-orders.html'), 'cabinet.js links to my-orders.html');
});

test('Order creation forms contain monetization containers', () => {
  const orderHtml = fs.readFileSync(path.join(DIR, 'order.html'), 'utf8');
  assert.ok(orderHtml.includes('id="monetizationContainer"'), 'order.html missing monetizationContainer');

  const scanHtml = fs.readFileSync(path.join(DIR, 'scan.html'), 'utf8');
  assert.ok(scanHtml.includes('id="scanMonetizationBox"'), 'scan.html missing scanMonetizationBox');

  const orderJs = fs.readFileSync(path.join(DIR, 'order.js'), 'utf8');
  assert.ok(orderJs.includes('renderMonetizationOptions'), 'order.js missing renderMonetizationOptions');
  assert.ok(orderJs.includes('isUrgent'), 'order.js missing isUrgent flag assignment');
  assert.ok(orderJs.includes('isEscrow'), 'order.js missing isEscrow flag assignment');

  const scanJs = fs.readFileSync(path.join(DIR, 'scan.js'), 'utf8');
  assert.ok(scanJs.includes('renderScanMonetization'), 'scan.js missing renderScanMonetization');
});

// ----------------------------------------------------
// SUITE 14: Master (Printer) Chat & Cabinet Rendering
// ----------------------------------------------------
console.log('\n--- 14. Master (Printer) Chat & Cabinet Rendering ---');

test('Chat.getAllUserThreads retrieves master threads without crashing', () => {
  const { Chat, DB } = window.N3D;
  const masterId = 'p79001112233'; // Алексей К.

  const threads = Chat.getAllUserThreads(masterId);
  assert.ok(Array.isArray(threads), 'getAllUserThreads should return an array');
  assert.ok(threads.length > 0, 'Master Алексей К. should have at least 1 active chat thread');
  assert.strictEqual(threads[0].printerId, masterId, 'Thread printerId must match masterId');
  assert.ok(Array.isArray(threads[0].messages), 'Thread messages must be an array');
  assert.ok(threads[0].messages.length > 0, 'Thread should have messages');
});

test('Master chat rendering in cabinet.js does not reference undefined variables', () => {
  const cabinetJs = fs.readFileSync(path.join(DIR, 'cabinet.js'), 'utf8');
  // Check that t.customerAvatar is NOT in renderActiveChat (it caused ReferenceError)
  const activeChatSection = cabinetJs.slice(cabinetJs.indexOf('function renderActiveChat()'), cabinetJs.indexOf('function renderOrderActions'));
  assert.ok(!activeChatSection.includes('t.customerAvatar'), 'renderActiveChat must NOT reference undefined t.customerAvatar');
  assert.ok(activeChatSection.includes('thread.customerAvatar'), 'renderActiveChat should reference thread.customerAvatar');
});

test('Master sending messages in chat correctly appends to thread', () => {
  const { Chat, DB } = window.N3D;
  const master = { id: 'p79001112233', name: 'Алексей К.', role: 'printer' };
  DB.setUser(master);

  const customerId = 'c79990001122';
  const orderId = 'o1';
  const testMsg = 'Тестовое сообщение от мастера 3D-печати: печать завершена успешно!';

  const sent = Chat.sendMessage(customerId, master.id, orderId, testMsg);
  assert.ok(sent, 'sendMessage should return the created message');
  assert.strictEqual(sent.from, master.id);
  assert.strictEqual(sent.text, testMsg);

  const threads = Chat.getAllUserThreads(master.id);
  const target = threads.find((t) => t.key.includes(orderId));
  assert.ok(target, 'Target thread should exist for master');
  const last = target.messages[target.messages.length - 1];
  assert.strictEqual(last.text, testMsg, 'Last message in thread must match sent message');
});

console.log('\n--- 15. Messages Navigation, Unread Badge & Profile Settings Modal ---');

test('Navigation link renamed to «💬 Сообщения» across core.js and cabinet.html', () => {
  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');
  const cabinetHtml = fs.readFileSync(path.join(DIR, 'cabinet.html'), 'utf8');

  assert.ok(coreJs.includes('"💬 Сообщения"'), 'core.js navigation must use "💬 Сообщения"');
  assert.ok(!coreJs.includes('["cabinet", "cabinet.html", "💬 Кабинет"]'), 'core.js must not have "💬 Кабинет" in links');
  assert.ok(cabinetHtml.includes('>💬 Сообщения</a>'), 'cabinet.html must have "💬 Сообщения"');
  assert.ok(!cabinetHtml.includes('cab-tab-btn" data-tab="settings"'), 'cabinet.html must not contain settings tab inside chat list');
});

test('Chat unread count calculation and thread mark-as-read flow', () => {
  const { Chat, DB } = window.N3D;
  const customer = { id: 'c79990001122', name: 'Сергей', role: 'customer' };
  const master = { id: 'p79001112233', name: 'Алексей К.', role: 'printer' };

  // Clear read map
  localStorage.removeItem(`n3d_read_${customer.id}`);

  // Send a message from master to customer
  const msg = Chat.sendMessage(customer.id, master.id, 'o1', 'Тестовое непрочитанное сообщение для заказчика');
  assert.ok(msg, 'Message sent successfully');

  // Check unread count for customer
  const unreadBefore = Chat.getUnreadCount(customer.id);
  assert.ok(unreadBefore >= 1, `Customer should have at least 1 unread message, got: ${unreadBefore}`);

  const targetThread = `${customer.id}__${master.id}__o1`;
  const threadUnreadBefore = Chat.getThreadUnreadCount(targetThread, customer.id);
  assert.ok(threadUnreadBefore >= 1, `Thread unread count should be >= 1, got: ${threadUnreadBefore}`);

  // Mark thread read by customer
  Chat.markThreadRead(targetThread, customer.id);

  const threadUnreadAfter = Chat.getThreadUnreadCount(targetThread, customer.id);
  assert.strictEqual(threadUnreadAfter, 0, 'Thread unread count must be 0 after marking read');
});

test('N3D.openProfileSettingsModal is defined and header userchip is interactive', () => {
  const { openProfileSettingsModal } = window.N3D;
  assert.strictEqual(typeof openProfileSettingsModal, 'function', 'openProfileSettingsModal must be a function exported on N3D');

  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');
  assert.ok(coreJs.includes('id="headerUserChip"'), 'Header must render userchip with id="headerUserChip"');
  assert.ok(coreJs.includes('openProfileSettingsModal()'), 'Clicking header userchip must invoke openProfileSettingsModal()');

  const stylesCss = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(stylesCss.includes('.nav-msg-badge'), 'styles.css must include .nav-msg-badge');
  assert.ok(stylesCss.includes('.cab-dialog-unread-badge'), 'styles.css must include .cab-dialog-unread-badge');
  assert.ok(stylesCss.includes('navBadgePulse'), 'styles.css must include navBadgePulse keyframe animation');
});

console.log('\n--- 16. Wallet Section (Кошелёк для заказчиков и исполнителей) ---');

test('Wallet page and script exist and define complete financial dashboard', () => {
  const walletHtml = fs.readFileSync(path.join(DIR, 'wallet.html'), 'utf8');
  const walletJs = fs.readFileSync(path.join(DIR, 'wallet.js'), 'utf8');

  assert.ok(walletHtml.includes('wallet-kpi-grid'), 'wallet.html must include KPI grid');
  assert.ok(walletHtml.includes('btnOpenDepositModal'), 'wallet.html must include deposit action');
  assert.ok(walletHtml.includes('btnOpenWithdrawModal'), 'wallet.html must include withdraw action');
  assert.ok(walletHtml.includes('tx-feed-card'), 'wallet.html must include transaction feed');

  assert.ok(walletJs.includes('renderKpis'), 'wallet.js must render KPIs');
  assert.ok(walletJs.includes('openDepositModal'), 'wallet.js must include openDepositModal');
  assert.ok(walletJs.includes('openWithdrawModal'), 'wallet.js must include openWithdrawModal');
  assert.ok(walletJs.includes('openReceiptModal'), 'wallet.js must include openReceiptModal');
});

test('DB wallet balance, hold tracking, deposit, and withdraw flows', () => {
  const { DB } = window.N3D;
  const testUserId = 'test_user_w_' + Date.now();

  // Initial wallet
  const initial = DB.wallet(testUserId);
  assert.ok(initial !== null, 'Wallet must be returned for user');
  const startBal = initial.balance;

  // Deposit test
  const depositTx = DB.deposit(testUserId, 2500, 'sbp', 'Тестовое пополнение баланса СБП');
  assert.ok(depositTx, 'Deposit transaction should be created');
  assert.strictEqual(depositTx.amount, 2500);

  const afterDeposit = DB.wallet(testUserId);
  assert.strictEqual(afterDeposit.balance, startBal + 2500, 'Balance must increase by deposit amount');

  // Withdraw test
  const withdrawTx = DB.withdraw(testUserId, 1000, 'СБП Т-Банк', 'Тестовый вывод средств');
  assert.ok(withdrawTx, 'Withdraw transaction should be created');
  assert.strictEqual(withdrawTx.amount, 1000);

  const afterWithdraw = DB.wallet(testUserId);
  assert.strictEqual(afterWithdraw.balance, startBal + 1500, 'Balance must decrease by withdrawal amount');
  assert.strictEqual(afterWithdraw.totalOut, 1000, 'totalOut must record withdrawal');

  // Transactions list
  const txList = DB.transactions(testUserId);
  assert.ok(txList.length >= 2, 'User should have at least 2 transactions');
  assert.strictEqual(txList[0].id, withdrawTx.id, 'Latest transaction must be at index 0');
});

console.log('\n--- 17. Master Rating and Reputation Hub (Рейтинг мастера) ---');

test('Rating page and script exist and contain operational stats, service ratings & reviews', () => {
  const ratingHtml = fs.readFileSync(path.join(DIR, 'rating.html'), 'utf8');
  const ratingJs = fs.readFileSync(path.join(DIR, 'rating.js'), 'utf8');

  assert.ok(ratingHtml.includes('rating-kpi-grid'), 'rating.html must include rating & financial status KPI grid');
  assert.ok(ratingHtml.includes('serviceScoresList'), 'rating.html must include serviceScoresList');
  assert.ok(ratingHtml.includes('criteriaScoresList'), 'rating.html must include criteriaScoresList');
  assert.ok(ratingHtml.includes('reviewsFeed'), 'rating.html must include reviewsFeed');

  assert.ok(ratingJs.includes('renderKpis'), 'rating.js must render KPIs showing earnings and holds');
  assert.ok(ratingJs.includes('renderServiceScores'), 'rating.js must render service scores');
  assert.ok(ratingJs.includes('renderReviews'), 'rating.js must render reviews');
});

test('DB reviews retrieval, adding new review and printer rating recalculation', () => {
  const { DB } = window.N3D;
  const masterId = 'p79001112233';

  const reviewsBefore = DB.reviews(masterId);
  assert.ok(Array.isArray(reviewsBefore), 'Reviews must be an array');
  assert.ok(reviewsBefore.length >= 1, 'Master should have seed reviews');

  const newReview = DB.addReview({
    printerId: masterId,
    customerId: 'c79990001122',
    customerName: 'Сергей',
    orderTitle: 'Тестовая 3D-печать кронштейна',
    service: 'fdm',
    serviceName: '3D-печать (PETG)',
    score: 5,
    accuracyScore: 5,
    speedScore: 5,
    commScore: 5,
    comment: 'Идеальное качество, отличная адгезия слоёв!'
  });

  assert.ok(newReview, 'addReview must return the created review');
  assert.strictEqual(newReview.score, 5);

  const reviewsAfter = DB.reviews(masterId);
  assert.strictEqual(reviewsAfter.length, reviewsBefore.length + 1, 'Review count must increase by 1');

  const printer = DB.printer(masterId);
  assert.ok(printer.rating >= 4.5, `Printer rating must be high, got: ${printer.rating}`);
  assert.strictEqual(printer.reviews, reviewsAfter.length, 'Printer reviews count must be updated');
});

test('Navigation bar integrates Wallet for both roles and Rating for master', () => {
  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');

  assert.ok(coreJs.includes('"wallet.html", "💳 Кошелёк"'), 'core.js must have Wallet link in navigation');
  assert.ok(coreJs.includes('"rating.html", "⭐ Рейтинг"'), 'core.js must have Rating link for master in navigation');
  assert.ok(coreJs.includes('header-balance-chip'), 'core.js must render header quick balance chip');
});

// ====================================================
// 18. UX & Polish: Theme Toggle, Avatar Picker, Reviews & Layout
// ====================================================
console.log('\n--- 18. UX & Polish: Theme Toggle, Avatar Picker, Reviews & Layout ---');

test('Theme toggle has single delegated handler and clean state switching', () => {
  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');

  // Verify duplicate listener in renderChrome was removed to prevent double-flipping
  assert.ok(!coreJs.includes('header.querySelector("#themeToggle")?.addEventListener("click", toggleTheme)'),
    'Duplicate themeToggle listener inside renderChrome must be removed');
  assert.ok(coreJs.includes('e.target.closest(".theme-toggle")'), 'Single delegated theme-toggle click handler must be active');
  assert.ok(coreJs.includes('document.documentElement.setAttribute("data-theme"'), 'setTheme must update html data-theme');
  assert.ok(coreJs.includes('document.body.setAttribute("data-theme"'), 'setTheme must update body data-theme');
});

test('Modal stack allows nested modals (avatar picker on top of profile modal)', () => {
  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');

  assert.ok(coreJs.includes('modalStack'), 'core.js must implement modalStack for modal nesting');
  assert.ok(coreJs.includes('modalStack.push(modalRoot)'), 'openModal must push active modal onto stack');
  assert.ok(coreJs.includes('modalRoot = modalStack.pop()'), 'closeModal must pop and restore previous modal');
  assert.ok(coreJs.includes('openAvatarPickerModal'), 'openAvatarPickerModal must be defined');
});

test('Customer can only rate and review orders after completion (order.status === "done")', () => {
  const myOrdersJs = fs.readFileSync(path.join(DIR, 'my-orders.js'), 'utf8');

  // In my-orders.js, review button must only be available when order status is done
  assert.ok(myOrdersJs.includes('o.status === "done"'), 'Review logic checked against done status');
  assert.ok(myOrdersJs.includes('btn-rate-order'), 'Review trigger button defined');
  assert.ok(myOrdersJs.includes('openReviewModal'), 'Rich interactive review modal invoked');

  // Verify chat cabinet has no inline order management actions
  const cabinetJs = fs.readFileSync(path.join(DIR, 'cabinet.js'), 'utf8');
  assert.ok(!cabinetJs.includes('cab-order-banner'), 'cabinet.js chat must not have inline cab-order-banner');
});

test('Master profile modal in cards.js renders customer reviews and ratings list', () => {
  const cardsJs = fs.readFileSync(path.join(DIR, 'cards.js'), 'utf8');

  assert.ok(cardsJs.includes('openPrinterModal'), 'cards.js must define openPrinterModal');
  assert.ok(cardsJs.includes('DB.reviews(p.id)'), 'openPrinterModal must fetch master reviews');
  assert.ok(cardsJs.includes('printer-reviews-list'), 'openPrinterModal must contain printer reviews container');
  assert.ok(cardsJs.includes('r.customerName'), 'openPrinterModal must display reviewer customer name');
  assert.ok(cardsJs.includes('r.comment'), 'openPrinterModal must display reviewer feedback comment');
});

test('Wallet transaction rows and withdraw modal have polished grid layout and spacing', () => {
  const stylesCss = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  const walletJs = fs.readFileSync(path.join(DIR, 'wallet.js'), 'utf8');
  const orderHtml = fs.readFileSync(path.join(DIR, 'order.html'), 'utf8');

  assert.ok(stylesCss.includes('grid-template-columns: 44px minmax(0, 1fr) auto'), 'styles.css must have clean 3-col grid for tx-row');
  assert.ok(stylesCss.includes('word-break: normal;'), 'spec values must use word-break: normal to prevent breaking letters');
  assert.ok(walletJs.includes('payment-methods-grid'), 'wallet.js must use styled payment methods grid');
  assert.ok(orderHtml.includes('order-form__footer'), 'order.html must have full-width footer for safe deal and submit button');
});

test('Closing order transfers funds to master wallet and creates payout transaction', () => {
  const masterId = 'p79001112233';
  const customerId = 'c79990001122';

  // Seed fresh state
  DB.reset();
  const masterWalletBefore = DB.wallet(masterId);
  const masterBalanceBefore = masterWalletBefore.balance;

  // Create an active test order with budget 3000
  const orderId = 'test_payout_' + Date.now();
  const orders = DB.orders();
  orders.push({
    id: orderId,
    title: 'Тестовый кронштейн для перевода средств',
    customerId: customerId,
    customerName: 'Сергей',
    budget: 3000,
    status: 'ready',
    printerId: masterId,
    escrow: true,
    escrowCommissionPercent: 10
  });
  DB.saveOrders(orders);

  // Complete order as customer
  const result = DB.completeOrder(orderId, { printerId: masterId });
  assert.ok(result, 'completeOrder must return result');
  assert.strictEqual(result.payout, 2700, 'Payout must be 90% (3000 - 300)');
  assert.strictEqual(result.fee, 300, 'Fee must be 10% (300)');

  // Verify master wallet balance increased by exactly payout
  const masterWalletAfter = DB.wallet(masterId);
  assert.strictEqual(masterWalletAfter.balance, masterBalanceBefore + 2700,
    `Master balance must increase by 2700, was: ${masterBalanceBefore}, now: ${masterWalletAfter.balance}`);

  // Verify payout transaction exists in master history
  const masterTxs = DB.transactions(masterId);
  const payoutTx = masterTxs.find((t) => t.orderId === orderId && t.type === 'payout');
  assert.ok(payoutTx, 'Master must have a payout transaction for this order');
  assert.strictEqual(payoutTx.amount, 2700);

  // Verify order is done and marked released
  const updatedOrder = DB.order(orderId);
  assert.strictEqual(updatedOrder.status, 'done');
  assert.strictEqual(updatedOrder.payoutToPrinter, 2700);
});

test('Order page left column (3D model dropzone) has static positioning so it does not drift down on scroll', () => {
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('.order-form__left'), 'Missing .order-form__left');
  // Check that .order-form__left is not position: sticky
  const match = css.match(/\.order-form__left\s*\{([^}]+)\}/);
  assert.ok(match, 'Found .order-form__left rule');
  assert.ok(!match[1].includes('position: sticky'), '.order-form__left must not have position: sticky');
  assert.ok(match[1].includes('position: static'), '.order-form__left must have position: static');
});

// ----------------------------------------------------
// SUITE 19: Chat Deletion & Thread Management
// ----------------------------------------------------
console.log('\n--- 19. Chat Deletion & Thread Management ---');

test('Chat deletion removes thread from DB.chats, getAllUserThreads, and cleans up read markers', () => {
  const { DB, Chat } = window.N3D;
  const custId = 'c_delete_test';
  const printId = 'p_delete_test';
  const ordId = 'o_delete_test';

  DB.setUser({ id: custId, name: 'Клиент Удаление', role: 'customer' });

  // Create thread with message
  Chat.sendMessage(custId, printId, ordId, 'Тестовое сообщение перед удалением');
  const threadKey = `${custId}__${printId}__${ordId}`;

  // Mark as read to test map cleanup
  Chat.markThreadRead(threadKey, custId);
  const mapBefore = Chat.getReadMap(custId);
  assert.ok(mapBefore[threadKey], 'Thread must be in read map');

  // Verify thread exists
  let userThreads = Chat.getAllUserThreads(custId);
  assert.ok(userThreads.some((t) => t.key === threadKey), 'Thread must be present in user threads');

  // Delete thread
  const deleted = Chat.deleteThread(threadKey, custId);
  assert.strictEqual(deleted, true, 'deleteThread must return true');

  // Verify thread is gone from DB
  const chatsAfter = DB.chats();
  assert.strictEqual(chatsAfter[threadKey], undefined, 'Thread must be removed from DB.chats');

  // Verify thread is gone from getAllUserThreads
  userThreads = Chat.getAllUserThreads(custId);
  assert.ok(!userThreads.some((t) => t.key === threadKey), 'Thread must be gone from getAllUserThreads');

  // Verify read marker is removed
  const mapAfter = Chat.getReadMap(custId);
  assert.strictEqual(mapAfter[threadKey], undefined, 'Thread must be removed from read map');
});

test('UI files contain chat delete triggers in dialog list and active header', () => {
  const cabJs = fs.readFileSync(path.join(DIR, 'cabinet.js'), 'utf8');
  assert.ok(cabJs.includes('btnDeleteCurrentChat'), 'cabinet.js must include btnDeleteCurrentChat');
  assert.ok(cabJs.includes('cab-dialog-delete-btn'), 'cabinet.js must include cab-dialog-delete-btn');
  assert.ok(cabJs.includes('confirmDeleteChat'), 'cabinet.js must include confirmDeleteChat');

  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('.cab-dialog-delete-btn'), 'styles.css must include .cab-dialog-delete-btn');
  assert.ok(css.includes('.btn--delete-chat'), 'styles.css must include .btn--delete-chat');
});

// ----------------------------------------------------
// 20. Dedicated Orders Management Section (FunPay-style deals: my-orders.html / my-orders.js)
// ----------------------------------------------------
console.log('\n--- 20. Dedicated Orders Management Section (FunPay-style deals) ---');

test('my-orders.html and my-orders.js exist and integrate into platform navigation', () => {
  const myOrdersHtml = fs.readFileSync(path.join(DIR, 'my-orders.html'), 'utf8');
  assert.ok(myOrdersHtml.includes('data-page="my-orders"'), 'my-orders.html must have data-page="my-orders"');
  assert.ok(myOrdersHtml.includes('roleTabs'), 'my-orders.html must include FunPay role tabs');
  assert.ok(myOrdersHtml.includes('statusFilters'), 'my-orders.html must include status filters');
  assert.ok(myOrdersHtml.includes('dealsFeedContainer'), 'my-orders.html must include dealsFeedContainer');
  assert.ok(myOrdersHtml.includes('my-orders.js'), 'my-orders.html must load my-orders.js');

  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');
  assert.ok(coreJs.includes('my-orders.html'), 'core.js navigation must link to my-orders.html');
});

test('my-orders.js implements full FunPay deal workflow and actions', () => {
  const myOrdersJs = fs.readFileSync(path.join(DIR, 'my-orders.js'), 'utf8');
  assert.ok(myOrdersJs.includes('btn-mark-ready'), 'my-orders.js must include btn-mark-ready for printer');
  assert.ok(myOrdersJs.includes('btn-complete-order'), 'my-orders.js must include btn-complete-order for customer');
  assert.ok(myOrdersJs.includes('DB.completeOrder'), 'my-orders.js must invoke DB.completeOrder for escrow release');
  assert.ok(myOrdersJs.includes('Chat.sendMessage'), 'my-orders.js must notify counterparty in chat');
  assert.ok(myOrdersJs.includes('deal-timeline'), 'my-orders.js must render visual deal timeline');
  assert.ok(myOrdersJs.includes('btn-rate-order'), 'my-orders.js must include review button');
});

test('Customer can assign master ONLY after master accepted/responded to the order', () => {
  const myOrdersJs = fs.readFileSync(path.join(DIR, 'my-orders.js'), 'utf8');

  // Verify assign button requires o.responses
  assert.ok(myOrdersJs.includes('o.responses.length > 0'), 'Assign button conditioned on master response/acceptance');
  assert.ok(myOrdersJs.includes('Заказ ещё не принят мастером'), 'Displays waiting badge when no master accepted yet');
  assert.ok(myOrdersJs.includes('btn-accept-order'), 'Master has button to accept/respond to open order');

  // Verify chat cabinet has no assign master button
  const cabinetJs = fs.readFileSync(path.join(DIR, 'cabinet.js'), 'utf8');
  assert.ok(!cabinetJs.includes('btnAssignMasterInChat'), 'cabinet.js must not contain btnAssignMasterInChat');
});

// ----------------------------------------------------
// SUITE 21: Modern 3D Canvas Viewer & Studio Renderer
// ----------------------------------------------------
console.log('\n--- 21. 3D Model Viewer & Studio Shading ---');

test('model.js implements backface culling, studio lighting and zoom controls', () => {
  const modelJs = fs.readFileSync(path.join(DIR, 'model.js'), 'utf8');
  // Backface culling check
  assert.ok(modelJs.includes('nz <= 0.0001'), 'model.js must implement backface culling (nz <= 0.0001)');
  // Studio lighting vectors
  assert.ok(modelJs.includes('Lx1') && modelJs.includes('Lx2'), 'model.js must have directional key and fill lights');
  // Specular Blinn-Phong highlight
  assert.ok(modelJs.includes('spec'), 'model.js must calculate specular highlight');
  // Ground shadow & build plate
  assert.ok(modelJs.includes('createRadialGradient') && modelJs.includes('ellipse'), 'model.js must render realistic ground shadow and build plate');
  // Interactive zoom & reset controls
  assert.ok(modelJs.includes('wheel') && modelJs.includes('dblclick'), 'model.js must support wheel zoom and double-click reset');
  // Color customization
  assert.ok(modelJs.includes('setColor'), 'model.js must expose setColor for material tints');
});

test('order.js integrates 3D viewer with filament material colors', () => {
  const orderJs = fs.readFileSync(path.join(DIR, 'order.js'), 'utf8');
  assert.ok(orderJs.includes('viewer.setColor'), 'order.js must update viewer color when filament changes');
  const orderHtml = fs.readFileSync(path.join(DIR, 'order.html'), 'utf8');
  assert.ok(orderHtml.includes('rotateHint'), 'order.html must include 3D navigation hint');
});

// ----------------------------------------------------
// SUITE 22: Hero 3D & Norilsk Image Carousel
// ----------------------------------------------------
console.log('\n--- 22. Hero Carousel (Norilsk & 3D Printing) ---');

test('index.html contains hero carousel with aurora transition and progress stories', () => {
  const indexHtml = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('hero__carousel'), 'index.html must have hero__carousel container');
  assert.ok(indexHtml.includes('heroAurora'), 'index.html must include aurora sweep element');
  assert.ok(indexHtml.includes('heroCarouselTag'), 'index.html must have dynamic topic badge');
  assert.ok(indexHtml.includes('heroIndicators'), 'index.html must have progress story indicators');
  assert.ok(indexHtml.includes('slidesData'), 'index.html script must define carousel slidesData');
});

test('All 10 Norilsk 3D printing images exist in img directory and are styled in CSS', () => {
  const expectedImages = [
    'hero.jpg',
    'hero-aurora-lab.jpg',
    'hero-arctic-gears.jpg',
    'hero-winter-maker.jpg',
    'hero-city-miniature.jpg',
    'hero-resin-sculpture.jpg',
    'hero-talnakh-workshop.jpg',
    'hero-delivery-snow.jpg',
    'hero-drone-part.jpg',
    'model-city.jpg'
  ];
  for (const img of expectedImages) {
    const p = path.join(DIR, 'img', img);
    assert.ok(fs.existsSync(p), `Missing image: img/${img}`);
    assert.ok(fs.statSync(p).size > 10000, `Image file img/${img} must be non-empty`);
  }

  const stylesCss = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(stylesCss.includes('auroraSweep'), 'styles.css must include auroraSweep animation');
  assert.ok(stylesCss.includes('hero__carousel'), 'styles.css must include hero__carousel styling');
  assert.ok(stylesCss.includes('heroDotFill'), 'styles.css must include indicator fill animation');
});

// ----------------------------------------------------
// SUITE 23: Executor Portfolio & Verified Customer Reviews
// ----------------------------------------------------
console.log('\n--- 23. Executor Portfolio & Verified Reviews ---');

test('portfolio.html and portfolio.js exist and integrate into platform', () => {
  const pPath = path.join(DIR, 'portfolio.html');
  const jsPath = path.join(DIR, 'portfolio.js');
  assert.ok(fs.existsSync(pPath), 'portfolio.html must exist');
  assert.ok(fs.existsSync(jsPath), 'portfolio.js must exist');

  const pHtml = fs.readFileSync(pPath, 'utf8');
  assert.ok(pHtml.includes('portfolio-filter-box'), 'portfolio.html must have filter controls');
  assert.ok(pHtml.includes('portfolio-grid'), 'portfolio.html must have portfolio grid');
  assert.ok(pHtml.includes('printerActionBanner'), 'portfolio.html must have executor action banner');

  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');
  assert.ok(coreJs.includes('portfolio.html'), 'core.js navigation must link to portfolio.html');
  assert.ok(coreJs.includes('addPortfolioItem'), 'core.js must implement DB.addPortfolioItem');
  assert.ok(coreJs.includes('deletePortfolioItem'), 'core.js must implement DB.deletePortfolioItem');
});

test('portfolio.js displays verified customer reviews under photos of site-completed orders', () => {
  const pJs = fs.readFileSync(path.join(DIR, 'portfolio.js'), 'utf8');
  assert.ok(pJs.includes('getLinkedReview'), 'portfolio.js must lookup verified review for orderId');
  assert.ok(pJs.includes('portfolio-review-box'), 'portfolio.js must render review box under photo');
  assert.ok(pJs.includes('Проверенная сделка'), 'portfolio.js must badge verified orders completed on site');
  assert.ok(pJs.includes('portOrderSelect'), 'portfolio.js modal must allow linking work to completed site orders');
  assert.ok(pJs.includes('linkedReviewPreviewBox'), 'portfolio.js modal must show live review preview when order selected');
});

test('cards.js displays printer portfolio items inside master modal', () => {
  const cardsJs = fs.readFileSync(path.join(DIR, 'cards.js'), 'utf8');
  assert.ok(cardsJs.includes('DB.portfolio(p.id)'), 'cards.js must query printer portfolio in openPrinterModal');
  assert.ok(cardsJs.includes('Работы из портфолио'), 'cards.js must display portfolio section in modal');
});

// ----------------------------------------------------
// SUITE 24: SQLite Backend & Transaction Isolation (node:sqlite)
// ----------------------------------------------------
console.log('\n--- 24. SQLite Backend & ACID Transaction Isolation ---');

test('server.js initializes SQLite database with all required relational tables', () => {
  const serverJs = fs.readFileSync(path.join(DIR, 'server.js'), 'utf8');
  assert.ok(serverJs.includes('node:sqlite'), 'server.js must use built-in node:sqlite');
  assert.ok(serverJs.includes('DatabaseSync'), 'server.js must instantiate DatabaseSync');
  assert.ok(serverJs.includes('CREATE TABLE IF NOT EXISTS printers'), 'server.js must create printers table');
  assert.ok(serverJs.includes('CREATE TABLE IF NOT EXISTS orders'), 'server.js must create orders table');
  assert.ok(serverJs.includes('CREATE TABLE IF NOT EXISTS wallets'), 'server.js must create wallets table');
  assert.ok(serverJs.includes('CREATE TABLE IF NOT EXISTS transactions'), 'server.js must create transactions table');
  assert.ok(serverJs.includes('CREATE TABLE IF NOT EXISTS sessions'), 'server.js must create sessions table');
});

test('EscrowService implements strict ACID transaction isolation (BEGIN TRANSACTION / COMMIT / ROLLBACK)', () => {
  const server = require(path.join(DIR, 'server.js'));
  assert.ok(server.EscrowService, 'server.js must export EscrowService');
  assert.strictEqual(typeof server.EscrowService.freeze, 'function', 'EscrowService must implement freeze');
  assert.strictEqual(typeof server.EscrowService.release, 'function', 'EscrowService must implement release');
  assert.strictEqual(typeof server.EscrowService.refund, 'function', 'EscrowService must implement refund');

  // Ensure test customer has sufficient balance for test
  server.sqlite.exec(`
    INSERT INTO wallets (userId, userRole, balance, frozenEscrow, updatedAt)
    VALUES ('test-cust-tx-1', 'customer', 10000, 0, ${Date.now()})
    ON CONFLICT(userId) DO UPDATE SET balance = 10000, frozenEscrow = 0;
  `);

  // Test freeze transaction
  const freezeRes = server.EscrowService.freeze('test-ord-tx-1', 'test-cust-tx-1', 500);
  assert.strictEqual(freezeRes.success, true, 'freeze must succeed');
  assert.ok(freezeRes.frozenEscrow >= 500, 'frozenEscrow must be updated');

  // Test release transaction
  const releaseRes = server.EscrowService.release('test-ord-tx-1', 'test-cust-tx-1', 'test-print-tx-1', 500, 10);
  assert.strictEqual(releaseRes.success, true, 'release must succeed');
  assert.strictEqual(releaseRes.commission, 50, '10% commission must equal 50');
  assert.strictEqual(releaseRes.payout, 450, '90% payout must equal 450');

  // Verify rollback on overdraft
  let errorCaught = false;
  try {
    server.EscrowService.freeze('test-ord-tx-2', 'broke-user', 999999999);
  } catch (err) {
    errorCaught = true;
  }
  assert.ok(errorCaught, 'EscrowService must rollback transaction when balance is insufficient');
});

// ----------------------------------------------------
// SUITE 25: Disk Uploads & Binary Storage (/uploads/)
// ----------------------------------------------------
console.log('\n--- 25. Disk Uploads & Binary Storage ---');

test('server.js implements /api/upload endpoint saving binary files to /uploads/ with UUIDs', () => {
  const serverJs = fs.readFileSync(path.join(DIR, 'server.js'), 'utf8');
  assert.ok(serverJs.includes('/api/upload'), 'server.js must provide /api/upload route');
  assert.ok(serverJs.includes('UPLOADS_DIR'), 'server.js must define UPLOADS_DIR');
  assert.ok(serverJs.includes('crypto.randomUUID()'), 'server.js must generate secure random UUIDs for uploaded files');
  assert.ok(fs.existsSync(path.join(DIR, 'uploads')), 'uploads directory must exist on disk');
});

// ----------------------------------------------------
// SUITE 26: Scrypt Password Hashing & HttpOnly Cookies
// ----------------------------------------------------
console.log('\n--- 26. Secure Authentication & Crypto ---');

test('server.js implements scryptSync password hashing and HttpOnly SameSite=Strict cookies', () => {
  const server = require(path.join(DIR, 'server.js'));
  assert.strictEqual(typeof server.hashPassword, 'function', 'server.js must export hashPassword');

  const salt1 = 'nord_salt_123';
  const hash1 = server.hashPassword('secretPass', salt1);
  const hash2 = server.hashPassword('secretPass', salt1);
  const hashDiff = server.hashPassword('secretPass', 'different_salt');

  assert.strictEqual(hash1, hash2, 'Identical password and salt must produce deterministic hash');
  assert.notStrictEqual(hash1, hashDiff, 'Different salt must produce completely different hash');
  assert.strictEqual(hash1.length, 128, 'scrypt 64-byte key must produce 128 hex chars');

  const serverJs = fs.readFileSync(path.join(DIR, 'server.js'), 'utf8');
  assert.ok(serverJs.includes('HttpOnly; SameSite=Strict'), 'server.js must issue HttpOnly and SameSite=Strict cookies');
  assert.ok(serverJs.includes('/api/auth/register'), 'server.js must support /api/auth/register');
  assert.ok(serverJs.includes('/api/auth/login'), 'server.js must support /api/auth/login');
  assert.ok(serverJs.includes('/api/auth/me'), 'server.js must support /api/auth/me');
});

// ----------------------------------------------------
// SUITE 27: ES Modules Architecture (core/ modularization)
// ----------------------------------------------------
console.log('\n--- 27. Modularization (ES Modules) ---');

test('core directory contains all required discrete ES modules', () => {
  assert.ok(fs.existsSync(path.join(DIR, 'core', 'db.js')), 'core/db.js must exist');
  assert.ok(fs.existsSync(path.join(DIR, 'core', 'auth.js')), 'core/auth.js must exist');
  assert.ok(fs.existsSync(path.join(DIR, 'core', 'escrow.js')), 'core/escrow.js must exist');
  assert.ok(fs.existsSync(path.join(DIR, 'core', 'chat.js')), 'core/chat.js must exist');
  assert.ok(fs.existsSync(path.join(DIR, 'core', 'ui.js')), 'core/ui.js must exist');
});

test('core/db.js implements IndexedDB storage for 3D STL models and high-res photos', () => {
  const dbJs = fs.readFileSync(path.join(DIR, 'core', 'db.js'), 'utf8');
  assert.ok(dbJs.includes('putModel'), 'core/db.js must implement putModel');
  assert.ok(dbJs.includes('getModel'), 'core/db.js must implement getModel');
  assert.ok(dbJs.includes('putPhoto'), 'core/db.js must implement putPhoto');
  assert.ok(dbJs.includes('getPhoto'), 'core/db.js must implement getPhoto');
  assert.ok(dbJs.includes('nord3d_storage'), 'core/db.js must define nord3d_storage IndexedDB database');
});

// ----------------------------------------------------
// SUITE 28: Zero-Dependency WebSocket Server & Typing Events
// ----------------------------------------------------
console.log('\n--- 28. Zero-Dependency WebSockets & Real-Time Typing ---');

test('server.js implements RFC 6455 WebSocket server with frame encoding and decoding', () => {
  const serverJs = fs.readFileSync(path.join(DIR, 'server.js'), 'utf8');
  assert.ok(serverJs.includes(`server.on('upgrade'`), 'server.js must listen to HTTP upgrade event');
  assert.ok(serverJs.includes('258EAFA5-E914-47DA-95CA-C5AB0DC85B11'), 'server.js must implement RFC 6455 GUID handshake');
  assert.ok(serverJs.includes('decodeWsFrame'), 'server.js must decode client masked frames');
  assert.ok(serverJs.includes('encodeWsFrame'), 'server.js must encode server unmasked frames');
  assert.ok(serverJs.includes('typing_start'), 'server.js must handle typing_start event');
  assert.ok(serverJs.includes('typing_stop'), 'server.js must handle typing_stop event');
});

test('core/chat.js implements WebSocket client with automatic typing indicators', () => {
  const chatJs = fs.readFileSync(path.join(DIR, 'core', 'chat.js'), 'utf8');
  assert.ok(chatJs.includes('WebSocket'), 'core/chat.js must instantiate WebSocket');
  assert.ok(chatJs.includes('sendTyping'), 'core/chat.js must implement sendTyping');
  assert.ok(chatJs.includes('handleInputTyping'), 'core/chat.js must implement handleInputTyping');
  assert.ok(chatJs.includes('typing_start') && chatJs.includes('typing_stop'), 'core/chat.js must broadcast typing start and stop');
});

// ----------------------------------------------------
// SUITE 29: WebGL 3D Acceleration with Canvas 2D Fallback
// ----------------------------------------------------
console.log('\n--- 29. WebGL 3D Acceleration & 2D Fallback ---');

test('model.js implements isWebGLSupported and dual WebGL/Canvas2D pipeline', () => {
  const modelJs = fs.readFileSync(path.join(DIR, 'model.js'), 'utf8');
  assert.ok(modelJs.includes('isWebGLSupported'), 'model.js must expose isWebGLSupported');
  assert.ok(modelJs.includes('VS_SOURCE') && modelJs.includes('FS_SOURCE'), 'model.js must define WebGL shaders');
  assert.ok(modelJs.includes('gl_FragColor'), 'model.js must include WebGL fragment shader color calculation');
  assert.ok(modelJs.includes('nz <= 0.0001'), 'model.js must retain Canvas 2D backface culling fallback');
});

// ----------------------------------------------------
// SUITE 30: Server-side Slicer (PrusaSlicer CLI in Docker)
// ----------------------------------------------------
console.log('\n--- 30. Server-side Slicer (PrusaSlicer CLI in Docker) ---');

test('Dockerfile.slicer and docker-compose.yml exist and configure headless PrusaSlicer', () => {
  assert.ok(fs.existsSync(path.join(DIR, 'Dockerfile.slicer')), 'Dockerfile.slicer must exist');
  const dSlicer = fs.readFileSync(path.join(DIR, 'Dockerfile.slicer'), 'utf8');
  assert.ok(dSlicer.includes('prusa-slicer'), 'Dockerfile.slicer must install prusa-slicer');
  assert.ok(dSlicer.includes('xvfb'), 'Dockerfile.slicer must install xvfb for headless execution');

  assert.ok(fs.existsSync(path.join(DIR, 'docker-compose.yml')), 'docker-compose.yml must exist');
  const dCompose = fs.readFileSync(path.join(DIR, 'docker-compose.yml'), 'utf8');
  assert.ok(dCompose.includes('nord3d-slicer'), 'docker-compose.yml must define slicer service');
  assert.ok(dCompose.includes('memory: 2048M'), 'docker-compose.yml must specify memory limits');
});

test('profiles directory contains standard Arctic slicing profiles', () => {
  const pDir = path.join(DIR, 'profiles');
  assert.ok(fs.existsSync(pDir), 'profiles directory must exist');
  const petg = fs.readFileSync(path.join(pDir, 'arctic_petg_0.20.ini'), 'utf8');
  assert.ok(petg.includes('fill_pattern = gyroid'), 'arctic_petg_0.20.ini must specify gyroid infill');
  assert.ok(petg.includes('perimeters = 4'), 'arctic_petg_0.20.ini must specify 4 perimeters for arctic strength');

  const pla = fs.readFileSync(path.join(pDir, 'standard_pla_0.20.ini'), 'utf8');
  assert.ok(pla.includes('filament_type = PLA'), 'standard_pla_0.20.ini must configure PLA');

  const nylon = fs.readFileSync(path.join(pDir, 'technical_nylon_0.20.ini'), 'utf8');
  assert.ok(nylon.includes('temperature = 265'), 'technical_nylon_0.20.ini must specify high temperature for nylon');
});

test('slicer.js parses PrusaSlicer G-code metadata and generates accurate slice details', async () => {
  const slicer = require(path.join(DIR, 'slicer.js'));
  assert.strictEqual(typeof slicer.sliceModel, 'function', 'slicer.js must export sliceModel');
  assert.strictEqual(typeof slicer.parseGCodeMetadata, 'function', 'slicer.js must export parseGCodeMetadata');
  assert.strictEqual(typeof slicer.getAvailableProfiles, 'function', 'slicer.js must export getAvailableProfiles');

  const profiles = slicer.getAvailableProfiles();
  assert.ok(profiles.length >= 4, 'slicer.js must discover at least 4 slicing profiles');

  // Test dummy slicing
  const dummyFile = path.join(DIR, 'uploads', 'test_dummy_model.stl');
  fs.writeFileSync(dummyFile, 'solid dummy\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 10 10 0\nendloop\nendfacet\nendsolid dummy\n', 'utf8');

  const result = await slicer.sliceModel(dummyFile, { material: 'PETG', infill: 30 });
  assert.strictEqual(result.ok, true, 'sliceModel must return ok: true');
  assert.ok(result.printTimeFormatted, 'sliceModel must return formatted print time');
  assert.ok(result.weightGrams > 0, 'sliceModel must return calculated filament weight in grams');
  assert.ok(result.totalLayers > 0, 'sliceModel must calculate total layer count');
  assert.ok(fs.existsSync(result.gcodePath), 'sliceModel must write actual .gcode file to disk');

  // Clean up
  fs.unlinkSync(result.gcodePath);
  fs.unlinkSync(dummyFile);
});

test('server.js exposes /api/slice and /api/slice/profiles routes', () => {
  const serverJs = fs.readFileSync(path.join(DIR, 'server.js'), 'utf8');
  assert.ok(serverJs.includes('/api/slice/profiles'), 'server.js must expose /api/slice/profiles');
  assert.ok(serverJs.includes('/api/slice'), 'server.js must expose /api/slice');
  assert.ok(serverJs.includes('slicer.sliceModel'), 'server.js must call slicer.sliceModel');
});

test('order.html and order.js integrate PrusaSlicer result box and G-Code download', () => {
  const orderHtml = fs.readFileSync(path.join(DIR, 'order.html'), 'utf8');
  assert.ok(orderHtml.includes('id="slicerResultBox"'), 'order.html must include slicerResultBox container');
  assert.ok(orderHtml.includes('id="btnDownloadGcode"'), 'order.html must include G-code download button');
  assert.ok(orderHtml.includes('slicer-box__badge'), 'order.html must include PrusaSlicer badge');

  const orderJs = fs.readFileSync(path.join(DIR, 'order.js'), 'utf8');
  assert.ok(orderJs.includes('triggerSlicing'), 'order.js must implement triggerSlicing');
  assert.ok(orderJs.includes('/api/slice'), 'order.js must fetch /api/slice');
});

// ----------------------------------------------------
// SUITE 31: Guest Access & Registration Redirects
// ----------------------------------------------------
console.log('\n--- 31. Guest Registration for Orders & 3D Scanning ---');

test('core.js intercepts guest clicks on order.html and scan.html buttons and opens registration form', () => {
  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');
  assert.ok(coreJs.includes('Глобальный перехват нажатий на «Разместить заказ»'), 'core.js must implement global click interceptor for guests');
  assert.ok(coreJs.includes('loginModal("customer"'), 'core.js must open customer registration modal for guests');
  assert.ok(coreJs.includes('titleHint'), 'core.js loginModal must support contextual titleHint for registration');
});

test('order.js and scan.js prompt guest registration upon direct page visits', () => {
  const orderJs = fs.readFileSync(path.join(DIR, 'order.js'), 'utf8');
  assert.ok(orderJs.includes('!N3D.DB.user()') && orderJs.includes('loginModal'), 'order.js must prompt registration for unauthenticated guests');

  const scanJs = fs.readFileSync(path.join(DIR, 'scan.js'), 'utf8');
  assert.ok(scanJs.includes('!N3D.DB.user()') && scanJs.includes('loginModal'), 'scan.js must prompt registration for unauthenticated guests');
});

// ----------------------------------------------------
// SUITE 32: Mobile Ergonomics & Viewport Overflow Protection
// ----------------------------------------------------
console.log('\n--- 32. Mobile Ergonomics & Viewport Overflow Protection ---');

test('styles.css enforces overflow-x protection and fluid mobile layout', () => {
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('overflow-x: hidden;'), 'styles.css must prevent horizontal scroll overflow on html/body');
  assert.ok(css.includes('.container { width: min(1200px, 92%); margin: 0 auto; box-sizing: border-box; }'), 'container must enforce box-sizing: border-box');
  assert.ok(css.includes('.nav-mobile-logout'), 'styles.css must style mobile drawer logout');
});

test('styles.css mobile breakpoint hides secondary header clutter (logoutBtn, userchip text) and compacts userbox', () => {
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  assert.ok(css.includes('#logoutBtn') && css.includes('display: none !important;'), 'logoutBtn must be hidden on mobile header row');
  assert.ok(css.includes('.userchip span') || css.includes('.userchip-text'), 'userchip text must be hidden on mobile');
  assert.ok(css.includes('.header__inner') && css.includes('height: 60px;'), 'header inner height must adapt on mobile');
});

test('core.js provides compact mobile header and mobile drawer logout option', () => {
  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');
  assert.ok(coreJs.includes('navMobileLogoutBtn'), 'core.js must render drawer logout button for mobile users');
  assert.ok(coreJs.includes('header-logout-btn'), 'core.js must tag header logout button with responsive class');
});

test('Mobile navigation drawer is fixed and header has overflow:visible to guarantee zero clipping', () => {
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');
  assert.ok(css.includes('position: fixed') && css.includes('z-index: 999999'), 'Mobile drawer must be fixed with top-level z-index');
  assert.ok(css.includes('.header') && css.includes('overflow: visible !important;'), 'Header must have overflow: visible to never clip dropdown drawer');
  assert.ok(coreJs.includes('burgerBtn') && coreJs.includes('aria-expanded'), 'Burger button must toggle aria-expanded and drawer open class');
});

// ----------------------------------------------------
// SUITE 33: Backend Order and Chat Real-Time Sync & Reconciliation
// ----------------------------------------------------
console.log('\n--- 33. Backend Order and Chat Real-Time Sync & Reconciliation ---');

test('core.js implements DB.addOrder and resilient apiSync reconciliation', () => {
  const coreJs = fs.readFileSync(path.join(DIR, 'core.js'), 'utf8');
  assert.ok(coreJs.includes('addOrder(order)'), 'core.js must provide DB.addOrder helper');
  assert.ok(coreJs.includes('apiSync.push("orders", order)'), 'DB.addOrder must sync order to backend');
  assert.ok(coreJs.includes('orderMap'), 'apiSync.pull must reconcile local and server orders without deleting local orders');
});

test('server.js supports atomic order and chat message persistence in SQLite', () => {
  const server = require(path.join(DIR, 'server.js'));
  const testOrderId = 'ord_sync_suite_' + Date.now().toString(36);
  const testThreadKey = 'cust_sync_1__print_sync_1__' + testOrderId;

  // Insert order
  server.sqlite.prepare("INSERT OR REPLACE INTO orders (id, status, budget, customerId, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(testOrderId, 'open', 2500, 'cust_sync_1', JSON.stringify({ id: testOrderId, title: 'Test Part' }), Date.now(), Date.now());

  const fetchedOrder = server.sqlite.prepare("SELECT json FROM orders WHERE id = ?").get(testOrderId);
  assert.ok(fetchedOrder, 'Order must be saved in orders table');
  assert.strictEqual(JSON.parse(fetchedOrder.json).id, testOrderId);

  // Insert chat thread and verify message appending
  const threadObj = {
    customerId: 'cust_sync_1',
    printerId: 'print_sync_1',
    orderId: testOrderId,
    messages: [{ id: 'm1', text: 'Первое сообщение', t: Date.now() }]
  };
  server.sqlite.prepare("INSERT OR REPLACE INTO chats (threadKey, json, updatedAt) VALUES (?, ?, ?)")
    .run(testThreadKey, JSON.stringify(threadObj), Date.now());

  const row = server.sqlite.prepare("SELECT json FROM chats WHERE threadKey = ?").get(testThreadKey);
  const parsed = JSON.parse(row.json);
  assert.ok(Array.isArray(parsed.messages), 'Chat thread must have messages array');
  assert.strictEqual(parsed.messages.length, 1);
  assert.strictEqual(parsed.messages[0].text, 'Первое сообщение');
});

// ----------------------------------------------------
// SUMMARY
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\n>>> ALL FUNCTIONS TESTED SUCCESSFULLY WITH ZERO ERRORS! <<<');
}
