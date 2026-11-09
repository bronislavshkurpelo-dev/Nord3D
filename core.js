// NORD 3D — общее ядро: база данных, раздельная авторизация, онлайн-присутствие, чат, модалки
(() => {
  "use strict";

  const DB_VERSION = "13";
  const K = {
    ver: "n3d_ver",
    printers: "n3d_printers",
    orders: "n3d_orders",
    chats: "n3d_chats",
    presence: "n3d_presence",
    user: "n3d_user",
    monetization: "n3d_monetization",
    wallets: "n3d_wallets",
    transactions: "n3d_transactions",
    reviews: "n3d_reviews",
    portfolio: "n3d_portfolio"
  };

  // ---------- Настройки монетизации (Безопасная сделка + Платные опции заказчиков) ----------
  const DEFAULT_MONETIZATION = {
    escrowEnabled: true,            // Модель 1: Безопасная сделка (Гарант NORD 3D)
    escrowCommissionPercent: 10,    // Комиссия сервиса при успешном завершении (10%)
    minEscrowAmount: 500,           // Минимальная сумма для безопасной сделки
    boostEnabled: true,             // Модель 3: Платные опции заказчиков (Boost / Срочность / Приватность)
    urgentPrice: 250,               // Срочный заказ (24ч): подсветка в ленте золотым неоном + топ выдачи
    privatePrice: 150,              // Приватный заказ: скрытие контактов и чертежей от публичного доступа
    modelingPrice: 500              // Помощь с 3D-моделированием / реверс-инжинирингом
  };

  // ---------- 5 Материалов ----------
  const MATERIALS = {
    PLA:   { name: "PLA",         price: 10, unit: "₽ / г",  density: 1.24, fdm: true,  color: "#e67700", info: "Универсальный эко-биопластик: макеты, корпуса, бытовые детали" },
    PETG:  { name: "PETG",        price: 12, unit: "₽ / г",  density: 1.27, fdm: true,  color: "#0ca678", info: "Ударопрочный и влагостойкий: автозапчасти, крепёж, уличные детали" },
    ABS:   { name: "ABS",         price: 13, unit: "₽ / г",  density: 1.04, fdm: true,  color: "#d9480f", info: "Термостойкий до 100°C: подкапотные детали, технические узлы" },
    TPU:   { name: "TPU (Flex)",  price: 18, unit: "₽ / г",  density: 1.21, fdm: true,  color: "#7048e8", info: "Гибкий как резина: прокладки, чехлы, амортизаторы, демпферы" },
    RESIN: { name: "Фотополимер", price: 25, unit: "₽ / мл", density: 1.15, fdm: false, color: "#1971c2", info: "Сверхвысокая детализация (0.02 мм): миниатюры, сувениры, шестерни" },
  };
  const MAT_KEYS = Object.keys(MATERIALS);

  // ---------- Спецматериалы (инженерные и арктические) ----------
  const SPEC_MATERIALS = {
    NYLON:  { name: "Nylon (PA12)",       price: 22, unit: "₽ / г", density: 1.14, fdm: true, color: "#099268", info: "Сверхпрочный полиамид: шестерни, втулки, нагруженные узлы" },
    CARBON: { name: "Carbon (PA-CF)",     price: 28, unit: "₽ / г", density: 1.18, fdm: true, color: "#343a40", info: "Углеволокно: предельная жесткость, легкость и прочность" },
    PC:     { name: "Поликарбонат (PC)",   price: 24, unit: "₽ / г", density: 1.20, fdm: true, color: "#1c7ed6", info: "Сверхтермостойкий и ударопрочный конструкционный пластик" },
    ASA:    { name: "ASA (УФ-стойкий)",   price: 16, unit: "₽ / г", density: 1.07, fdm: true, color: "#d6336c", info: "УФ- и атмосферостойкий: внешние детали техники для Севера" },
  };
  const SPEC_MAT_KEYS = Object.keys(SPEC_MATERIALS);

  const DISTRICTS = ["Норильск (центр)", "Талнах", "Кайеркан", "Оганер", "Дудинка"];
  const TECHS = [
    { id: "fdm", name: "FDM / FFF (филамент)", desc: "Послойное наплавление пластиковой нити" },
    { id: "sla", name: "SLA / MSLA (фотополимер)", desc: "Лазерное/LED отверждение жидкой смолы" }
  ];

  const STATUS = {
    open: { label: "Приём откликов", cls: "st-open" },
    in_work: { label: "В работе", cls: "st-work" },
    ready: { label: "Готов к выдаче", cls: "st-ready" },
    done: { label: "Завершён", cls: "st-done" },
  };

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- Опциональная фоновая синхронизация с бэкендом (/api) ----------
  const apiSync = {
    enabled: typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http"),
    push(endpoint, data) {
      if (!this.enabled) return;
      try {
        fetch(`/api/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        }).catch(() => {});
      } catch {}
    },
    async pull() {
      if (!this.enabled) return;
      try {
        const [pRes, oRes, cRes] = await Promise.allSettled([
          fetch("/api/printers"),
          fetch("/api/orders"),
          fetch("/api/chats")
        ]);
        if (pRes.status === "fulfilled" && pRes.value.ok) {
          const p = await pRes.value.json();
          if (Array.isArray(p) && p.length) { save(K.printers, p); window.dispatchEvent(new CustomEvent("n3d:data-updated")); }
        }
        if (oRes.status === "fulfilled" && oRes.value.ok) {
          const o = await oRes.value.json();
          if (Array.isArray(o) && o.length) { save(K.orders, o); window.dispatchEvent(new CustomEvent("n3d:data-updated")); }
        }
        if (cRes.status === "fulfilled" && cRes.value.ok) {
          const c = await cRes.value.json();
          if (c && typeof c === "object") { save(K.chats, c); window.dispatchEvent(new CustomEvent("n3d:chat-updated")); }
        }
      } catch {}
    },
    initSSE() {
      if (!this.enabled || typeof EventSource === "undefined") return;
      try {
        const es = new EventSource("/api/events");
        es.addEventListener("order_updated", (e) => {
          try {
            const item = JSON.parse(e.data);
            const list = DB.orders();
            const idx = list.findIndex((x) => x.id === item.id);
            if (idx >= 0) list[idx] = item; else list.unshift(item);
            save(K.orders, list);
            window.dispatchEvent(new CustomEvent("n3d:data-updated"));
          } catch {}
        });
        es.addEventListener("printer_updated", (e) => {
          try {
            const item = JSON.parse(e.data);
            const list = DB.printers();
            const idx = list.findIndex((x) => x.id === item.id);
            if (idx >= 0) list[idx] = item; else list.push(item);
            save(K.printers, list);
            window.dispatchEvent(new CustomEvent("n3d:data-updated"));
          } catch {}
        });
        es.addEventListener("chat_message", (e) => {
          try {
            const { threadKey, message } = JSON.parse(e.data);
            const chats = DB.chats();
            chats[threadKey] = chats[threadKey] || [];
            if (!chats[threadKey].some((m) => m.id === message.id)) {
              chats[threadKey].push(message);
              save(K.chats, chats);
              window.dispatchEvent(new CustomEvent("n3d:chat-updated"));
            }
          } catch {}
        });
      } catch {}
    }
  };

  const DB = {
    printers: () => load(K.printers, []),
    orders: () => load(K.orders, []),
    chats: () => load(K.chats, {}),
    savePrinters: (v) => {
      save(K.printers, v);
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));
      if (Array.isArray(v)) v.forEach((p) => apiSync.push("printers", p));
    },
    saveOrders: (v) => {
      save(K.orders, v);
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));
      if (Array.isArray(v) && v[0]) apiSync.push("orders", v[0]);
    },
    saveChats: (v) => {
      save(K.chats, v);
      window.dispatchEvent(new CustomEvent("n3d:chat-updated"));
    },
    deleteChat: (key) => {
      if (!key) return false;
      const c = DB.chats();
      if (c[key]) {
        delete c[key];
        DB.saveChats(c);
        return true;
      }
      return false;
    },
    printer: (id) => DB.printers().find((p) => p.id === id),
    order: (id) => DB.orders().find((o) => o.id === id),
    updateOrder(idOrObj, fn) {
      const l = DB.orders();
      const id = typeof idOrObj === "object" ? idOrObj.id : idOrObj;
      const o = l.find((x) => x.id === id);
      if (o) {
        if (typeof fn === "function") fn(o);
        else if (typeof idOrObj === "object") Object.assign(o, idOrObj);
        DB.saveOrders(l);
      }
      return o;
    },
    updatePrinter(idOrObj, fn) {
      const l = DB.printers();
      const id = typeof idOrObj === "object" ? idOrObj.id : idOrObj;
      const p = l.find((x) => x.id === id);
      if (p) {
        if (typeof fn === "function") fn(p);
        else if (typeof idOrObj === "object") Object.assign(p, idOrObj);
        DB.savePrinters(l);
      }
      return p;
    },
    user: () => {
      try {
        const raw = sessionStorage.getItem(K.user) || localStorage.getItem(K.user);
        if (!raw) return null;
        const u = JSON.parse(raw);
        try {
          if (!sessionStorage.getItem(K.user)) {
            sessionStorage.setItem(K.user, raw);
          }
        } catch {}
        return u;
      } catch {
        return null;
      }
    },
    setUser: (u) => {
      if (u) {
        const raw = JSON.stringify(u);
        try { sessionStorage.setItem(K.user, raw); } catch {}
        try { localStorage.setItem(K.user, raw); } catch {}
      } else {
        try { sessionStorage.removeItem(K.user); } catch {}
        try { localStorage.removeItem(K.user); } catch {}
      }
      Presence.touch();
    },
    monetization: () => {
      const stored = load(K.monetization, null);
      return stored ? { ...DEFAULT_MONETIZATION, ...stored } : { ...DEFAULT_MONETIZATION };
    },
    saveMonetization: (cfg) => {
      const merged = { ...DEFAULT_MONETIZATION, ...(cfg || {}) };
      save(K.monetization, merged);
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));
      return merged;
    },
    wallets: () => load(K.wallets, {}),
    saveWallets: (w) => {
      save(K.wallets, w);
      window.dispatchEvent(new CustomEvent("n3d:wallet-updated"));
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));
    },
    wallet: (userId) => {
      if (!userId) return { balance: 0, hold: 0, totalIn: 0, totalOut: 0 };
      const all = DB.wallets();
      if (!all[userId]) {
        all[userId] = { balance: 5000, hold: 0, totalIn: 5000, totalOut: 0 };
        DB.saveWallets(all);

        // Гарантируем наличие стартовой транзакции пополнения в истории
        const txList = load(K.transactions, []);
        if (!txList.some((t) => t.userId === userId)) {
          txList.unshift({
            id: "tx_" + uid(),
            userId,
            type: "deposit",
            amount: 5000,
            title: "Стартовое пополнение баланса",
            desc: "Приветственный баланс платформы · СБП (Система Быстрых Платежей)",
            orderId: null,
            orderTitle: "",
            status: "success",
            method: "sbp",
            date: Date.now() - 3600000 * 2,
            fee: 0
          });
          save(K.transactions, txList);
        }
      }
      return all[userId];
    },
    updateWallet: (userId, fn) => {
      if (!userId) return null;
      const all = DB.wallets();
      all[userId] = all[userId] || { balance: 0, hold: 0, totalIn: 0, totalOut: 0 };
      if (typeof fn === "function") fn(all[userId]);
      DB.saveWallets(all);
      return all[userId];
    },
    transactions: (userId) => {
      const list = load(K.transactions, []);
      if (!userId) return list;
      return list.filter((t) => t.userId === userId).sort((a, b) => (b.date || 0) - (a.date || 0));
    },
    saveTransactions: (list) => {
      save(K.transactions, list);
      window.dispatchEvent(new CustomEvent("n3d:wallet-updated"));
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));
    },
    addTransaction: (tx) => {
      const list = load(K.transactions, []);
      const item = {
        id: tx.id || ("tx_" + uid()),
        userId: tx.userId,
        type: tx.type || "deposit", // 'deposit' | 'withdraw' | 'hold' | 'release' | 'payout' | 'payment'
        amount: Math.round(Number(tx.amount) || 0),
        title: tx.title || "Финансовая операция",
        desc: tx.desc || "",
        orderId: tx.orderId || null,
        orderTitle: tx.orderTitle || "",
        status: tx.status || "success", // 'success' | 'hold' | 'pending' | 'cancelled'
        date: tx.date || Date.now(),
        method: tx.method || "sbp",
        fee: Math.round(Number(tx.fee) || 0)
      };
      list.unshift(item);
      DB.saveTransactions(list);

      // Автоматическое обновление баланса кошелька
      DB.updateWallet(item.userId, (w) => {
        if (item.type === "deposit") {
          w.balance += item.amount;
          w.totalIn += item.amount;
        } else if (item.type === "withdraw") {
          w.balance = Math.max(0, w.balance - item.amount);
          w.totalOut += item.amount;
        } else if (item.type === "hold") {
          w.hold += item.amount;
        } else if (item.type === "release") {
          w.hold = Math.max(0, w.hold - item.amount);
          w.balance += item.amount;
          w.totalIn += item.amount;
        } else if (item.type === "payment") {
          const fromHold = Math.min(w.hold || 0, item.amount);
          const fromBal = item.amount - fromHold;
          w.hold = Math.max(0, (w.hold || 0) - fromHold);
          w.balance = Math.max(0, (w.balance || 0) - fromBal);
          w.totalOut = (w.totalOut || 0) + item.amount;
        } else if (item.type === "payout") {
          w.hold = Math.max(0, (w.hold || 0) - item.amount);
          w.balance = (w.balance || 0) + item.amount;
          w.totalIn = (w.totalIn || 0) + item.amount;
        }
      });
      return item;
    },
    completeOrder: (orderId, options = {}) => {
      const o = DB.order(orderId);
      if (!o) return null;
      if (o.status === "done" && o.payoutProcessed) {
        return { order: o, payout: o.payoutToPrinter || 0, fee: o.platformFeeEarned || 0 };
      }

      const pId = options.printerId || o.printerId || o.invitedId;
      const budget = Math.round(Number(o.budget) || 0);
      const commPct = o.escrowCommissionPercent !== undefined ? o.escrowCommissionPercent : 10;
      const commVal = Math.round(budget * commPct / 100);
      const payout = Math.max(0, budget - commVal);

      // Обновляем заказ
      DB.updateOrder(orderId, (x) => {
        x.status = "done";
        if (pId) x.printerId = pId;
        if (options.rating) x.rating = options.rating;
        x.payoutToPrinter = payout;
        x.platformFeeEarned = commVal;
        x.releasedAt = Date.now();
        x.escrowStatus = "released";
        x.payoutProcessed = true;
      });

      // Списание у заказчика
      if (o.customerId && budget > 0) {
        DB.addTransaction({
          userId: o.customerId,
          type: "payment",
          amount: budget,
          title: `Оплата заказа #${o.id}`,
          desc: `Заказ «${o.title}» подтверждён и принят. Средства переведены исполнителю.`,
          orderId: o.id,
          orderTitle: o.title,
          status: "success",
          method: "escrow"
        });
      }

      // Начисление исполнителю на баланс
      if (pId && payout > 0) {
        DB.addTransaction({
          userId: pId,
          type: "payout",
          amount: payout,
          fee: commVal,
          title: `Выплата за заказ #${o.id}`,
          desc: `Заказ «${o.title}» выполнен. Зачислено на доступный баланс (комиссия сервиса 10%: ${money(commVal)}).`,
          orderId: o.id,
          orderTitle: o.title,
          status: "success",
          method: "escrow"
        });
      }

      window.dispatchEvent(new CustomEvent("n3d:wallet-updated"));
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));
      return { order: DB.order(orderId), payout, fee: commVal };
    },
    deposit: (userId, amount, method = "sbp", desc = "Пополнение баланса") => {
      return DB.addTransaction({
        userId,
        type: "deposit",
        amount,
        title: "Пополнение баланса",
        desc: desc || `Пополнение через ${method.toUpperCase()}`,
        method,
        status: "success"
      });
    },
    withdraw: (userId, amount, destination = "СБП", desc = "Вывод на карту/счёт") => {
      const w = DB.wallet(userId);
      if (w.balance < amount) throw new Error("Недостаточно средств на балансе");
      return DB.addTransaction({
        userId,
        type: "withdraw",
        amount,
        title: "Вывод средств",
        desc: desc || `Вывод на ${destination}`,
        method: "withdraw",
        status: "success"
      });
    },
    reviews: (printerId) => {
      const all = load(K.reviews, []);
      if (!printerId) return all;
      return all.filter((r) => r.printerId === printerId).sort((a, b) => (b.date || 0) - (a.date || 0));
    },
        portfolio: (printerId) => {
      let all = load(K.portfolio, null);
      if (!all || !all.length) {
        all = seedPortfolio();
        save(K.portfolio, all);
      }
      if (!printerId) return all.sort((a, b) => (b.date || 0) - (a.date || 0));
      return all.filter((item) => item.printerId === printerId).sort((a, b) => (b.date || 0) - (a.date || 0));
    },
    savePortfolio: (list) => {
      save(K.portfolio, list);
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));
    },
    addPortfolioItem: (item) => {
      const list = load(K.portfolio, null) || seedPortfolio();
      const p = DB.printer(item.printerId);
      const newItem = {
        id: item.id || ("port_" + uid()),
        printerId: item.printerId,
        printerName: item.printerName || (p ? p.name : "Мастер"),
        district: item.district || (p ? p.district : "Норильск"),
        title: (item.title || "Работа из портфолио").trim(),
        description: (item.description || "").trim(),
        photo: item.photo || "img/parts.jpg",
        material: item.material || "PETG",
        color: item.color || "Чёрный",
        category: item.category || "Авто/мото и спецтехника",
        orderId: item.orderId || null,
        date: item.date || Date.now()
      };
      list.unshift(newItem);
      DB.savePortfolio(list);
      return newItem;
    },
    deletePortfolioItem: (id) => {
      const list = load(K.portfolio, null) || seedPortfolio();
      const updated = list.filter((item) => item.id !== id);
      DB.savePortfolio(updated);
    },
    updatePortfolioItem: (id, updates) => {
      const list = load(K.portfolio, null) || seedPortfolio();
      const idx = list.findIndex((item) => item.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates };
        DB.savePortfolio(list);
        return list[idx];
      }
      return null;
    },
    saveReviews: (list) => {
      save(K.reviews, list);
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));
    },
    addReview: (rev) => {
      const list = load(K.reviews, []);
      const item = {
        id: rev.id || ("rev_" + uid()),
        printerId: rev.printerId,
        customerId: rev.customerId,
        customerName: rev.customerName || "Заказчик",
        customerAvatar: rev.customerAvatar || null,
        district: rev.district || "Норильск",
        orderId: rev.orderId || null,
        orderTitle: rev.orderTitle || "3D-печать детали",
        service: rev.service || "fdm", // 'fdm' | 'sla' | 'scan' | 'modeling'
        serviceName: rev.serviceName || "3D-печать (FDM)",
        score: Math.min(5, Math.max(1, Number(rev.score) || 5)),
        accuracyScore: Number(rev.accuracyScore) || 5,
        speedScore: Number(rev.speedScore) || 5,
        commScore: Number(rev.commScore) || 5,
        comment: rev.comment || "Отличная работа, всё понравилось!",
        date: rev.date || Date.now(),
        verifiedEscrow: rev.verifiedEscrow !== false
      };
      list.unshift(item);
      DB.saveReviews(list);

      // Пересчёт рейтинга мастера
      DB.updatePrinter(item.printerId, (p) => {
        const pRevs = list.filter((r) => r.printerId === item.printerId);
        const avg = pRevs.reduce((acc, r) => acc + r.score, 0) / (pRevs.length || 1);
        p.rating = Math.round(avg * 10) / 10;
        p.reviews = pRevs.length;
      });
      return item;
    },
    reset() {
      Object.values(K).forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });
      try { sessionStorage.removeItem(K.user); } catch {}
      seed();
    },
  };

  // ---------- Присутствие (Онлайн статус) ----------
  const Presence = {
    touch() {
      const u = DB.user();
      if (!u) return;
      const map = load(K.presence, {});
      map[u.id] = Date.now();
      save(K.presence, map);
    },
    isOnline(userId) {
      if (userId === "p79002223344" || userId === "p79003334455") return true;
      const u = DB.user();
      if (u && u.id === userId) return true;
      const map = load(K.presence, {});
      const last = map[userId];
      return !!(last && (Date.now() - last < 2.5 * 60 * 1000));
    },
    badge(userId) {
      const on = Presence.isOnline(userId);
      return `<span class="online-badge ${on ? "online" : "offline"}" title="${on ? "В сети прямо сейчас" : "Не в сети"}"><i class="dot"></i>${on ? "В сети" : "Был недавно"}</span>`;
    }
  };

  setInterval(Presence.touch, 30000);
  window.addEventListener("pointerdown", Presence.touch, { passive: true });

  // ---------- Демо-данные ----------
  
  function seedPortfolio() {
    const day = 86400000, now = Date.now();
    return [
      {
        id: "port_1",
        printerId: "p79001112233",
        printerName: "Алексей К.",
        district: "Норильск (центр)",
        title: "Кронштейн крепления камеры на снегоход",
        category: "Авто/мото и спецтехника",
        material: "PETG",
        color: "Чёрный",
        photo: "img/parts.jpg",
        description: "Напечатан из ударопрочного PETG со 100% заполнением крепежных проушин. Морозостойкость проверена на плато Путорана до -42°C. Отверстия под винты М6 с запасом 6.4 мм.",
        orderId: "o1",
        date: now - 2 * day
      },
      {
        id: "port_2",
        printerId: "p79001112233",
        printerName: "Алексей К.",
        district: "Норильск (центр)",
        title: "🔬 Реверс шестерни привода снегохода «Буран»",
        category: "Авто/мото и спецтехника",
        material: "PETG",
        color: "Бирюзовый",
        photo: "img/hero-arctic-gears.jpg",
        description: "Оптическое 3D-сканирование сломанного образца на Revopoint POP 3. Полное восстановление профиля зубьев в CAD (Fusion 360) и печать 2 шт. с 5 периметрами.",
        orderId: "o_scan1",
        date: now - 5 * day
      },
      {
        id: "port_3",
        printerId: "p79003334455",
        printerName: "Дарья М.",
        district: "Кайеркан",
        title: "Миниатюры персонажей для настольных игр",
        category: "Фигурки и сувениры",
        material: "RESIN",
        color: "Серый",
        photo: "img/hero-resin-sculpture.jpg",
        description: "Фотополимерная печать на Anycubic Photon Mono M5s с ультравысоким разрешением 0.025 мм. Идеальная детализация доспехов, лиц и микроэлементов. УФ-дозасветка и промывка в изопропиле.",
        orderId: "o6",
        date: now - 7 * day
      },
      {
        id: "port_4",
        printerId: "p79004445566",
        printerName: "Игорь С.",
        district: "Норильск (центр)",
        title: "Корпус для внешнего датчика температуры",
        category: "Корпуса и приборы",
        material: "PLA",
        color: "Белый",
        photo: "img/parts.jpg",
        description: "Компактный вентилируемый корпус под плату датчика с защелками без саморезов. Печать соплом 0.4 мм, толщина слоя 0.16 мм, точные посадочные пазы под кабельный ввод.",
        orderId: "o4",
        date: now - 6 * day
      },
      {
        id: "port_5",
        printerId: "p79002223344",
        printerName: "Мастерская «Полярный слой»",
        district: "Талнах",
        title: "Органайзеры для инструментов и крепежа",
        category: "Бытовые изделия",
        material: "PLA",
        color: "Белый",
        photo: "img/hero-talnakh-workshop.jpg",
        description: "Партия из 6 модульных лотков для верстака и кухни. Стенки 2.4 мм, стойкость к падениям, штабелируемая конструкция со скрытыми пазами.",
        orderId: "o2",
        date: now - 10 * day
      },
      {
        id: "port_6",
        printerId: "p79003334455",
        printerName: "Дарья М.",
        district: "Кайеркан",
        title: "Архитектурный макет исторического квартала Норильска",
        category: "Архитектура и макеты",
        material: "PLA",
        color: "Многоцвет",
        photo: "img/model-city.jpg",
        description: "Выставочный макет застройки Ленинского проспекта в масштабе 1:500. Выполнен на Bambu Lab A1 с системой AMS (4 цвета в одном слое без покраски). Съемные крыши и внутренняя подсветка.",
        orderId: null,
        date: now - 14 * day
      },
      {
        id: "port_7",
        printerId: "p79005556677",
        printerName: "Тимур Р.",
        district: "Оганер",
        title: "Каркас арктического БПЛА из карбона",
        category: "Промышленные детали",
        material: "CARBON",
        color: "Антрацит",
        photo: "img/hero-drone-part.jpg",
        description: "Высокотемпературный композит PETG-CF с добавлением 20% углеволокна. Экстремальная жесткость на кручение, вес всей рамы всего 85 грамм, идеальная балансировка.",
        orderId: null,
        date: now - 18 * day
      },
      {
        id: "port_8",
        printerId: "p79001112233",
        printerName: "Алексей К.",
        district: "Норильск (центр)",
        title: "Герметичный бокс для рации и навигатора",
        category: "Корпуса и приборы",
        material: "PETG",
        color: "Оранжевый",
        photo: "img/workshop.jpg",
        description: "Влагозащищенный кейс со съемной крышкой и пазом под силиконовый уплотнитель. Яркий сигнальный цвет для легкого поиска в снегу при полярной ночи.",
        orderId: null,
        date: now - 22 * day
      }
    ];
  }

  function seed() {
    const day = 86400000, h = 3600000, now = Date.now();
    const iso = (d) => new Date(now + d * day).toISOString().slice(0, 10);
    const printers = [
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
        about: "Недорого и быстро. Запчасти для бытовой техники, держатели, органайзеры.",
        rating: 4.6,
        reviews: 22,
        done: 31,
        since: "2023"
      },
      {
        id: "p79005556677",
        name: "Тимур Р.",
        phone: "+7 900 555-66-77",
        telegram: "@timur_eng_3d",
        district: "Оганер",
        tech: ["fdm"],
        equipment: "Bambu Lab X1 Carbon",
        buildArea: "256 × 256 × 256 мм",
        materials: ["PETG", "ABS", "TPU"],
        materialPrices: { PETG: 12, ABS: 14, TPU: 19 },
        pricePerGram: 12,
        minOrder: 500,
        services: ["modeling", "urgent"],
        about: "Инженерные детали из PETG, ABS и TPU. Помогу доработать модель под печать в CAD.",
        rating: 4.7,
        reviews: 9,
        done: 12,
        since: "2024"
      },
    ];
    const C = { id: "c79990001122", name: "Сергей", phone: "+7 999 000-11-22", district: "Норильск (центр)", telegram: "@sergey_nor" };
    const mk = (o) => ({ customerId: C.id, customerName: C.name, customerPhone: C.phone, color: "Чёрный", infill: 20, quality: "normal", delivery: false, comment: "", responses: [], printerId: null, rating: null, invitedId: null, ...o });
    const orders = [
      mk({
        id: "o_scan1",
        customerId: "c79991112233",
        customerName: "Ольга",
        customerPhone: "+7 999 111-22-33",
        type: "scan",
        category: "3d-сканирование",
        title: "🔬 3D-сканирование и реверс шестерни привода снегохода «Буран»",
        file: { name: "buran_gear_photo.jpg", size: 1420500 },
        photos: ["img/parts.jpg"],
        scanDetails: {
          dimensions: "78 × 78 × 26 мм",
          originalMaterial: "Пластик / Капролон",
          surface: "Стандартная матовая",
          purpose: "Реверс-инжиниринг и 3D-печать",
          needsPrint: true,
          printMaterial: "PETG",
          printColor: "Чёрный",
          printQty: 2,
          handover: "Привезу мастеру лично в Талнахе"
        },
        volume: 24000,
        size: [78, 78, 26],
        material: "PETG",
        color: "Чёрный",
        qty: 2,
        infill: 60,
        deadline: iso(3),
        district: "Талнах",
        budget: 2800,
        estimate: 2500,
        comment: "Сломало 3 зуба на шестерне привода. Деталь редкая, доставки ждать месяц. Нужно отсканировать целую часть, достроить сломанные зубья в CAD и распечатать 2 штуки из морозостойкого PETG.",
        status: "open",
        createdAt: now - 3 * h,
        responses: [
          { id: "r_sc1", printerId: "p79001112233", price: 2600, days: 2, message: "Привет! Есть оптический 3D-сканер Revopoint. Отсканирую за час, восстановлю профиль зуба во Fusion 360 и напечатаю из ударопрочного PETG.", createdAt: now - 1.5 * h }
        ]
      }),
      mk({
        id: "o_scan2",
        customerId: "c79992223344",
        customerName: "Максим",
        customerPhone: "+7 999 222-33-44",
        type: "scan",
        category: "3d-сканирование",
        title: "🔬 Оцифровка кронштейна дополнительного света на экспедиционник",
        file: { name: "light_bracket.jpg", size: 2120000 },
        photos: ["img/workshop.jpg"],
        scanDetails: {
          dimensions: "140 × 65 × 42 мм",
          originalMaterial: "Алюминий / Металл",
          surface: "Сложная изогнутая геометрия",
          purpose: "Параметрическая CAD-модель (STEP / IGES)",
          needsPrint: false,
          printMaterial: "PETG",
          printColor: "Чёрный",
          printQty: 1,
          handover: "Привезу в Норильск (центр)"
        },
        volume: 45000,
        size: [140, 65, 42],
        material: "PETG",
        color: "Чёрный",
        qty: 1,
        deadline: iso(5),
        district: "Норильск (центр)",
        budget: 3200,
        estimate: 3000,
        comment: "Кронштейн сложной формы под изгиб кузова. Нужен точный STEP-файл для дальнейшей лазерной резки и ЧПУ гибки.",
        status: "open",
        createdAt: now - 12 * h,
        responses: []
      }),
      mk({ id: "o1", title: "Кронштейн для крепления камеры на снегоход", file: { name: "bracket_v3.stl", size: 482113 }, volume: 38400, size: [92, 48, 35], material: "PETG", qty: 2, infill: 40, deadline: iso(4), district: "Норильск (центр)", budget: 1200, estimate: 1080, comment: "Должен держать мороз до −40, важна прочность.", status: "in_work", printerId: "p79001112233", createdAt: now - 3 * h,
        responses: [
          { id: "r1", printerId: "p79001112233", price: 1100, days: 2, message: "Напечатаю из PETG с 5 стенками, будет крепко.", createdAt: now - 2 * h },
          { id: "r2", printerId: "p79005556677", price: 1300, days: 1, message: "Могу завтра. Предлагаю усилить рёбра — скину вариант.", createdAt: now - h },
        ] }),
      mk({ id: "o2", customerId: "c79991112233", customerName: "Ольга", customerPhone: "+7 999 111-22-33", title: "Набор органайзеров для ящика кухни", file: { name: "organizer_set.3mf", size: 1820443 }, volume: 210000, size: [180, 120, 60], material: "PLA", color: "Белый", qty: 6, deadline: iso(7), district: "Талнах", budget: 3500, estimate: 3200, status: "open", createdAt: now - 26 * h,
        responses: [{ id: "r3", printerId: "p79002223344", price: 3400, days: 3, message: "Сделаем всё за 3 дня, доставка по Талнаху бесплатно.", createdAt: now - 20 * h }] }),
      mk({ id: "o3", customerId: "c79992223344", customerName: "Максим", customerPhone: "+7 999 222-33-44", title: "Шестерня для мясорубки", file: { name: "gear_z24.stl", size: 220311 }, volume: 9200, size: [46, 46, 14], material: "ABS", qty: 1, infill: 100, deadline: iso(2), district: "Кайеркан", budget: 500, estimate: 500, status: "open", createdAt: now - 5 * h }),
      mk({ id: "o6", customerId: "c79993334455", customerName: "Анна", customerPhone: "+7 999 333-44-55", title: "Миниатюры для настольной игры, 8 шт.", file: { name: "minis_pack.stl", size: 8420113 }, volume: 16000, size: [32, 32, 45], material: "RESIN", color: "Серый", qty: 8, infill: 100, deadline: iso(6), district: "Кайеркан", budget: 2500, estimate: 2320, comment: "Важна детализация лиц и оружия.", status: "open", createdAt: now - 8 * h,
        responses: [{ id: "r5", printerId: "p79003334455", price: 2400, days: 3, message: "Напечатаю на фотополимерном принтере, слой 0.05 мм.", createdAt: now - 6 * h }] }),
      mk({ id: "o7", customerId: "c79991112233", customerName: "Ольга", customerPhone: "+7 999 111-22-33", title: "Уплотнитель для двери гаража (гибкий)", file: { name: "seal_profile.3mf", size: 302443 }, volume: 52000, size: [240, 22, 18], material: "TPU", qty: 4, deadline: iso(9), district: "Оганер", budget: 2200, estimate: 2120, status: "open", createdAt: now - 30 * h }),
      mk({ id: "o4", title: "Корпус для датчика температуры", file: { name: "sensor_case.stl", size: 302556 }, volume: 21500, size: [70, 45, 28], material: "PLA", qty: 3, deadline: iso(-2), district: "Норильск (центр)", budget: 900, estimate: 800, status: "done", printerId: "p79004445566", rating: 5, createdAt: now - 6 * day }),
      mk({ id: "o5", customerId: "c79993334455", customerName: "Анна", customerPhone: "+7 999 333-44-55", title: "Фигурка песца — подарок, многоцвет", file: { name: "arctic_fox.3mf", size: 5120332 }, volume: 64000, size: [80, 60, 110], material: "PLA", color: "Многоцвет", qty: 1, deadline: iso(5), district: "Кайеркан", budget: 1500, estimate: 900, status: "in_work", printerId: "p79003334455", createdAt: now - 2 * day,
        responses: [{ id: "r4", printerId: "p79003334455", price: 1400, days: 3, message: "Сделаю в 4 цвета на AMS!", createdAt: now - 2 * day }] }),
    ];

    const cid1 = "c79990001122__p79001112233__o1";
    const cid2 = "c79990001122__p79005556677__o1";
    const cid3 = "c79993334455__p79003334455__o5";
    const chats = {
      [cid1]: {
        orderId: "o1",
        customerId: C.id,
        customerName: C.name,
        printerId: "p79001112233",
        messages: [
          { id: "m1", from: "p79001112233", text: "Здравствуйте! Посмотрел модель кронштейна. Отверстия под винты М5 или М6?", t: now - 110 * 60000 },
          { id: "m2", from: C.id, text: "Добрый день! М6, винты от штатного крепления.", t: now - 100 * 60000 },
          { id: "m3", from: "p79001112233", text: "Понял, сделаю отверстия 6.4 мм с запасом на усадку PETG. Могу усилить рёбра жёсткости — бесплатно.", t: now - 90 * 60000 },
          { id: "m4", from: C.id, text: "Отлично, договорились! Выбрал вас исполнителем.", t: now - 80 * 60000 },
          { id: "m5", from: "p79001112233", text: "Принял в работу, катушка чёрного PETG уже установлена. Вот фото готового комплекта кронштейнов:", image: "img/parts.jpg", t: now - 70 * 60000 }
        ]
      },
      [cid2]: {
        orderId: "o1",
        customerId: C.id,
        customerName: C.name,
        printerId: "p79005556677",
        messages: [
          { id: "m20", from: "p79005556677", text: "Добрый вечер! Готов начать завтра с утра. Есть чёрный и оранжевый PETG — какой лучше?", t: now - 40 * 60000 }
        ]
      },
      [cid3]: {
        orderId: "o5",
        customerId: "c79993334455",
        customerName: "Анна",
        printerId: "p79003334455",
        messages: [
          { id: "m30", from: "p79003334455", text: "Здравствуйте, Анна! Модель фигурки песца проверила, FDM нарезка с 4 цветами настроена.", t: now - 180 * 60000 },
          { id: "m31", from: "c79993334455", text: "Добрый день! Отлично, главное чтобы переход цветов на мордочке был плавным.", t: now - 120 * 60000 },
          { id: "m32", from: "p79003334455", text: "Да, сделаю слой 0.12 мм для максимальной детализации. Печать уже запущена!", t: now - 60 * 60000 }
        ]
      }
    };

    DB.savePrinters(printers);
    DB.saveOrders(orders);
    save(K.chats, chats);

    const wallets = {
      ["c79990001122"]: {
        balance: 14300,
        hold: 1100,
        totalIn: 25000,
        totalOut: 9600
      },
      ["p79001112233"]: {
        balance: 38600,
        hold: 990,
        totalIn: 74500,
        totalOut: 35000
      }
    };

    const transactions = [
      // Заказчик Сергей
      {
        id: "tx_c1",
        userId: "c79990001122",
        type: "hold",
        amount: 1100,
        title: "Гарант NORD 3D (Резервирование)",
        desc: "Заказ #o1 «Кронштейн для снегохода» · Холд на гарантийном счёте до приёмки",
        orderId: "o1",
        orderTitle: "Кронштейн для крепления камеры на снегоход",
        status: "hold",
        method: "escrow",
        date: now - 3 * h
      },
      {
        id: "tx_c2",
        userId: "c79990001122",
        type: "deposit",
        amount: 10000,
        title: "Пополнение баланса",
        desc: "СБП (Т-Банк) · Моментальное зачисление без комиссии",
        status: "success",
        method: "sbp",
        date: now - 1 * day
      },
      {
        id: "tx_c3",
        userId: "c79990001122",
        type: "payment",
        amount: 800,
        title: "Оплата выполненного заказа",
        desc: "Заказ #o4 «Корпус для датчика температуры» · Сделка успешно закрыта",
        orderId: "o4",
        orderTitle: "Корпус для датчика температуры",
        status: "success",
        method: "escrow",
        date: now - 6 * day
      },
      {
        id: "tx_c4",
        userId: "c79990001122",
        type: "deposit",
        amount: 15000,
        title: "Пополнение баланса",
        desc: "Банковская карта МИР ···· 4812",
        status: "success",
        method: "card",
        date: now - 7 * day
      },
      {
        id: "tx_c5",
        userId: "c79990001122",
        type: "payment",
        amount: 8800,
        title: "Оплата партии шестерней",
        desc: "Заказ «Шестерни редуктора привода» (8 шт.)",
        status: "success",
        method: "escrow",
        date: now - 14 * day
      },

      // Мастер Алексей К.
      {
        id: "tx_p1",
        userId: "p79001112233",
        type: "hold",
        amount: 990,
        fee: 110,
        title: "Гарант NORD 3D (Ожидает приёмки)",
        desc: "Выплата по заказу #o1 «Кронштейн для снегохода» (бюджет 1 100 ₽, комиссия 10%: 110 ₽)",
        orderId: "o1",
        orderTitle: "Кронштейн для крепления камеры на снегоход",
        status: "hold",
        method: "escrow",
        date: now - 3 * h
      },
      {
        id: "tx_p2",
        userId: "p79001112233",
        type: "withdraw",
        amount: 15000,
        title: "Вывод средств на карту",
        desc: "СБП на карту Т-Банк ···· 2910 · Комиссия 0%",
        status: "success",
        method: "withdraw",
        date: now - 1 * day
      },
      {
        id: "tx_p3",
        userId: "p79001112233",
        type: "payout",
        amount: 2340,
        fee: 260,
        title: "Выплата за выполнение заказа",
        desc: "Заказ #o_scan1 «Шестерня привода снегохода Буран» · Средства зачислены на баланс",
        orderId: "o_scan1",
        orderTitle: "Шестерня привода снегохода Буран",
        status: "success",
        method: "escrow",
        date: now - 3 * day
      },
      {
        id: "tx_p4",
        userId: "p79001112233",
        type: "payout",
        amount: 4800,
        title: "Выплата за выполнение заказа",
        desc: "Заказ «Кронштейны для экспедиционных фар 4 шт»",
        status: "success",
        method: "escrow",
        date: now - 5 * day
      },
      {
        id: "tx_p5",
        userId: "p79001112233",
        type: "withdraw",
        amount: 20000,
        title: "Вывод средств на карту",
        desc: "СБП на карту Сбер ···· 7731 · Комиссия 0%",
        status: "success",
        method: "withdraw",
        date: now - 10 * day
      },
      {
        id: "tx_p6",
        userId: "p79001112233",
        type: "payout",
        amount: 6500,
        title: "Выплата за 3D-сканирование и реверс",
        desc: "Заказ «Оцифровка корпуса навигатора»",
        status: "success",
        method: "escrow",
        date: now - 12 * day
      }
    ];

    const reviews = [
      {
        id: "rev_1",
        printerId: "p79001112233",
        customerId: "c79990001122",
        customerName: "Сергей",
        district: "Норильск (центр)",
        service: "fdm",
        serviceName: "3D-печать FDM (PETG)",
        orderId: "o1",
        orderTitle: "Кронштейн для камеры на снегоход",
        score: 5,
        accuracyScore: 5,
        speedScore: 5,
        commScore: 5,
        comment: "Напечатал кронштейн для снегохода точно по модели. Зазоры под болты М6 6.4 мм сели как влитые, прочность потрясающая, на морозе пластик не трескается.",
        date: now - 2 * day,
        verifiedEscrow: true
      },
      {
        id: "rev_2",
        printerId: "p79001112233",
        customerId: "c79991112233",
        customerName: "Ольга",
        district: "Талнах",
        service: "scan",
        serviceName: "3D-сканирование и реверс",
        orderId: "o_scan1",
        orderTitle: "Шестерня привода снегохода Буран",
        score: 5,
        accuracyScore: 5,
        speedScore: 5,
        commScore: 5,
        comment: "Сломало зубья на шестерне Бурана. Алексей отсканировал деталь за пару часов, во Fusion 360 восстановил шаг и профиль зуба и выдал готовые детали! Огромное спасибо, спасли сезон охоты!",
        date: now - 5 * day,
        verifiedEscrow: true
      },
      {
        id: "rev_3",
        printerId: "p79001112233",
        customerId: "c79992223344",
        customerName: "Максим",
        district: "Кайеркан",
        service: "modeling",
        serviceName: "3D-моделирование и CAD",
        orderTitle: "Кронштейны экспедиционных фар",
        score: 5,
        accuracyScore: 5,
        speedScore: 5,
        commScore: 5,
        comment: "Быстро исправил ошибки в STL-файле крепления фар и подобрал правильное заполнение 45% для экспедиционника. Очень грамотный специалист.",
        date: now - 8 * day,
        verifiedEscrow: true
      },
      {
        id: "rev_4",
        printerId: "p79001112233",
        customerId: "c79995556677",
        customerName: "Дмитрий",
        district: "Норильск",
        service: "sla",
        serviceName: "Фотополимерная печать SLA",
        orderTitle: "Микрошестерни приборной панели",
        score: 5,
        accuracyScore: 5,
        speedScore: 4,
        commScore: 5,
        comment: "Печатали мелкие шестерёнки для приборной панели. Качество как с завода, слоёв вообще не видно, гладкая смола.",
        date: now - 14 * day,
        verifiedEscrow: true
      },
      {
        id: "rev_5",
        printerId: "p79001112233",
        customerId: "c79994443322",
        customerName: "Владимир",
        district: "Талнах",
        service: "fdm",
        serviceName: "3D-печать FDM (Nylon)",
        orderTitle: "Втулка подвески снегохода",
        score: 4,
        accuracyScore: 5,
        speedScore: 4,
        commScore: 5,
        comment: "Деталь сделана качественно, из прочного нейлона. Была небольшая задержка на полдня из-за калибровки стола, но мастер оперативно предупредил в чате.",
        date: now - 20 * day,
        verifiedEscrow: true
      }
    ];

    save(K.wallets, wallets);
    save(K.transactions, transactions);
        const portfolio = seedPortfolio();
    save(K.portfolio, portfolio);
    save(K.reviews, reviews);
    localStorage.setItem(K.ver, DB_VERSION);
  }

  if (localStorage.getItem(K.ver) !== DB_VERSION) DB.reset();

  // ---------- Чат и диалоги ----------
  const Chat = {
    getThread(customerId, printerId, orderId) {
      const key = `${customerId}__${printerId}__${orderId || "direct"}`;
      const chats = DB.chats();
      if (!chats[key]) {
        const cust = DB.order(orderId)?.customerName || "Заказчик";
        chats[key] = { orderId: orderId || null, customerId, customerName: cust, printerId, messages: [] };
        DB.saveChats(chats);
      }
      return { key, thread: chats[key] };
    },
    sendMessage(customerId, printerId, orderId, text, image = null) {
      const user = DB.user();
      const cleanText = (text || "").trim();
      if (!user || (!cleanText && !image)) return;
      const { key, thread } = Chat.getThread(customerId, printerId, orderId);
      const newMsg = {
        id: "m_" + uid(),
        from: user.id,
        text: cleanText,
        image: image || null,
        t: Date.now()
      };
      thread.messages.push(newMsg);
      const chats = DB.chats();
      chats[key] = thread;
      DB.saveChats(chats);
      apiSync.push(`chats/${encodeURIComponent(key)}`, newMsg);
      return newMsg;
    },
    getAllUserThreads(userId) {
      const chats = DB.chats();
      const list = [];
      for (const [key, raw] of Object.entries(chats)) {
        if (!raw) continue;
        const parts = key.split("__");
        const customerId = raw.customerId || parts[0];
        const printerId = raw.printerId || parts[1];
        const orderId = raw.orderId || (parts[2] !== "direct" ? parts[2] : null);
        const messages = Array.isArray(raw) ? raw : (Array.isArray(raw.messages) ? raw.messages : []);

        if (customerId === userId || printerId === userId) {
          const order = orderId ? DB.order(orderId) : null;
          const customerName = raw.customerName || (order ? order.customerName : "Заказчик");
          const customerAvatar = raw.customerAvatar || (order ? order.customerAvatar : null);
          list.push({
            key,
            ...(typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
            customerId,
            printerId,
            orderId,
            customerName,
            customerAvatar,
            messages
          });
        }
      }
      list.sort((a, b) => {
        const la = (a.messages && a.messages[a.messages.length - 1]?.t) || 0;
        const lb = (b.messages && b.messages[b.messages.length - 1]?.t) || 0;
        return lb - la;
      });
      return list;
    },
    getReadMap(userId) {
      if (!userId) return {};
      try {
        return JSON.parse(localStorage.getItem(`n3d_read_${userId}`) || "{}");
      } catch {
        return {};
      }
    },
    markThreadRead(threadKey, userId) {
      if (!threadKey || !userId) return;
      try {
        const map = Chat.getReadMap(userId);
        map[threadKey] = Date.now();
        localStorage.setItem(`n3d_read_${userId}`, JSON.stringify(map));
        window.dispatchEvent(new CustomEvent("n3d:chat-updated"));
      } catch {}
    },
    getUnreadCount(userId) {
      if (!userId) return 0;
      const threads = Chat.getAllUserThreads(userId);
      const map = Chat.getReadMap(userId);
      let count = 0;
      for (const th of threads) {
        const lastRead = map[th.key] || 0;
        const msgs = th.messages || [];
        for (const m of msgs) {
          if (m.from !== userId && (m.t || 0) > lastRead) {
            count++;
          }
        }
      }
      return count;
    },
    getThreadUnreadCount(threadKey, userId) {
      if (!threadKey || !userId) return 0;
      const chats = DB.chats();
      const raw = chats[threadKey];
      if (!raw) return 0;
      const msgs = Array.isArray(raw) ? raw : (raw.messages || []);
      const map = Chat.getReadMap(userId);
      const lastRead = map[threadKey] || 0;
      let count = 0;
      for (const m of msgs) {
        if (m.from !== userId && (m.t || 0) > lastRead) {
          count++;
        }
      }
      return count;
    },
    openModal(customerId, printerId, orderId) {
      location.href = `cabinet.html?customer=${encodeURIComponent(customerId)}&printer=${encodeURIComponent(printerId)}${orderId ? `&order=${encodeURIComponent(orderId)}` : ""}`;
    },
    deleteThread(threadKey, userId) {
      if (!threadKey) return false;
      const res = DB.deleteChat(threadKey);
      if (userId) {
        try {
          const map = Chat.getReadMap(userId);
          delete map[threadKey];
          localStorage.setItem(`n3d_read_${userId}`, JSON.stringify(map));
        } catch {}
      }
      window.dispatchEvent(new CustomEvent("n3d:chat-updated"));
      return res;
    }
  };

  // ---------- Утилиты ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => Math.round(n).toLocaleString("ru-RU") + " ₽";
  const date = (d) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 60) return `${Math.max(1, m)} мин назад`;
    if (m < 1440) return `${Math.round(m / 60)} ч назад`;
    return `${Math.round(m / 1440)} дн назад`;
  };
  const digits = (s) => String(s).replace(/\D/g, "").replace(/^8/, "7");
  const initials = (n) => (n || "П").replace(/[«»"]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "N3";
  const hue = (s) => [...(s || "nord")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  const PRESET_AVATARS = [
    { id: "fox", name: "Полярный Лис", icon: "🦊", bg: "linear-gradient(135deg, #f97316, #ea580c)" },
    { id: "bear", name: "Белый Медведь", icon: "🐻‍❄️", bg: "linear-gradient(135deg, #0284c7, #0369a1)" },
    { id: "printer", name: "3D-принтер Про", icon: "🖨️", bg: "linear-gradient(135deg, #0ea5e9, #0284c7)" },
    { id: "scanner", name: "3D-сканировщик", icon: "🔬", bg: "linear-gradient(135deg, #8b5cf6, #6d28d9)" },
    { id: "polar", name: "Северный Мейкер", icon: "❄️", bg: "linear-gradient(135deg, #06b6d4, #0891b2)" },
    { id: "engineer", name: "Кибер-инженер", icon: "⚡", bg: "linear-gradient(135deg, #f59e0b, #d97706)" },
    { id: "robot", name: "Робототехник", icon: "🤖", bg: "linear-gradient(135deg, #6366f1, #4f46e5)" },
    { id: "designer", name: "3D-дизайнер", icon: "🎨", bg: "linear-gradient(135deg, #ec4899, #db2777)" },
    { id: "mechanic", name: "Механик", icon: "⚙️", bg: "linear-gradient(135deg, #64748b, #475569)" },
    { id: "owl", name: "Полярная Сова", icon: "🦉", bg: "linear-gradient(135deg, #10b981, #059669)" },
    { id: "rocket", name: "Новатор", icon: "🚀", bg: "linear-gradient(135deg, #ef4444, #dc2626)" },
    { id: "crystal", name: "SLA Смола", icon: "💎", bg: "linear-gradient(135deg, #14b8a6, #0d9488)" }
  ];

  const avatar = (p, size = 52) => {
    if (!p) return `<div class="avatar" style="--h:200;width:${size}px;height:${size}px">?</div>`;
    const name = p.name || "Пользователь";
    const av = p.avatar;
    if (av) {
      if (av.startsWith("data:image/") || av.startsWith("http") || av.startsWith("/") || av.startsWith("img/")) {
        return `<img src="${esc(av)}" class="avatar avatar--img" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="${esc(name)}" />`;
      }
      if (av.startsWith("preset:")) {
        const pKey = av.replace("preset:", "");
        const found = PRESET_AVATARS.find((x) => x.id === pKey);
        if (found) {
          return `<div class="avatar avatar--preset" style="background:${found.bg};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.52)}px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0" title="${esc(found.name)}">${found.icon}</div>`;
        }
      }
      if (av.startsWith("emoji:")) {
        const em = av.replace("emoji:", "");
        return `<div class="avatar avatar--emoji" style="--h:${hue(name)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.52)}px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0" title="${esc(name)}">${esc(em)}</div>`;
      }
    }
    return `<div class="avatar" style="--h:${hue(name)};width:${size}px;height:${size}px">${esc(initials(name))}</div>`;
  };
  const stars = (r) => `<span class="stars">★ ${r ? r.toFixed(1) : "новый"}</span>`;
  const statusBadge = (s) => `<span class="status ${STATUS[s]?.cls || ""}">${STATUS[s]?.label || s}</span>`;
  const qs = (k) => new URLSearchParams(location.search).get(k);

  function estimate(volumeMm3, material, infill = 20, qty = 1) {
    if (!volumeMm3) return null;
    const mat = MATERIALS[material] || MATERIALS.PLA;
    const fillRatio = mat.fdm ? (0.25 + 0.75 * (infill / 100)) : 1;
    const grams = (volumeMm3 / 1000) * mat.density * fillRatio;
    const total = Math.max(500, grams * mat.price * qty);
    return { grams, total: Math.ceil(total / 10) * 10 };
  }

  // ---------- Модалки ----------
  let modalRoot = null;
  const modalStack = [];
  let lastModalHtml = "";
  let lastModalTime = 0;
  function openModal(html, cls = "") {
    const now = Date.now();
    if (modalRoot && html === lastModalHtml && (now - lastModalTime < 400)) {
      return modalRoot.querySelector(".modal__box");
    }
    lastModalHtml = html;
    lastModalTime = now;
    if (modalRoot) {
      modalRoot.style.display = "none";
      modalStack.push(modalRoot);
      modalRoot = null;
    }
    modalRoot = document.createElement("div");
    modalRoot.className = "modal";
    modalRoot.innerHTML = `<div class="modal__box ${cls}"><button class="modal__close" aria-label="Закрыть">×</button>${html}</div>`;
    modalRoot.addEventListener("mousedown", (e) => { if (e.target === modalRoot) closeModal(); });
    modalRoot.querySelector(".modal__close").onclick = closeModal;
    document.body.appendChild(modalRoot);
    document.body.style.overflow = "hidden";
    return modalRoot.querySelector(".modal__box");
  }
  function closeModal() {
    if (modalRoot) {
      modalRoot.remove();
      modalRoot = null;
    }
    if (modalStack.length > 0) {
      modalRoot = modalStack.pop();
      modalRoot.style.display = "";
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeModal());

  function toast(text) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3000);
  }

  // Сжатие и подготовка фото для отправки в чат
  function compressImage(file, maxDimension = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        return reject(new Error("Файл не является изображением"));
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("Ошибка загрузки изображения"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsDataURL(file);
    });
  }

  // Просмотр полноразмерного фото из чата
  function openPhotoModal(src) {
    openModal(`
      <div style="display:flex;flex-direction:column;align-items:center;padding:10px 0;gap:14px">
        <img src="${src}" style="max-width:100%;max-height:76vh;border-radius:12px;object-fit:contain;box-shadow:var(--shadow-lg)" alt="Фото детали" />
        <a href="${src}" download="3d_print_photo.jpg" class="btn btn--small btn--primary">⬇ Скачать фото</a>
      </div>
    `, "modal__box--wide");
  }

  // Обрезка по центру и сжатие квадратного аватара
  function cropAndCompressAvatar(file, size = 256, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        return reject(new Error("Файл не является изображением"));
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("Ошибка загрузки изображения"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsDataURL(file);
    });
  }

  // Модальное окно выбора / загрузки аватара
  function openAvatarPickerModal(currentAvatar, onSave) {
    let selectedAvatar = currentAvatar || null;
    const user = DB.user() || { name: "Пользователь" };

    function getPreviewHtml(av) {
      return avatar({ name: user.name, avatar: av }, 84);
    }

    const modal = openModal(`
      <div style="max-width:520px;margin:0 auto">
        <div style="text-align:center;margin-bottom:20px">
          <div id="modalAvatarPreview" style="display:inline-block;position:relative;margin-bottom:10px">
            ${getPreviewHtml(selectedAvatar)}
          </div>
          <h3 style="font-size:20px;margin-bottom:4px">Редактирование аватара</h3>
          <p class="muted" style="font-size:13.5px">Выберите готовый маскот или загрузите своё фото с ПК или смартфона</p>
        </div>

        <!-- Раздел 1: Загрузка с устройства -->
        <div class="form-card-block" style="margin-bottom:16px;text-align:center">
          <input type="file" id="avatarFileInput" accept="image/*" style="display:none" />
          <label for="avatarFileInput" class="btn btn--primary btn--wide" style="height:46px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer">
            📷 Загрузить фото с ПК или смартфона
          </label>
          <small class="field-hint" style="margin-top:6px;display:block">
            Поддерживаются JPG, PNG, WebP. Фото автоматически кадрируется и оптимизируется.
          </small>
        </div>

        <!-- Раздел 2: Готовые варианты (маскоты) -->
        <div class="form-card-block" style="margin-bottom:16px">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:10px">
            Готовые маскоты и темы NORD 3D:
          </label>
          <div class="avatar-preset-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px">
            ${PRESET_AVATARS.map((p) => {
              const isSel = selectedAvatar === "preset:" + p.id;
              return `
                <div class="avatar-preset-tile ${isSel ? "active" : ""}" data-preset="preset:${p.id}" style="cursor:pointer;background:var(--bg-subtle);border:2px solid ${isSel ? "var(--accent)" : "var(--border)"};border-radius:14px;padding:10px 6px;text-align:center;transition:all .15s ease">
                  <div style="width:42px;height:42px;border-radius:50%;background:${p.bg};display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 6px;box-shadow:0 2px 4px rgba(0,0,0,0.1)">
                    ${p.icon}
                  </div>
                  <div style="font-size:11.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Кнопка сброса к инициалам -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding:0 4px">
          <button type="button" class="link" id="btnResetToInitials" style="font-size:13px;color:var(--text-muted)">
            ↺ Сбросить к инициалам по имени
          </button>
          <small id="avatarStatusLabel" style="font-size:12px;font-weight:600;color:var(--accent)"></small>
        </div>

        <!-- Кнопки действий -->
        <div style="display:flex;gap:10px">
          <button type="button" class="btn btn--primary" id="btnApplyAvatar" style="flex:1;height:46px;font-weight:700">
            💾 Сохранить аватар
          </button>
          <button type="button" class="btn btn--ghost" id="btnCancelAvatar" style="height:46px;padding:0 20px">
            Отмена
          </button>
        </div>
      </div>
    `, "modal__box");

    const updatePreview = () => {
      const pbox = modal.querySelector("#modalAvatarPreview");
      if (pbox) pbox.innerHTML = getPreviewHtml(selectedAvatar);

      modal.querySelectorAll(".avatar-preset-tile").forEach((tile) => {
        const isSel = tile.dataset.preset === selectedAvatar;
        tile.classList.toggle("active", isSel);
        tile.style.borderColor = isSel ? "var(--accent)" : "var(--border)";
      });
    };

    // Загрузка фото с устройства
    const fileInp = modal.querySelector("#avatarFileInput");
    fileInp?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await cropAndCompressAvatar(file, 256, 0.85);
        selectedAvatar = dataUrl;
        updatePreview();
        toast("Фото загружено и оптимизировано!");
      } catch (err) {
        alert("Не удалось загрузить изображение: " + err.message);
      }
    });

    // Выбор готового пресета
    modal.querySelectorAll(".avatar-preset-tile").forEach((tile) => {
      tile.onclick = () => {
        selectedAvatar = tile.dataset.preset;
        updatePreview();
      };
    });

    // Сброс к инициалам
    modal.querySelector("#btnResetToInitials")?.addEventListener("click", () => {
      selectedAvatar = null;
      updatePreview();
    });

    // Сохранение
    modal.querySelector("#btnApplyAvatar")?.addEventListener("click", () => {
      const u = DB.user();
      if (u) {
        u.avatar = selectedAvatar;
        DB.setUser(u);
        if (u.role === "printer") {
          DB.updatePrinter(u.id, (p) => { p.avatar = selectedAvatar; });
        }
        window.dispatchEvent(new CustomEvent("n3d:data-updated"));
      }
      closeModal();
      if (typeof onSave === "function") {
        onSave(selectedAvatar);
      }
      toast("Аватар успешно сохранён!");
    });

    modal.querySelector("#btnCancelAvatar")?.addEventListener("click", closeModal);
  }

  // ---------- МОДАЛЬНОЕ ОКНО НАСТРОЕК ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ / МАСТЕРА ----------
  function openProfileSettingsModal(onDone) {
    const user = DB.user();
    if (!user) {
      loginModal("customer", () => openProfileSettingsModal(onDone));
      return;
    }
    const isP = user.role === "printer";
    const printer = isP ? DB.printer(user.id) : null;
    let selectedAvatar = user.avatar || null;

    const modalBox = openModal(`
      <div class="profile-settings-modal" style="max-width:760px;margin:0 auto">
        <div style="margin-bottom:20px;padding-right:48px">
          <h2 style="font-size:22px;font-weight:800;margin-bottom:4px">
            ⚙️ ${isP ? "Настройки профиля мастера 3D-печати" : "Настройки профиля заказчика"}
          </h2>
          <p class="muted" style="font-size:13px;line-height:1.5">
            ${isP ? "Настройте публичный профиль мастера: оборудование, материалы, цены и контакты. Изменения сразу видны в каталоге исполнителей." : "Укажите ваши контактные данные и район для удобной связи с мастерами 3D-печати."}
          </p>
        </div>

        <form class="form" id="globalProfileSettingsForm">
          <!-- 1. Контакты и аватар -->
          <div class="form-card-block">
            <div class="form-block-head">
              <span class="badge-num">1</span>
              <div>
                <h4>Основная информация и аватар</h4>
                <small>Данные для связи и отображения в системе</small>
              </div>
            </div>

            <!-- Аватар -->
            <div style="display:flex;align-items:center;gap:18px;padding:16px;background:var(--bg-subtle);border-radius:14px;border:1px solid var(--border);margin-bottom:18px">
              <div class="avatar-editable" id="profModalAvatarTrigger" title="Нажмите, чтобы изменить аватар" style="cursor:pointer">
                <div id="profModalAvatarPreview">${avatar({ name: user.name, avatar: selectedAvatar }, 64)}</div>
                <span class="avatar-editable__badge" style="width:28px;height:28px;font-size:13px">📷</span>
              </div>
              <div style="flex:1">
                <b style="font-size:15px;display:block;margin-bottom:2px">Аватар профиля</b>
                <small style="color:var(--text-muted);display:block;margin-bottom:10px">Отображается в шапке, чатах, откликах на заказы и в каталоге</small>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <button type="button" class="btn btn--primary btn--small" id="profModalBtnChangeAvatar">
                    📷 Выбрать фото или маскот
                  </button>
                  <button type="button" class="btn btn--ghost btn--small" id="profModalBtnResetAvatar" style="${selectedAvatar ? '' : 'display:none'}">
                    Сбросить к инициалам
                  </button>
                </div>
              </div>
            </div>

            <div class="form-grid">
              <div class="field">
                <label>Имя или название мастерской <span class="req">*</span></label>
                <div class="input-with-icon">
                  <span class="input-icon">👤</span>
                  <input name="name" type="text" value="${esc(user.name)}" required />
                </div>
              </div>
              <div class="field">
                <label>Телефон для связи <span class="req">*</span></label>
                <div class="input-with-icon">
                  <span class="input-icon">📱</span>
                  <input name="phone" type="tel" value="${esc(user.phone)}" required />
                </div>
              </div>
              <div class="field">
                <label>Город / Район базы <span class="req">*</span></label>
                <div class="input-with-icon">
                  <span class="input-icon">📍</span>
                  <select name="district">
                    ${DISTRICTS.map((d) => `<option ${printer?.district === d || user?.district === d ? "selected" : ""}>${d}</option>`).join("")}
                  </select>
                </div>
              </div>
              <div class="field">
                <label>Telegram для связи</label>
                <div class="input-with-icon">
                  <span class="input-icon">✈️</span>
                  <input name="telegram" type="text" value="${esc(printer?.telegram || user?.telegram || "")}" placeholder="@username" />
                </div>
              </div>
            </div>
          </div>

          ${isP ? `
            <!-- 2. Технологии и парк оборудования -->
            <div class="form-card-block">
              <div class="form-block-head">
                <span class="badge-num">2</span>
                <div>
                  <h4>Технологии и оборудование</h4>
                  <small>Методы производства и техника в Норильске</small>
                </div>
              </div>

              <!-- Направления -->
              <div class="form-subgroup">
                <label class="form-subgroup-title">Направления работы мастерской</label>
                <div class="tile-grid">
                  <label class="tile-card">
                    <input type="checkbox" name="tech" value="fdm" ${(printer?.tech || ["fdm"]).includes("fdm") ? "checked" : ""} />
                    <div class="tile-card__inner">
                      <div class="tile-card__icon">🧵</div>
                      <div class="tile-card__content">
                        <b>FDM / FFF печать</b>
                        <small>Послойный филамент</small>
                      </div>
                      <span class="tile-card__check">✓</span>
                    </div>
                  </label>
                  <label class="tile-card">
                    <input type="checkbox" name="tech" value="sla" ${(printer?.tech || []).includes("sla") ? "checked" : ""} />
                    <div class="tile-card__inner">
                      <div class="tile-card__icon">💧</div>
                      <div class="tile-card__content">
                        <b>SLA / MSLA печать</b>
                        <small>Фотополимерная смола</small>
                      </div>
                      <span class="tile-card__check">✓</span>
                    </div>
                  </label>
                  <label class="tile-card">
                    <input type="checkbox" name="tech" value="scan" ${(printer?.tech || []).includes("scan") || !!printer?.scannerEquipment ? "checked" : ""} />
                    <div class="tile-card__inner">
                      <div class="tile-card__icon">🔬</div>
                      <div class="tile-card__content">
                        <b>3D-сканирование</b>
                        <small>Оцифровка деталей</small>
                      </div>
                      <span class="tile-card__check">✓</span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Принтеры -->
              <div class="form-subgroup">
                <div class="form-subgroup-header">
                  <span class="form-subgroup-badge">🖨️</span>
                  <div>
                    <b>Оборудование для 3D-печати</b>
                    <small>Модели принтеров и рабочая зона</small>
                  </div>
                </div>
                <div class="form-grid">
                  <div class="field">
                    <label>Модели 3D-принтеров <span class="req">*</span></label>
                    <div class="input-with-icon">
                      <span class="input-icon">🖨️</span>
                      <input name="equipment" type="text" value="${esc(printer?.equipment || "")}" placeholder="Bambu Lab P1S, Creality K1, Voron..." required />
                    </div>
                  </div>
                  <div class="field">
                    <label>Область печати (Д × Ш × В)</label>
                    <div class="input-with-icon">
                      <span class="input-icon">📐</span>
                      <input name="buildArea" type="text" value="${esc(printer?.buildArea || "256 × 256 × 256 мм")}" placeholder="256 × 256 × 256 мм" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Сканеры -->
              <div class="form-subgroup">
                <div class="form-subgroup-header">
                  <span class="form-subgroup-badge" style="background:rgba(2,132,199,0.12);color:#0284c7;border-color:rgba(56,189,248,0.4)">🔬</span>
                  <div>
                    <b>Оборудование для 3D-сканирования</b>
                    <small>Сканеры для оцифровки физических объектов</small>
                  </div>
                </div>
                <div class="form-grid">
                  <div class="field">
                    <label>Модели 3D-сканеров</label>
                    <div class="input-with-icon">
                      <span class="input-icon">🔬</span>
                      <input name="scannerEquipment" type="text" value="${esc(printer?.scannerEquipment || "")}" placeholder="Revopoint POP 3, Creality Ferret..." />
                    </div>
                  </div>
                  <div class="field">
                    <label>Точность оцифровки</label>
                    <div class="input-with-icon">
                      <span class="input-icon">🎯</span>
                      <input name="scannerAccuracy" type="text" value="${esc(printer?.scannerAccuracy || "")}" placeholder="до 0.05 мм" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Материалы и цены -->
            <div class="form-card-block">
              <div class="form-block-head">
                <span class="badge-num">3</span>
                <div>
                  <h4>Материалы и индивидуальный прайс-лист</h4>
                  <small>Отметьте материалы и установите ставку за грамм / см³</small>
                </div>
              </div>
              <div class="form-grid">
                <div class="col-full">
                  <label style="font-size:13px;font-weight:700;display:block;margin-bottom:8px">Цены за печать по материалам</label>
                  <div class="mat-price-list">
                    ${MAT_KEYS.map((k) => {
                      const m = MATERIALS[k];
                      const isChecked = (printer?.materials || ["PLA", "PETG"]).includes(k);
                      const currentPrice = printer?.materialPrices?.[k] || (isChecked ? (printer?.pricePerGram || m.price) : m.price);
                      const unit = m.unit || "₽ / г";
                      return `
                        <div class="mat-price-item ${isChecked ? "" : "disabled"}" id="profModalMatRow_${k}">
                          <label class="mat-price-info" for="prof_cb_mat_${k}">
                            <input type="checkbox" id="prof_cb_mat_${k}" class="mat-price-checkbox" name="mat" value="${k}" ${isChecked ? "checked" : ""} />
                            <div class="mat-price-meta">
                              <b><i class="mat-dot" style="background:${m.color}"></i> ${k} <span style="font-weight:600;color:var(--text-muted)">(${m.name})</span></b>
                              <small>${m.info}</small>
                            </div>
                          </label>
                          <div class="mat-price-input-wrap">
                            <div class="input-with-icon has-suffix">
                              <span class="input-icon">💰</span>
                              <input name="price_${k}" type="number" min="1" max="500" value="${currentPrice}" ${isChecked ? "" : "disabled"} />
                              <span class="input-suffix">${unit}</span>
                            </div>
                          </div>
                        </div>
                      `;
                    }).join("")}
                  </div>

                  <div style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--border);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                      <label style="font-size:13px;font-weight:700">⭐ Инженерные и спец. материалы</label>
                      <small style="font-size:11px;color:var(--text-muted)">опционально</small>
                    </div>
                    <div class="mat-price-list">
                      ${SPEC_MAT_KEYS.map((k) => {
                        const m = SPEC_MATERIALS[k];
                        const isChecked = (printer?.specMaterials || []).includes(k);
                        const currentPrice = printer?.materialPrices?.[k] || m.price;
                        const unit = m.unit || "₽ / г";
                        return `
                          <div class="mat-price-item ${isChecked ? "" : "disabled"}" id="profModalMatRow_${k}">
                            <label class="mat-price-info" for="prof_cb_mat_${k}">
                              <input type="checkbox" id="prof_cb_mat_${k}" class="mat-price-checkbox" name="mat" value="${k}" ${isChecked ? "checked" : ""} />
                              <div class="mat-price-meta">
                                <b><i class="mat-dot" style="background:${m.color}"></i> ${k} <span style="font-weight:600;color:var(--text-muted)">(${m.name})</span></b>
                                <small>${m.info}</small>
                              </div>
                            </label>
                            <div class="mat-price-input-wrap">
                              <div class="input-with-icon has-suffix">
                                <span class="input-icon">💰</span>
                                <input name="price_${k}" type="number" min="1" max="1000" value="${currentPrice}" ${isChecked ? "" : "disabled"} />
                                <span class="input-suffix">${unit}</span>
                              </div>
                            </div>
                          </div>
                        `;
                      }).join("")}
                      <div class="mat-price-item ${printer?.customMatName ? "" : "disabled"}" id="profModalMatRow_CUSTOM">
                        <label class="mat-price-info" for="prof_cb_mat_CUSTOM">
                          <input type="checkbox" id="prof_cb_mat_CUSTOM" class="mat-price-checkbox" name="mat" value="CUSTOM" ${printer?.customMatName ? "checked" : ""} />
                          <div class="mat-price-meta" style="flex:1">
                            <b><i class="mat-dot" style="background:#f59e0b"></i> Свой спецматериал <span style="font-weight:600;color:var(--text-muted)">(PEEK, Ultem, Wood...)</span></b>
                            <input name="customMatName" type="text" placeholder="Название (напр. PEEK, Wood)" value="${esc(printer?.customMatName || "")}" style="height:36px !important;font-size:12px;margin-top:4px;padding:0 12px !important;" ${printer?.customMatName ? "" : "disabled"} />
                          </div>
                        </label>
                        <div class="mat-price-input-wrap">
                          <div class="input-with-icon has-suffix">
                            <span class="input-icon">💰</span>
                            <input name="price_CUSTOM" type="number" min="1" max="2000" value="${printer?.customMatPrice || 40}" ${printer?.customMatName ? "" : "disabled"} />
                            <span class="input-suffix">₽ / г</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="col-full field" style="margin-top:6px">
                  <label>Минимальная сумма заказа</label>
                  <div class="input-with-icon has-suffix">
                    <span class="input-icon">📦</span>
                    <input name="minOrder" type="number" min="100" max="10000" value="${printer?.minOrder || 400}" />
                    <span class="input-suffix">₽</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. Опции и описание -->
            <div class="form-card-block">
              <div class="form-block-head">
                <span class="badge-num">4</span>
                <div>
                  <h4>Услуги и описание мастерской</h4>
                  <small>Дополнительные опции и опыт</small>
                </div>
              </div>
              <div class="form-grid">
                <div class="col-full">
                  <label style="font-size:13px;font-weight:700;display:block;margin-bottom:8px">Дополнительные опции</label>
                  <div class="service-pills">
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="scanning" ${(printer?.services || []).includes("scanning") ? "checked" : ""} />
                      <span>🔬 3D-сканирование деталей</span>
                    </label>
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="modeling" ${(printer?.services || ["modeling"]).includes("modeling") ? "checked" : ""} />
                      <span>✏️ 3D-моделирование деталей</span>
                    </label>
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="postprocess" ${(printer?.services || []).includes("postprocess") ? "checked" : ""} />
                      <span>🎨 Постобработка / покраска</span>
                    </label>
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="urgent" ${(printer?.services || ["urgent"]).includes("urgent") ? "checked" : ""} />
                      <span>⚡ Срочная печать 24ч</span>
                    </label>
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="delivery" ${(printer?.services || []).includes("delivery") ? "checked" : ""} />
                      <span>🚗 Доставка по НПР</span>
                    </label>
                  </div>
                </div>

                <div class="col-full field">
                  <label>О себе, мастерской и гарантиях</label>
                  <div class="input-with-icon input-with-icon--textarea">
                    <span class="input-icon">📝</span>
                    <textarea name="about" rows="3" placeholder="Расскажите о вашем опыте, точности калибровки и типах деталей...">${esc(printer?.about || "")}</textarea>
                  </div>
                </div>
              </div>
            </div>
          ` : ""}

          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap">
            <button class="btn btn--ghost" type="button" id="profModalCancelBtn">Отмена</button>
            <button class="btn btn--primary" type="submit" style="font-weight:800;padding:0 28px">
              💾 Сохранить изменения
            </button>
          </div>
        </form>
      </div>
    `, "modal__box--wide");

    const form = modalBox.querySelector("#globalProfileSettingsForm");
    const previewEl = modalBox.querySelector("#profModalAvatarPreview");
    const resetBtn = modalBox.querySelector("#profModalBtnResetAvatar");

    const updateProfPreview = () => {
      if (previewEl) previewEl.innerHTML = avatar({ name: form.name.value || user.name, avatar: selectedAvatar }, 64);
      if (resetBtn) resetBtn.style.display = selectedAvatar ? "inline-flex" : "none";
    };

    const triggerAvatarPicker = () => {
      openAvatarPickerModal(selectedAvatar, (newAv) => {
        selectedAvatar = newAv;
        updateProfPreview();
      });
    };

    modalBox.querySelector("#profModalAvatarTrigger")?.addEventListener("click", triggerAvatarPicker);
    modalBox.querySelector("#profModalBtnChangeAvatar")?.addEventListener("click", triggerAvatarPicker);
    resetBtn?.addEventListener("click", () => {
      selectedAvatar = null;
      updateProfPreview();
    });

    const phoneInp = form.querySelector("input[name=phone]");
    if (phoneInp) {
      phoneInp.addEventListener("input", () => {
        let d = digits(phoneInp.value);
        if (!d) return;
        if (d.startsWith("7") || d.startsWith("8")) d = d.slice(1);
        d = d.slice(0, 10);
        let res = "+7 (";
        if (d.length > 0) res += d.slice(0, 3);
        if (d.length >= 3) res += ") " + d.slice(3, 6);
        if (d.length >= 6) res += "-" + d.slice(6, 8);
        if (d.length >= 8) res += "-" + d.slice(8, 10);
        phoneInp.value = res;
      });
    }

    form.querySelectorAll(".mat-price-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        const row = cb.closest(".mat-price-item");
        const inps = row?.querySelectorAll("input:not([type=checkbox])");
        if (inps) inps.forEach((i) => i.disabled = !cb.checked);
        row?.classList.toggle("disabled", !cb.checked);
      });
    });

    modalBox.querySelector("#profModalCancelBtn")?.addEventListener("click", closeModal);

    form.onsubmit = (e) => {
      e.preventDefault();
      user.name = form.name.value.trim();
      user.phone = form.phone.value.trim();
      user.district = form.district.value;
      user.telegram = form.telegram?.value.trim() || "";
      user.avatar = selectedAvatar;
      DB.setUser(user);

      if (isP) {
        const mats = [...form.querySelectorAll("[name=mat]:checked")].map((x) => x.value);
        const techs = [...form.querySelectorAll("[name=tech]:checked")].map((x) => x.value);
        const srvs = [...form.querySelectorAll("[name=srv]:checked")].map((x) => x.value);
        const materialPrices = {};
        mats.forEach((m) => {
          if (m === "CUSTOM") return;
          const inp = form.querySelector(`[name="price_${m}"]`);
          const def = MATERIALS[m]?.price || SPEC_MATERIALS[m]?.price || 10;
          materialPrices[m] = inp ? (+inp.value || def) : def;
        });
        const hasCustom = mats.includes("CUSTOM");
        const customMatName = hasCustom && form.customMatName ? form.customMatName.value.trim() : "";
        const customMatPrice = hasCustom && form.price_CUSTOM ? (+form.price_CUSTOM.value || 40) : 0;

        DB.updatePrinter(user.id, (p) => {
          p.name = user.name;
          p.phone = user.phone;
          p.district = user.district;
          p.telegram = user.telegram;
          p.avatar = user.avatar;
          p.materials = mats.filter((m) => MAT_KEYS.includes(m));
          p.specMaterials = mats.filter((m) => SPEC_MAT_KEYS.includes(m));
          p.customMatName = customMatName;
          p.customMatPrice = customMatPrice;
          p.materialPrices = materialPrices;
          p.tech = techs;
          p.services = srvs;
          p.equipment = form.equipment?.value.trim() || p.equipment;
          p.buildArea = form.buildArea?.value.trim() || p.buildArea;
          p.scannerEquipment = form.scannerEquipment?.value.trim() || "";
          p.scannerAccuracy = form.scannerAccuracy?.value.trim() || "";
          p.minOrder = +form.minOrder?.value || p.minOrder || 400;
          p.about = form.about?.value.trim() || "";
        });
      }

      toast("Настройки профиля успешно сохранены!");
      closeModal();
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));

      const chip = document.querySelector("#headerUserChip");
      if (chip) {
        chip.innerHTML = `
          ${avatar(user, 32)}
          <span><b>${esc(user.name)}</b><small>${user.role === "printer" ? "мастер" : "заказчик"}</small></span>
        `;
      }

      if (typeof onDone === "function") {
        onDone(user);
      }
    };
  }

  // ---------- РАЗДЕЛЬНЫЕ ФОРМЫ РЕГИСТРАЦИИ ----------
  function loginModal(initialRole = "customer", onDone, titleHint = null) {
    let currentRole = initialRole;

    const hintHtml = titleHint ? `<div class="auth-hint-banner" style="background:rgba(0,242,254,0.1);border:1px solid rgba(0,242,254,0.3);border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13.5px;color:var(--text);display:flex;align-items:center;gap:10px"><span style="font-size:18px">🔐</span><span>${esc(titleHint)}</span></div>` : "";
    const box = openModal(`
      <div class="auth-box">
        ${hintHtml}
        <div class="auth-tabs">
          <button class="auth-tab-btn ${currentRole === "customer" ? "active" : ""}" id="tabBtnCustomer">
            🧑 Я Заказчик
          </button>
          <button class="auth-tab-btn ${currentRole === "printer" ? "active" : ""}" id="tabBtnPrinter">
            🖨️ Я Исполнитель (Мастер 3D-печати)
          </button>
        </div>

        <div id="authFormContainer"></div>

        <div class="auth-quick-demo">
          <span>Быстрый демо-вход:</span>
          <button class="link" data-demo="c">Заказчик Сергей</button>
          <button class="link" data-demo="p">Мастер Алексей К.</button>
          <button class="link" data-demo="d">Мастер Дарья (SLA)</button>
          <button class="link" data-demo="a" style="color:var(--accent);font-weight:800">⚡ Администратор</button>
        </div>
      </div>
    `, "modal__box--wide");

    const container = box.querySelector("#authFormContainer");

    const socialLoginHtml = `
      <div class="social-login-block">
        <div class="social-login-title"><span>Быстрый вход через соцсети</span></div>
        <div class="social-login-btns">
          <button type="button" class="btn-social btn-social--vk btn-social-action" data-provider="vk">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.07 2H8.93C4.33 2 2 4.33 2 8.93v6.14C2 19.67 4.33 22 8.93 22h6.14c4.6 0 6.93-2.33 6.93-6.93V8.93C22 4.33 19.67 2 15.07 2zm3.38 13.91c-.48.6-1.57 1.4-2.17 1.4-.4 0-.58-.23-.97-.66-.46-.51-.83-.98-1.29-.98-.44 0-.6.28-.79.8-.18.52-.45.64-1.07.64-1.84 0-3.82-1.3-5.24-3.34-2.15-3.08-2.73-5.41-2.73-5.88 0-.25.1-.48.38-.48h1.74c.4 0 .54.18.69.58.74 2.15 1.99 4.04 2.5 4.04.19 0 .28-.09.28-.58V10.1c-.06-1.04-.6-1.13-.6-1.5 0-.17.15-.35.39-.35h2.73c.34 0 .46.18.46.59v3.2c0 .35.15.47.25.47.2 0 .37-.12.75-.5 1.15-1.3 1.97-3.31 1.97-3.31.11-.23.3-.45.69-.45h1.74c.52 0 .63.26.52.62-.21.99-2.3 3.93-2.3 3.93-.18.3-.25.44 0 .77.18.25.79.77 1.2 1.25.75.88 1.33 1.62 1.49 2.13.16.51-.08.77-.66.77h-1.63z"/></svg>
            <span>Войти через VK ID</span>
          </button>
          <button type="button" class="btn-social btn-social--tg btn-social-action" data-provider="tg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
            <span>Войти через Telegram</span>
          </button>
        </div>
        <div class="social-login-or"><span>или по номеру телефона</span></div>
      </div>
    `;

    function triggerSocialLogin(provider) {
      const isPrinter = currentRole === "printer";
      const roleTitle = isPrinter ? "мастера 3D-печати" : "заказчика";
      const icon = provider === "vk" ? "🔵 VK ID" : "✈️ Telegram";
      const defaultName = provider === "vk" ? (isPrinter ? "Мастер Иван (VK)" : "Сергей Полярный (VK)") : (isPrinter ? "Мастер Alex (TG)" : "Алексей @nord_maker");
      const defaultAcc = provider === "vk" ? "id" + Math.floor(10000000 + Math.random() * 90000000) : (isPrinter ? "@alex_3d_nor" : "@nord_client");

      const socModal = openModal(`
        <div style="padding:10px 0;text-align:center">
          <h3 style="font-size:20px;margin-bottom:8px">Вход через ${icon}</h3>
          <p class="muted" style="font-size:14px;margin-bottom:20px">
            Мгновенная авторизация в NORD 3D как <b>${roleTitle}</b>
          </p>
          <div style="display:flex;flex-direction:column;gap:14px;max-width:360px;margin:0 auto;text-align:left">
            <div class="field">
              <label>Ваше имя в ${provider === "vk" ? "ВКонтакте" : "Telegram"}</label>
              <div class="input-with-icon">
                <span class="input-icon">👤</span>
                <input id="socNameInp" type="text" value="${defaultName}" required />
              </div>
            </div>
            <div class="field">
              <label>${provider === "vk" ? "VK ID или страница" : "Telegram Username"}</label>
              <div class="input-with-icon">
                <span class="input-icon">${provider === "vk" ? "🆔" : "✈️"}</span>
                <input id="socAccInp" type="text" value="${defaultAcc}" required />
              </div>
            </div>
            <div class="field">
              <label>Район Норильска</label>
              <div class="input-with-icon">
                <span class="input-icon">📍</span>
                <select id="socDistInp">
                  ${DISTRICTS.map((d) => `<option>${d}</option>`).join("")}
                </select>
              </div>
            </div>
            <button class="btn btn--primary btn--wide" id="socSubmitBtn" style="height:48px;font-weight:800;font-size:15px;margin-top:6px">
              Войти как ${isPrinter ? "мастер" : "заказчик"}
            </button>
          </div>
        </div>
      `, "modal__box");

      socModal.querySelector("#socSubmitBtn").onclick = () => {
        const name = socModal.querySelector("#socNameInp").value.trim() || defaultName;
        const acc = socModal.querySelector("#socAccInp").value.trim() || defaultAcc;
        const dist = socModal.querySelector("#socDistInp").value;
        const id = "soc_" + provider + "_" + Date.now().toString(36);
        const phone = "+7 (900) " + Math.floor(100 + Math.random() * 900) + "-" + Math.floor(10 + Math.random() * 90) + "-" + Math.floor(10 + Math.random() * 90);

        if (isPrinter) {
          const list = DB.printers();
          const p = {
            id,
            name,
            phone,
            telegram: provider === "tg" ? acc : "",
            vk: provider === "vk" ? acc : "",
            district: dist,
            tech: ["fdm"],
            equipment: "Bambu Lab P1S",
            buildArea: "256 × 256 × 256 мм",
            materials: ["PLA", "PETG"],
            specMaterials: ["NYLON"],
            materialPrices: { PLA: 10, PETG: 12, NYLON: 22 },
            pricePerGram: 10,
            minOrder: 400,
            services: ["delivery"],
            about: `Мастер 3D-печати. Авторизован через ${icon}.`,
            rating: 5.0,
            reviews: 0,
            done: 0,
            since: String(new Date().getFullYear()),
            authProvider: provider
          };
          list.push(p);
          DB.savePrinters(list);
        }

        const user = {
          id,
          name,
          phone,
          role: isPrinter ? "printer" : "customer",
          district: dist,
          authProvider: provider,
          telegram: provider === "tg" ? acc : "",
          vk: provider === "vk" ? acc : ""
        };

        DB.setUser(user);
        closeModal();
        toast(`Вы успешно вошли через ${icon} как ${name}!`);
        onDone ? onDone(user) : location.reload();
      };
    }

    function renderForm() {
      box.querySelector("#tabBtnCustomer").classList.toggle("active", currentRole === "customer");
      box.querySelector("#tabBtnPrinter").classList.toggle("active", currentRole === "printer");

      if (currentRole === "customer") {
        container.innerHTML = `
          <div class="auth-intro">
            <h3>Регистрация и вход заказчика</h3>
            <p class="muted">Размещайте заказы на печать деталей, находите мастеров Норильска и общайтесь в чате.</p>
          </div>
          ${socialLoginHtml}
          <form class="form" id="customerForm">
            <div class="form-card-block">
              <div class="form-block-head">
                <span class="badge-num">1</span>
                <div>
                  <h4>Контактные данные</h4>
                  <small>Информация для связи с исполнителями и координации заказов</small>
                </div>
              </div>
              <div class="form-grid">
                <div class="field">
                  <label>Ваше имя или организация <span class="req">*</span></label>
                  <div class="input-with-icon">
                    <span class="input-icon">👤</span>
                    <input name="name" type="text" required placeholder="Сергей, Норникель..." />
                  </div>
                </div>
                <div class="field">
                  <label>Номер телефона <span class="req">*</span></label>
                  <div class="input-with-icon">
                    <span class="input-icon">📱</span>
                    <input name="phone" type="tel" required placeholder="+7 (900) 000-00-00" />
                  </div>
                </div>
                <div class="field">
                  <label>Район Норильска</label>
                  <div class="input-with-icon">
                    <span class="input-icon">📍</span>
                    <select name="district">
                      ${DISTRICTS.map((d) => `<option>${d}</option>`).join("")}
                    </select>
                  </div>
                </div>
                <div class="field">
                  <label>Telegram (необязательно)</label>
                  <div class="input-with-icon">
                    <span class="input-icon">✈️</span>
                    <input name="telegram" type="text" placeholder="@username" />
                  </div>
                </div>
              </div>
            </div>

            <p class="form-msg err" id="authErr"></p>
            <button class="btn btn--primary btn--wide" type="submit" style="height:48px;font-size:15px;font-weight:700">
              Войти как заказчик
            </button>
          </form>
        `;

        container.querySelectorAll("input[type=tel]").forEach((inp) => {
          inp.addEventListener("input", () => {
            let d = digits(inp.value);
            if (!d) return;
            if (d.startsWith("7") || d.startsWith("8")) d = d.slice(1);
            d = d.slice(0, 10);
            let res = "+7 (";
            if (d.length > 0) res += d.slice(0, 3);
            if (d.length >= 3) res += ") " + d.slice(3, 6);
            if (d.length >= 6) res += "-" + d.slice(6, 8);
            if (d.length >= 8) res += "-" + d.slice(8, 10);
            inp.value = res;
          });
        });

        let isCustSubmitting = false;
        container.querySelector("#customerForm").onsubmit = (e) => {
          e.preventDefault();
          if (isCustSubmitting) return;
          const f = e.target;
          const name = f.name.value.trim();
          const d = digits(f.phone.value);
          const err = container.querySelector("#authErr");

          if (name.toLowerCase() === "admin" || f.phone.value.includes("000-00-01") || f.phone.value === "admin3d") {
            const adminUser = {
              id: "admin_nord3d",
              name: "Администратор NORD 3D",
              phone: "+7 (999) 000-00-01",
              role: "admin",
              email: "admin@nord3d.ru",
              avatar: "emoji:⚡",
              district: "Норильск (центр)"
            };
            DB.setUser(adminUser);
            try { sessionStorage.setItem("n3d_admin_authenticated", "true"); } catch {}
            closeModal();
            toast("Вход в учётную запись Администратора выполнен!");
            onDone ? onDone(adminUser) : location.reload();
            return;
          }

          if (!name || d.length < 11) {
            err.textContent = "Укажите имя и телефон в формате +7 (9XX) XXX-XX-XX";
            return;
          }
          isCustSubmitting = true;
          const submitBtn = f.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;

          const user = {
            id: "c" + d,
            name,
            phone: f.phone.value.trim(),
            district: f.district.value,
            telegram: f.telegram.value.trim(),
            role: "customer"
          };
          DB.setUser(user);
          closeModal();
          toast(`Добро пожаловать, ${name}!`);
          onDone ? onDone(user) : location.reload();
        };

        container.querySelectorAll(".btn-social-action").forEach((btn) => {
          btn.onclick = () => triggerSocialLogin(btn.dataset.provider);
        });

      } else {
        // Форма исполнителя со всеми настраиваемыми полями
        container.innerHTML = `
          <div class="auth-intro">
            <h3>Анкета мастера 3D-печати</h3>
            <p class="muted">Заполните профиль: оборудование, технологии, материалы и расценки. Анкета сразу появится в каталоге исполнителей Большого Норильска.</p>
          </div>
          ${socialLoginHtml}
          <form class="form" id="printerForm">

            <!-- Блок 1: Контакты и локация -->
            <div class="form-card-block">
              <div class="form-block-head">
                <span class="badge-num">1</span>
                <div>
                  <h4>Контакты и локация</h4>
                  <small>Как заказчикам к вам обращаться и где удобнее передавать готовые детали</small>
                </div>
              </div>
              <div class="form-grid">
                <div class="field">
                  <label>Имя мастера или студии <span class="req">*</span></label>
                  <div class="input-with-icon">
                    <span class="input-icon">👤</span>
                    <input name="name" type="text" required placeholder="Мастерская «Полярный Слой», Алексей К." />
                  </div>
                </div>
                <div class="field">
                  <label>Номер телефона <span class="req">*</span></label>
                  <div class="input-with-icon">
                    <span class="input-icon">📱</span>
                    <input name="phone" type="tel" required placeholder="+7 (900) 111-22-33" />
                  </div>
                </div>
                <div class="field">
                  <label>Город / Район базы <span class="req">*</span></label>
                  <div class="input-with-icon">
                    <span class="input-icon">📍</span>
                    <select name="district">
                      ${DISTRICTS.map((d) => `<option>${d}</option>`).join("")}
                    </select>
                  </div>
                </div>
                <div class="field">
                  <label>Telegram для быстрой связи</label>
                  <div class="input-with-icon">
                    <span class="input-icon">✈️</span>
                    <input name="telegram" type="text" placeholder="@nord_print_master" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Блок 2: Технологии и оборудование -->
            <div class="form-card-block">
              <div class="form-block-head">
                <span class="badge-num">2</span>
                <div>
                  <h4>Технологии и оборудование</h4>
                  <small>Методы производства и модели вашей техники в Норильске</small>
                </div>
              </div>

              <!-- 2.1 Направления -->
              <div class="form-subgroup">
                <label class="form-subgroup-title">Направления работы мастерской</label>
                <div class="tile-grid">
                  <label class="tile-card">
                    <input type="checkbox" name="tech" value="fdm" checked />
                    <div class="tile-card__inner">
                      <div class="tile-card__icon">🧵</div>
                      <div class="tile-card__content">
                        <b>FDM / FFF печать</b>
                        <small>Послойный филамент</small>
                      </div>
                      <span class="tile-card__check">✓</span>
                    </div>
                  </label>
                  <label class="tile-card">
                    <input type="checkbox" name="tech" value="sla" />
                    <div class="tile-card__inner">
                      <div class="tile-card__icon">💧</div>
                      <div class="tile-card__content">
                        <b>SLA / MSLA печать</b>
                        <small>Фотополимерная смола</small>
                      </div>
                      <span class="tile-card__check">✓</span>
                    </div>
                  </label>
                  <label class="tile-card">
                    <input type="checkbox" name="tech" value="scan" />
                    <div class="tile-card__inner">
                      <div class="tile-card__icon">🔬</div>
                      <div class="tile-card__content">
                        <b>3D-сканирование</b>
                        <small>Оцифровка деталей</small>
                      </div>
                      <span class="tile-card__check">✓</span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- 2.2 Парк 3D-принтеров -->
              <div class="form-subgroup">
                <div class="form-subgroup-header">
                  <span class="form-subgroup-badge">🖨️</span>
                  <div>
                    <b>Оборудование для 3D-печати</b>
                    <small>Модели принтеров и максимальные габариты рабочей зоны</small>
                  </div>
                </div>
                <div class="form-grid">
                  <div class="field">
                    <label>Модели 3D-принтеров <span class="req">*</span></label>
                    <div class="input-with-icon">
                      <span class="input-icon">🖨️</span>
                      <input name="equipment" type="text" required placeholder="Bambu Lab P1S, Creality K1, Voron..." />
                    </div>
                  </div>
                  <div class="field">
                    <label>Область печати (Д × Ш × В)</label>
                    <div class="input-with-icon">
                      <span class="input-icon">📐</span>
                      <input name="buildArea" type="text" placeholder="256 × 256 × 256 мм" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2.3 Оборудование 3D-сканирования -->
              <div class="form-subgroup">
                <div class="form-subgroup-header">
                  <span class="form-subgroup-badge" style="background:rgba(2,132,199,0.12);color:#0284c7;border-color:rgba(56,189,248,0.4)">🔬</span>
                  <div>
                    <b>Оборудование для 3D-сканирования</b>
                    <small>Сканеры для оцифровки физических объектов (укажите при наличии)</small>
                  </div>
                </div>
                <div class="form-grid">
                  <div class="field">
                    <label>Модели 3D-сканеров</label>
                    <div class="input-with-icon">
                      <span class="input-icon">🔬</span>
                      <input name="scannerEquipment" type="text" placeholder="Revopoint POP 3, Creality Ferret, Einstar..." />
                    </div>
                  </div>
                  <div class="field">
                    <label>Точность оцифровки</label>
                    <div class="input-with-icon">
                      <span class="input-icon">🎯</span>
                      <input name="scannerAccuracy" type="text" placeholder="до 0.05 мм, объекты от 2 см до 2 м" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Блок 3: Материалы и прайс -->
            <div class="form-card-block">
              <div class="form-block-head">
                <span class="badge-num">3</span>
                <div>
                  <h4>Материалы и индивидуальный прайс-лист</h4>
                  <small>Отметьте материалы, с которыми работаете, и укажите вашу базовую ставку за единицу</small>
                </div>
              </div>
              <div class="form-grid">
                <div class="col-full">
                  <label style="font-size:13px;font-weight:700;display:block;margin-bottom:8px">
                    Цены за печать по каждому материалу <span class="req">*</span>
                  </label>
                  <div class="mat-price-list">
                    ${MAT_KEYS.map((k) => {
                      const m = MATERIALS[k];
                      return `
                        <div class="mat-price-item" id="matRow_${k}">
                          <label class="mat-price-info" for="cb_mat_${k}">
                            <input type="checkbox" id="cb_mat_${k}" class="mat-price-checkbox" name="mat" value="${k}" checked />
                            <div class="mat-price-meta">
                              <b><i class="mat-dot" style="background:${m.color}"></i> ${k} <span style="font-weight:600;color:var(--text-muted)">(${m.name})</span></b>
                              <small>${m.info}</small>
                            </div>
                          </label>
                          <div class="mat-price-input-wrap">
                            <div class="input-with-icon has-suffix">
                              <span class="input-icon">💰</span>
                              <input name="price_${k}" type="number" min="1" max="500" value="${m.price}" required />
                              <span class="input-suffix">${m.unit}</span>
                            </div>
                          </div>
                        </div>
                      `;
                    }).join("")}
                  </div>

                  <div style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--border);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                      <label style="font-size:13px;font-weight:700">
                        ⭐ Инженерные и спец. материалы (высокие нагрузки, мороз)
                      </label>
                      <small style="font-size:11px;color:var(--text-muted)">опционально</small>
                    </div>
                    <div class="mat-price-list">
                      ${SPEC_MAT_KEYS.map((k) => {
                        const m = SPEC_MATERIALS[k];
                        return `
                          <div class="mat-price-item disabled" id="matRow_${k}">
                            <label class="mat-price-info" for="cb_mat_${k}">
                              <input type="checkbox" id="cb_mat_${k}" class="mat-price-checkbox" name="mat" value="${k}" />
                              <div class="mat-price-meta">
                                <b><i class="mat-dot" style="background:${m.color}"></i> ${k} <span style="font-weight:600;color:var(--text-muted)">(${m.name})</span></b>
                                <small>${m.info}</small>
                              </div>
                            </label>
                            <div class="mat-price-input-wrap">
                              <div class="input-with-icon has-suffix">
                                <span class="input-icon">💰</span>
                                <input name="price_${k}" type="number" min="1" max="1000" value="${m.price}" disabled />
                                <span class="input-suffix">${m.unit}</span>
                              </div>
                            </div>
                          </div>
                        `;
                      }).join("")}
                      <div class="mat-price-item disabled" id="matRow_CUSTOM">
                        <label class="mat-price-info" for="cb_mat_CUSTOM">
                          <input type="checkbox" id="cb_mat_CUSTOM" class="mat-price-checkbox" name="mat" value="CUSTOM" />
                          <div class="mat-price-meta" style="flex:1">
                            <b><i class="mat-dot" style="background:#f59e0b"></i> Свой спецматериал <span style="font-weight:600;color:var(--text-muted)">(PEEK, Ultem, Wood...)</span></b>
                            <input name="customMatName" type="text" placeholder="Название (напр. PEEK, Wood, Dental)" style="height:36px !important;font-size:12px;margin-top:4px;padding:0 12px !important;" disabled />
                          </div>
                        </label>
                        <div class="mat-price-input-wrap">
                          <div class="input-with-icon has-suffix">
                            <span class="input-icon">💰</span>
                            <input name="price_CUSTOM" type="number" min="1" max="2000" value="40" disabled />
                            <span class="input-suffix">₽ / г</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="col-full field" style="margin-top:6px">
                  <label>Минимальная сумма заказа</label>
                  <div class="input-with-icon has-suffix">
                    <span class="input-icon">📦</span>
                    <input name="minOrder" type="number" min="100" max="10000" value="400" />
                    <span class="input-suffix">₽</span>
                  </div>
                  <small class="field-hint">Заказы дешевле этой суммы будут округляться до минимального чека мастера</small>
                </div>
              </div>
            </div>

            <!-- Блок 4: Дополнительные опции и опыт -->
            <div class="form-card-block">
              <div class="form-block-head">
                <span class="badge-num">4</span>
                <div>
                  <h4>Услуги и описание мастерской</h4>
                  <small>Дополнительные возможности и информация для заказчиков</small>
                </div>
              </div>
              <div class="form-grid">
                <div class="col-full">
                  <label style="font-size:13px;font-weight:700;display:block;margin-bottom:8px">Дополнительные опции</label>
                  <div class="service-pills">
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="scanning" checked />
                      <span>🔬 3D-сканирование деталей</span>
                    </label>
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="modeling" checked />
                      <span>✏️ 3D-моделирование деталей</span>
                    </label>
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="postprocess" />
                      <span>🎨 Постобработка / покраска</span>
                    </label>
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="urgent" checked />
                      <span>⚡ Срочная печать 24ч</span>
                    </label>
                    <label class="service-pill">
                      <input type="checkbox" name="srv" value="delivery" checked />
                      <span>🚗 Доставка по НПР</span>
                    </label>
                  </div>
                </div>
                <div class="col-full field">
                  <label>О себе, оборудовании и гарантиях качества</label>
                  <div class="input-with-icon input-with-icon--textarea">
                    <span class="input-icon">📝</span>
                    <textarea name="about" rows="3" placeholder="Расскажите о типах изготавливаемых деталей (автозапчасти, шестерни, макеты, корпуса), точности калибровки и гарантиях..."></textarea>
                  </div>
                </div>
              </div>
            </div>

            <p class="form-msg err" id="authErr"></p>
            <button class="btn btn--primary btn--wide" type="submit" style="height:50px;font-size:15px;font-weight:800;border-radius:12px;box-shadow:0 4px 14px rgba(12,166,120,0.25)">
              ✨ Зарегистрироваться мастером 3D-печати
            </button>
          </form>
        `;

        // Маска для телефона как эталон
        container.querySelectorAll("input[type=tel]").forEach((inp) => {
          inp.addEventListener("input", () => {
            let d = digits(inp.value);
            if (!d) return;
            if (d.startsWith("7") || d.startsWith("8")) d = d.slice(1);
            d = d.slice(0, 10);
            let res = "+7 (";
            if (d.length > 0) res += d.slice(0, 3);
            if (d.length >= 3) res += ") " + d.slice(3, 6);
            if (d.length >= 6) res += "-" + d.slice(6, 8);
            if (d.length >= 8) res += "-" + d.slice(8, 10);
            inp.value = res;
          });
        });

        // Интерактивное переключение чекбоксов материалов
        container.querySelectorAll(".mat-price-checkbox").forEach((cb) => {
          cb.addEventListener("change", () => {
            const row = cb.closest(".mat-price-item");
            const inps = row?.querySelectorAll("input:not([type=checkbox])");
            if (inps) {
              inps.forEach((i) => i.disabled = !cb.checked);
            }
            row?.classList.toggle("disabled", !cb.checked);
          });
        });

        container.querySelectorAll(".btn-social-action").forEach((btn) => {
          btn.onclick = () => triggerSocialLogin(btn.dataset.provider);
        });

        let isPrintSubmitting = false;
        container.querySelector("#printerForm").onsubmit = (e) => {
          e.preventDefault();
          if (isPrintSubmitting) return;
          const f = e.target;
          const name = f.name.value.trim();
          const d = digits(f.phone.value);
          const err = container.querySelector("#authErr");

          if (name.toLowerCase() === "admin" || f.phone.value.includes("000-00-01") || f.phone.value === "admin3d") {
            const adminUser = {
              id: "admin_nord3d",
              name: "Администратор NORD 3D",
              phone: "+7 (999) 000-00-01",
              role: "admin",
              email: "admin@nord3d.ru",
              avatar: "emoji:⚡",
              district: "Норильск (центр)"
            };
            DB.setUser(adminUser);
            try { sessionStorage.setItem("n3d_admin_authenticated", "true"); } catch {}
            closeModal();
            toast("Вход в учётную запись Администратора выполнен!");
            onDone ? onDone(adminUser) : location.reload();
            return;
          }

          if (!name || d.length < 11) {
            err.textContent = "Укажите имя мастера и телефон в формате +7 (9XX) XXX-XX-XX";
            return;
          }
          const mats = [...f.querySelectorAll("[name=mat]:checked")].map((x) => x.value);
          const techs = [...f.querySelectorAll("[name=tech]:checked")].map((x) => x.value);
          const srvs = [...f.querySelectorAll("[name=srv]:checked")].map((x) => x.value);

          if (!mats.length) {
            err.textContent = "Выберите хотя бы один материал для печати";
            return;
          }

          isPrintSubmitting = true;
          const submitBtn = f.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;

          // Собираем индивидуальные цены по каждому выбранному материалу
          const materialPrices = {};
          mats.forEach((m) => {
            if (m === "CUSTOM") return;
            const inp = f.querySelector(`[name="price_${m}"]`);
            const def = MATERIALS[m]?.price || SPEC_MATERIALS[m]?.price || 10;
            materialPrices[m] = inp ? (+inp.value || def) : def;
          });
          const hasCustom = mats.includes("CUSTOM");
          const customMatName = hasCustom && f.customMatName ? f.customMatName.value.trim() : "";
          const customMatPrice = hasCustom && f.price_CUSTOM ? (+f.price_CUSTOM.value || 40) : 0;
          if (customMatName && customMatPrice > 0) {
            materialPrices[customMatName] = customMatPrice;
          }
          const pricePerGram = Object.keys(materialPrices).length ? Math.min(...Object.values(materialPrices)) : 10;
          const stdMats = mats.filter((m) => MAT_KEYS.includes(m));
          const specMats = mats.filter((m) => SPEC_MAT_KEYS.includes(m));

          const id = "p" + d;
          const list = DB.printers();
          let printer = list.find((x) => x.id === id);

          const scannerEquipment = f.scannerEquipment ? f.scannerEquipment.value.trim() : "";
          const scannerAccuracy = f.scannerAccuracy ? f.scannerAccuracy.value.trim() : "";
          if (scannerEquipment || techs.includes("scan")) {
            if (!srvs.includes("scanning")) srvs.push("scanning");
          }

          const fields = {
            id,
            name,
            phone: f.phone.value.trim(),
            telegram: f.telegram.value.trim(),
            district: f.district.value,
            tech: techs.length ? techs : ["fdm"],
            equipment: f.equipment.value.trim() || "3D-принтер",
            buildArea: f.buildArea.value.trim() || "256 × 256 × 256 мм",
            scannerEquipment,
            scannerAccuracy,
            materials: stdMats.length ? stdMats : mats.filter((m) => m !== "CUSTOM"),
            specMaterials: specMats,
            customMatName,
            customMatPrice,
            materialPrices,
            pricePerGram,
            minOrder: +f.minOrder.value || 400,
            services: srvs,
            about: f.about.value.trim(),
            rating: printer?.rating || 5.0,
            reviews: printer?.reviews || 1,
            done: printer?.done || 1,
            since: printer?.since || String(new Date().getFullYear())
          };

          if (printer) Object.assign(printer, fields);
          else list.push(fields);

          DB.savePrinters(list);

          const user = { id, name, phone: fields.phone, role: "printer" };
          DB.setUser(user);
          closeModal();
          toast(`Профиль мастера «${name}» успешно создан!`);
          onDone ? onDone(user) : location.reload();
        };
      }
    }

    box.querySelector("#tabBtnCustomer").onclick = () => { currentRole = "customer"; renderForm(); };
    box.querySelector("#tabBtnPrinter").onclick = () => { currentRole = "printer"; renderForm(); };

    // Демо-аккаунты
    box.querySelectorAll("[data-demo]").forEach((b) => b.onclick = () => {
      const type = b.dataset.demo;
      if (type === "c") DB.setUser({ id: "c79990001122", name: "Сергей", phone: "+7 999 000-11-22", role: "customer" });
      else if (type === "p") DB.setUser({ id: "p79001112233", name: "Алексей К.", phone: "+7 900 111-22-33", role: "printer" });
      else if (type === "d") DB.setUser({ id: "p79003334455", name: "Дарья М.", phone: "+7 900 333-44-55", role: "printer" });
      else if (type === "a") {
        DB.setUser({ id: "admin_nord3d", name: "Администратор NORD 3D", phone: "+7 (999) 000-00-01", role: "admin", email: "admin@nord3d.ru", avatar: "emoji:⚡", district: "Норильск (центр)" });
        try { sessionStorage.setItem("n3d_admin_authenticated", "true"); } catch {}
      }
      closeModal();
      onDone ? onDone(DB.user()) : location.reload();
    });

    renderForm();
  }

  function requireUser(role, cb) {
    const u = DB.user();
    if (u && (!role || u.role === role)) return cb(u);
    loginModal(role || "customer", cb);
  }

  // ---------- Тема оформления (Светлая / Тёмная) ----------
  function getTheme() {
    if (typeof document !== "undefined" && document.documentElement?.getAttribute) {
      return document.documentElement.getAttribute("data-theme") || (typeof localStorage !== "undefined" ? localStorage.getItem("n3d_theme") : "light") || "light";
    }
    return typeof localStorage !== "undefined" ? localStorage.getItem("n3d_theme") || "light" : "light";
  }

  function setTheme(t) {
    if (typeof document !== "undefined") {
      if (document.documentElement?.setAttribute) {
        document.documentElement.setAttribute("data-theme", t);
      }
      if (document.body?.setAttribute) {
        document.body.setAttribute("data-theme", t);
      }
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("n3d_theme", t);
    }
    if (typeof document !== "undefined" && document.querySelectorAll) {
      document.querySelectorAll(".theme-toggle").forEach((btn) => {
        btn.textContent = t === "dark" ? "☀️" : "🌙";
      });
    }
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("n3d:theme-changed", { detail: { theme: t } }));
    }
  }

  function toggleTheme() {
    const next = getTheme() === "dark" ? "light" : "dark";
    setTheme(next);
  }

  // Применяем тему сразу при загрузке скрипта
  if (typeof document !== "undefined") {
    setTheme(getTheme());

    // Универсальный делегированный клик для всех кнопок переключения темы
    document.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest && e.target.closest(".theme-toggle");
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
      }
    });
  }

  // ---------- Анимация фона: 3D-печать & Северное сияние Норильска ----------
  // ---------- Анимация фона: 3D-печать & Северное сияние Норильска ----------
  function initBackgroundAnimation() {
    const canvas = document.getElementById("bgCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0, height = 0;
    let animId = null;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    // Мышь для интерактивного взаимодействия с полигональной сеткой
    const mouse = { x: -9999, y: -9999, active: false };
    window.addEventListener("pointermove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    });
    window.addEventListener("pointerleave", () => {
      mouse.active = false;
    });

    // Частицы филамента (PLA, PETG, ABS) и узлы 3D-полигональной сетки
    const count = Math.min(48, Math.max(26, Math.floor(window.innerWidth / 35)));
    const particles = [];
    const colorPalette = [
      { light: "12, 166, 120", dark: "16, 185, 129" }, // Emerald (PETG)
      { light: "2, 132, 199",  dark: "56, 189, 248" }, // Arctic Cyan (Resin)
      { light: "234, 88, 12",  dark: "249, 115, 22" }, // Amber/Copper (PLA)
      { light: "124, 58, 237", dark: "168, 85, 247" }  // Aurora Violet (TPU)
    ];

    for (let i = 0; i < count; i++) {
      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(Math.random() * 0.45 + 0.2),
        r: Math.random() * 2.2 + 1.2,
        alpha: Math.random() * 0.35 + 0.45,
        col
      });
    }

    let time = 0;

    function draw() {
      time += 0.008;
      ctx.clearRect(0, 0, width, height);

      const isDark = getTheme() === "dark";

      // 1. Плавные переливы полярного сияния (Aurora Borealis)
      // Волна 1: Изумрудный северный свет
      const g1 = ctx.createRadialGradient(
        width * 0.22 + Math.sin(time * 0.7) * 110,
        height * 0.22 + Math.cos(time * 0.5) * 70,
        30,
        width * 0.22,
        height * 0.22,
        Math.max(width, height) * 0.52
      );
      if (isDark) {
        g1.addColorStop(0, "rgba(16, 185, 129, 0.22)");
        g1.addColorStop(0.5, "rgba(12, 166, 120, 0.08)");
        g1.addColorStop(1, "rgba(11, 15, 25, 0)");
      } else {
        g1.addColorStop(0, "rgba(12, 166, 120, 0.20)");
        g1.addColorStop(0.5, "rgba(16, 185, 129, 0.08)");
        g1.addColorStop(1, "rgba(248, 250, 252, 0)");
      }
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      // Волна 2: Арктический лазурный свет
      const g2 = ctx.createRadialGradient(
        width * 0.78 + Math.cos(time * 0.6) * 130,
        height * 0.32 + Math.sin(time * 0.8) * 90,
        40,
        width * 0.78,
        height * 0.32,
        Math.max(width, height) * 0.55
      );
      if (isDark) {
        g2.addColorStop(0, "rgba(56, 189, 248, 0.20)");
        g2.addColorStop(0.55, "rgba(2, 132, 199, 0.07)");
        g2.addColorStop(1, "rgba(11, 15, 25, 0)");
      } else {
        g2.addColorStop(0, "rgba(2, 132, 199, 0.18)");
        g2.addColorStop(0.55, "rgba(56, 189, 248, 0.07)");
        g2.addColorStop(1, "rgba(248, 250, 252, 0)");
      }
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      // Волна 3: Норильский морозный фиолетовый акцент
      const g3 = ctx.createRadialGradient(
        width * 0.5 + Math.sin(time * 0.4) * 80,
        height * 0.1 + Math.cos(time * 0.6) * 50,
        20,
        width * 0.5,
        height * 0.1,
        Math.max(width, height) * 0.4
      );
      if (isDark) {
        g3.addColorStop(0, "rgba(139, 92, 246, 0.14)");
        g3.addColorStop(0.6, "rgba(99, 102, 241, 0.04)");
        g3.addColorStop(1, "rgba(11, 15, 25, 0)");
      } else {
        g3.addColorStop(0, "rgba(124, 58, 237, 0.12)");
        g3.addColorStop(0.6, "rgba(99, 102, 241, 0.04)");
        g3.addColorStop(1, "rgba(248, 250, 252, 0)");
      }
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, width, height);

      // 2. Изометрическая координатная сетка стола 3D-принтера (Bed Mesh)
      ctx.save();
      const gridColor = isDark ? "rgba(56, 189, 248, 0.08)" : "rgba(12, 166, 120, 0.10)";
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      const gridSize = 56;
      const offsetX = (time * 6) % gridSize;
      const offsetY = (time * 3) % gridSize;

      ctx.beginPath();
      for (let x = -gridSize; x < width + gridSize; x += gridSize) {
        ctx.moveTo(x + offsetX, 0);
        ctx.lineTo(x + offsetX, height);
      }
      for (let y = -gridSize; y < height + gridSize; y += gridSize) {
        ctx.moveTo(0, y + offsetY);
        ctx.lineTo(width, y + offsetY);
      }
      ctx.stroke();

      // Калибровочные крестики автокалибровки стола (+)
      const crossColor = isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(2, 132, 199, 0.30)";
      ctx.strokeStyle = crossColor;
      ctx.lineWidth = 1.2;
      const crossSize = 4;
      const step = gridSize * 2;
      for (let x = -gridSize; x < width + gridSize; x += step) {
        for (let y = -gridSize; y < height + gridSize; y += step) {
          const cx = x + offsetX;
          const cy = y + offsetY;
          ctx.beginPath();
          ctx.moveTo(cx - crossSize, cy);
          ctx.lineTo(cx + crossSize, cy);
          ctx.moveTo(cx, cy - crossSize);
          ctx.lineTo(cx, cy + crossSize);
          ctx.stroke();
        }
      }
      ctx.restore();

      // 3. Сканирующий лазерный луч уровня и наложения слоя печати
      const scanPeriod = (height + 200);
      const scanY = ((time * 70) % scanPeriod) - 80;
      if (scanY > -50 && scanY < height + 50) {
        const beamGrad = ctx.createLinearGradient(0, scanY, width, scanY);
        if (isDark) {
          beamGrad.addColorStop(0, "rgba(16, 185, 129, 0)");
          beamGrad.addColorStop(0.2, "rgba(16, 185, 129, 0.35)");
          beamGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.50)");
          beamGrad.addColorStop(0.8, "rgba(16, 185, 129, 0.35)");
          beamGrad.addColorStop(1, "rgba(16, 185, 129, 0)");
        } else {
          beamGrad.addColorStop(0, "rgba(12, 166, 120, 0)");
          beamGrad.addColorStop(0.2, "rgba(12, 166, 120, 0.28)");
          beamGrad.addColorStop(0.5, "rgba(2, 132, 199, 0.38)");
          beamGrad.addColorStop(0.8, "rgba(12, 166, 120, 0.28)");
          beamGrad.addColorStop(1, "rgba(12, 166, 120, 0)");
        }
        ctx.strokeStyle = beamGrad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(width, scanY);
        ctx.stroke();

        // Световой шлейф за лазером
        const trailGrad = ctx.createLinearGradient(0, scanY - 32, 0, scanY);
        trailGrad.addColorStop(0, "rgba(12, 166, 120, 0)");
        trailGrad.addColorStop(1, isDark ? "rgba(16, 185, 129, 0.07)" : "rgba(12, 166, 120, 0.06)");
        ctx.fillStyle = trailGrad;
        ctx.fillRect(0, scanY - 32, width, 32);

        // Индикатор сопла экструдера, движущийся вдоль луча
        const nozzX = width * (0.5 + 0.42 * Math.sin(time * 2.4));
        ctx.beginPath();
        ctx.arc(nozzX, scanY, 3, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#38bdf8" : "#0284c7";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(nozzX, scanY, 7, 0, Math.PI * 2);
        ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.4)" : "rgba(2, 132, 199, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 4. Полигональные 3D-связи между частицами (Wireframe STL mesh)
      const maxDist = 95;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const pi = particles[i];
          const pj = particles[j];
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (isDark ? 0.22 : 0.16);
            ctx.strokeStyle = isDark ? `rgba(56, 189, 248, ${alpha})` : `rgba(12, 166, 120, ${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(pj.x, pj.y);
            ctx.stroke();
          }
        }
      }

      // 5. Движение частиц филамента и реакция на курсор мыши
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx + Math.sin(time + p.y * 0.01) * 0.25;
        p.y += p.vy;

        // Взаимодействие с курсором
        if (mouse.active) {
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < 110 && mdist > 1) {
            const force = (110 - mdist) / 110;
            p.x += (mdx / mdist) * force * 1.8;
            p.y += (mdy / mdist) * force * 1.8;

            // Луч от курсора к частице
            ctx.strokeStyle = isDark
              ? `rgba(56, 189, 248, ${force * 0.28})`
              : `rgba(2, 132, 199, ${force * 0.22})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }

        if (p.y < -15) {
          p.y = height + 15;
          p.x = Math.random() * width;
        }
        if (p.x < -15) p.x = width + 15;
        if (p.x > width + 15) p.x = -15;

        // Отрисовка частицы
        const colorStr = isDark ? p.col.dark : p.col.light;
        const alpha = isDark ? p.alpha * 0.95 : p.alpha * 0.8;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colorStr}, ${alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(animId);
      else animId = requestAnimationFrame(draw);
    });

    animId = requestAnimationFrame(draw);
  }

  // ---------- Шапка и футер ----------

  // Глобальный перехват нажатий на «Разместить заказ» и «3D-сканирование» для гостей сайта
  if (typeof document !== "undefined") {
    document.addEventListener("click", function(e) {
      const el = e.target.closest("a, button");
      if (!el) return;

      if (el.closest(".auth-box") || el.closest(".modal-overlay") || el.id === "loginBtn" || (el.dataset && el.dataset.demo)) return;

      const href = el.getAttribute("href") || "";
      const text = el.textContent ? el.textContent.trim() : "";
      const id = el.id || "";

      const isOrder = href.includes("order.html") || id === "btnCreateOrder" || text.includes("Разместить заказ") || text.includes("3D-печать моделей");
      const isScan = href.includes("scan.html") || id === "btnOrderScan" || text.includes("3D-сканирование") || text.includes("3D-сканирование деталей");

      if ((isOrder || isScan) && !DB.user()) {
        e.preventDefault();
        e.stopPropagation();
        const dest = isScan ? "scan.html" : "order.html";
        const hint = isScan
          ? "Для заказа 3D-сканирования и реверса детали, пожалуйста, зарегистрируйтесь или войдите"
          : "Для размещения заказа на 3D-печать, пожалуйста, зарегистрируйтесь или войдите";

        loginModal("customer", function() {
          location.href = dest;
        }, hint);
      }
    }, true);
  }

  function renderChrome() {
    const page = document.body.dataset.page;
    const u = DB.user();
    const isAdmin = u && u.role === "admin";
    const isPrinter = u && u.role === "printer";
    const unread = u ? Chat.getUnreadCount(u.id) : 0;

    // Навигация динамически адаптируется под роль пользователя:
    // Для администратора показываются «Главная», «Биржа заказов», «Исполнители», «Сделки» и «Админ-панель».
    // Для исполнителя (мастера) показываются «Главная», «Биржа заказов», «Сделки», «Сообщения», «Кошелёк» и «Рейтинг».
    // Для заказчика/гостя — соответствующие разделы.
    let links = [];
    if (isAdmin) {
      links = [
        ["index", "index.html", "Главная"],
        ["orders", "orders.html", "Биржа заказов"],
        ["printers", "printers.html", "Исполнители"],
        ["my-orders", "my-orders.html", "📋 Сделки"],
        ["portfolio", "portfolio.html", "📸 Портфолио"],
        ["admin", "admin.html", "⚙️ Админ-панель"],
      ];
    } else if (isPrinter) {
      links = [
        ["index", "index.html", "Главная"],
        ["orders", "orders.html", "Биржа заказов"],
        ["my-orders", "my-orders.html", "📋 Сделки"],
        ["portfolio", "portfolio.html", "📸 Портфолио"],
        ["cabinet", "cabinet.html", "💬 Сообщения"],
        ["wallet", "wallet.html", "💳 Кошелёк"],
        ["rating", "rating.html", "⭐ Рейтинг"],
      ];
    } else {
      links = [
        ["index", "index.html", "Главная"],
        ["order", "order.html", "Разместить заказ"],
        ["scan", "scan.html", "🔬 3D-сканирование"],
        ["portfolio", "portfolio.html", "📸 Портфолио"],
        ["printers", "printers.html", "Исполнители"],
      ];
      if (u) {
        links.push(["my-orders", "my-orders.html", "📋 Мои заказы"]);
        links.push(["cabinet", "cabinet.html", "💬 Сообщения"]);
        links.push(["wallet", "wallet.html", "💳 Кошелёк"]);
      }
    }

    const userWallet = u ? DB.wallet(u.id) : null;

    const header = document.getElementById("siteHeader");
    if (header) {
      header.className = "header";
      header.innerHTML = `
        <div class="container header__inner">
          <a href="index.html" class="logo">NORD<span>3D</span></a>
          <nav class="nav" id="nav">${links.map(([k, h, t]) => {
            const isMsg = k === "cabinet";
            const badge = isMsg ? `<span class="nav-msg-badge" id="navMsgBadge" style="${unread > 0 ? '' : 'display:none'}">${unread > 99 ? '99+' : unread}</span>` : "";
            return `<a href="${h}" class="${k === page ? "active" : ""}">${t}${badge}</a>`;
          }).join("")}
          ${u ? `<button class="nav-mobile-logout" id="navMobileLogoutBtn">🚪 Выйти из аккаунта (${esc(u.name)})</button>` : ''}
          </nav>
          <div class="userbox">
            <button class="theme-toggle" id="themeToggle" title="Переключить тему (светлая / тёмная)" aria-label="Тема">
              ${getTheme() === "dark" ? "☀️" : "🌙"}
            </button>
            ${u ? `
              <a href="wallet.html" class="header-balance-chip ${page === 'wallet' ? 'active' : ''}" id="headerBalanceChip" title="Баланс кошелька: нажмите для пополнения или вывода">
                <span class="header-balance-icon">💳</span>
                <b class="header-balance-amount" id="headerBalanceAmount">${money(userWallet?.balance || 0)}</b>
              </a>
              <div class="userchip" id="headerUserChip" role="button" tabindex="0" title="Настройки профиля: ${esc(u.name)} (нажмите для редактирования)">
                ${avatar(u, 32)}
                <span class="userchip-text"><b>${esc(u.name)}</b><small>${u.role === "admin" ? "администратор" : (u.role === "printer" ? "мастер" : "заказчик")}</small></span>
              </div>
              <button class="btn btn--ghost btn--small header-logout-btn" id="logoutBtn">Выйти</button>`
              : `<button class="btn btn--small btn--primary" id="loginBtn">Войти</button>`}
            <button class="burger" id="burger" aria-label="Меню">☰</button>
          </div>
        </div>`;
      header.querySelector("#loginBtn")?.addEventListener("click", () => loginModal());
      header.querySelector("#logoutBtn")?.addEventListener("click", () => { DB.setUser(null); location.reload(); });
      header.querySelector("#navMobileLogoutBtn")?.addEventListener("click", () => { DB.setUser(null); location.reload(); });
      header.querySelector("#headerUserChip")?.addEventListener("click", () => openProfileSettingsModal());
      header.querySelector("#headerUserChip")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProfileSettingsModal();
        }
      });
      header.querySelector("#burger")?.addEventListener("click", () => header.querySelector("#nav").classList.toggle("open"));

      const updateNavBadge = () => {
        const badge = header.querySelector("#navMsgBadge");
        if (!badge) return;
        const curU = DB.user();
        const count = curU ? Chat.getUnreadCount(curU.id) : 0;
        if (count > 0) {
          badge.textContent = count > 99 ? "99+" : count;
          badge.style.display = "inline-flex";
        } else {
          badge.style.display = "none";
        }
      };
      const updateHeaderBalance = () => {
        const el = header.querySelector("#headerBalanceAmount");
        if (!el) return;
        const curU = DB.user();
        if (curU) {
          const w = DB.wallet(curU.id);
          el.textContent = money(w.balance || 0);
        }
      };
      window.addEventListener("n3d:chat-updated", updateNavBadge);
      window.addEventListener("n3d:wallet-updated", updateHeaderBalance);
      window.addEventListener("n3d:data-updated", () => {
        updateNavBadge();
        updateHeaderBalance();
      });
    }
    const footer = document.getElementById("siteFooter");
    if (footer) {
      footer.className = "footer";
      footer.innerHTML = `
        <div class="container footer__inner">
          <div><a href="index.html" class="logo">NORD<span>3D</span></a><p>Платформа прямой связи заказчиков и печатников Норильска.</p></div>
          <div><b>Заказчикам</b><a href="order.html">3D-печать моделей</a><a href="scan.html">3D-сканирование деталей</a><a href="printers.html">Найти мастера</a><a href="my-orders.html">Мои заказы</a></div>
          <div><b>Исполнителям</b><a href="orders.html">Лента заказов</a><a href="my-orders.html">Сделки</a></div>
          <div><b>Контакты</b><p>г. Норильск, ул. Ленина</p><a href="https://t.me/your_username" target="_blank">Telegram: @your_username</a>${isAdmin ? `<a href="admin.html" style="color:var(--accent);font-weight:700">⚙️ Админ-панель</a>` : ""}<button class="link" id="resetDemo">↺ Сбросить демо-данные</button></div>
        </div>
        <div class="container footer__copy">© ${new Date().getFullYear()} NORD 3D · Норильск · 69° с. ш.</div>`;
      footer.querySelector("#resetDemo")?.addEventListener("click", () => { if (confirm("Сбросить демо-данные?")) { DB.reset(); location.reload(); } });
    }

    // Запуск фоновой анимации
    initBackgroundAnimation();

    // Запуск синхронизации с бэкендом (если развёрнут)
    apiSync.pull();
    apiSync.initSSE();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderChrome);
  } else {
    renderChrome();
  }

  window.N3D = {
    DB, DEFAULT_MONETIZATION, MATERIALS, MAT_KEYS, SPEC_MATERIALS, SPEC_MAT_KEYS, DISTRICTS, TECHS, STATUS, Presence, Chat,
    esc, money, date, ago, uid, digits, avatar, stars, statusBadge, qs, estimate,
    openModal, closeModal, toast, loginModal, requireUser, openProfileSettingsModal,
    getTheme, setTheme, toggleTheme, compressImage, openPhotoModal,
    PRESET_AVATARS, cropAndCompressAvatar, openAvatarPickerModal,
    // Архитектура v2.0 (ES Modules & Storage)
    IDB: (typeof window !== "undefined" && window.N3D_IDB) ? window.N3D_IDB : null,
    AUTH: (typeof window !== "undefined" && window.N3D_AUTH) ? window.N3D_AUTH : null,
    ESCROW: (typeof window !== "undefined" && window.N3D_ESCROW) ? window.N3D_ESCROW : null,
    CHAT: (typeof window !== "undefined" && window.N3D_CHAT) ? window.N3D_CHAT : null,
    UI: (typeof window !== "undefined" && window.N3D_UI) ? window.N3D_UI : null
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = window.N3D;
  }
})();
