// 3ДСосед — Раздел «Рейтинг и репутация мастера» с финансовым статусом и оценками за услуги
(() => {
  "use strict";

  const { DB, esc, money, date, ago, avatar, stars, toast, loginModal } = N3D;

  const $ = (id) => document.getElementById(id);
  let currentUser = DB.user();
  let targetMasterId = "p79001112233"; // По умолчанию мастер Алексей К.
  let currentReviewFilter = "all";

  function init() {
    currentUser = DB.user();
    if (currentUser && currentUser.role === "printer") {
      targetMasterId = currentUser.id;
    }
    renderUserMeta();
    renderKpis();
    renderMasterCard();
    renderServiceScores();
    renderCriteriaScores();
    renderReviews();
    bindEvents();
  }

  // Метаданные и переключатель
  function renderUserMeta() {
    const isP = currentUser && currentUser.role === "printer";
    $("ratingUserMeta").innerHTML = `
      <div class="userchip" style="cursor:default">
        ${avatar(currentUser || { name: "Алексей К.", role: "printer" }, 36)}
        <span>
          <b>${esc(currentUser?.name || "Алексей К.")}</b>
          <small>${isP ? "🖨️ Мастер 3D-печати" : "🧑 Просмотр рейтинга мастера"}</small>
        </span>
      </div>
    `;

    $("switchRatingUserBtn").textContent = isP ? "Переключить на Заказчика Сергея" : "Войти как Мастер Алексей К.";
    $("switchRatingUserBtn").onclick = () => {
      if (isP) {
        DB.setUser({ id: "c79990001122", name: "Сергей", phone: "+7 999 000-11-22", role: "customer" });
      } else {
        DB.setUser({ id: "p79001112233", name: "Алексей К.", phone: "+7 900 111-22-33", role: "printer" });
      }
      location.reload();
    };
  }

  // 4 Ключевые карточки: статус, доходы, холд, вывод
  function renderKpis() {
    const master = DB.printer(targetMasterId);
    const wallet = DB.wallet(targetMasterId);

    $("ratingKpiGrid").innerHTML = `
      <!-- Карточка 1: Рейтинг -->
      <div class="wallet-kpi-card wallet-kpi--rating">
        <div class="kpi-card-head">
          <span class="kpi-icon">⭐</span>
          <span class="kpi-badge kpi-badge--rating">Репутация</span>
        </div>
        <div class="kpi-amount">${master?.rating || 4.9} <small style="font-size:18px;color:var(--text-muted)">/ 5.0</small></div>
        <p class="kpi-desc">
          На основе <b>${master?.reviews || 37} отзывов</b> заказчиков Норильска
        </p>
        <div class="kpi-submeta">
          <span>Выполнено заказов: <b>${master?.done || 52}</b></span>
        </div>
      </div>

      <!-- Карточка 2: Сколько пришло (заработано) -->
      <div class="wallet-kpi-card wallet-kpi--in">
        <div class="kpi-card-head">
          <span class="kpi-icon">📥</span>
          <span class="kpi-badge kpi-badge--in">Всего пришло</span>
        </div>
        <div class="kpi-amount text-success">+${money(wallet.totalIn || 74500)}</div>
        <p class="kpi-desc">
          Заработано и выплачено за всё время работы на платформе
        </p>
        <div class="kpi-submeta">
          <span>Успешных сделок: <b>100%</b></span>
        </div>
      </div>

      <!-- Карточка 3: Сколько на холде -->
      <div class="wallet-kpi-card wallet-kpi--hold">
        <div class="kpi-card-head">
          <span class="kpi-icon">🔒</span>
          <span class="kpi-badge kpi-badge--hold">На холде</span>
        </div>
        <div class="kpi-amount">${money(wallet.hold || 990)}</div>
        <p class="kpi-desc">
          Заказы в производстве под защитой Гаранта 3ДСосед
        </p>
        <div class="kpi-note">
          🛡️ Выплата сразу после подтверждения приёмки
        </div>
      </div>

      <!-- Карточка 4: Сколько ушло (выведено) -->
      <div class="wallet-kpi-card wallet-kpi--out">
        <div class="kpi-card-head">
          <span class="kpi-icon">📤</span>
          <span class="kpi-badge kpi-badge--out">Всего ушло</span>
        </div>
        <div class="kpi-amount text-muted">-${money(wallet.totalOut || 35000)}</div>
        <p class="kpi-desc">
          Успешно выведено на личные банковские карты мастера
        </p>
        <div class="kpi-submeta">
          <span>Доступно к выводу: <b class="text-success">${money(wallet.balance || 38600)}</b></span>
        </div>
      </div>
    `;
  }

  // Карточка мастера и оборудования
  function renderMasterCard() {
    const master = DB.printer(targetMasterId);
    if (!master) return;

    $("masterRepCard").innerHTML = `
      <div class="master-rep-inner">
        <div class="master-rep-avatar-wrap">
          ${avatar(master, 72)}
          <span class="rep-verified-badge" title="Верифицированный исполнитель 3ДСосед">🛡️</span>
        </div>
        <div class="master-rep-info">
          <div class="master-rep-title-line">
            <h2>${esc(master.name)}</h2>
            <span class="status status--ready">✓ Проверенный мастер 3ДСосед</span>
          </div>
          <p class="muted" style="margin:4px 0 10px;font-size:13.5px">
            📍 <b>${esc(master.district)}</b> · В сервисе с <b>${master.since || "2022"} года</b> · Телефон: <b>${esc(master.phone)}</b>
          </p>
          <div class="master-equip-chips">
            <span class="chip chip--accent">🖨️ ${esc(master.equipment)}</span>
            ${master.scannerEquipment ? `<span class="chip chip--scan">🔬 ${esc(master.scannerEquipment)}</span>` : ""}
            <span class="chip chip--neutral">📐 ${esc(master.buildArea || "300 × 300 × 300 мм")}</span>
            <span class="chip chip--neutral">🧵 ${(master.materials || ["PLA", "PETG"]).join(", ")}</span>
          </div>
        </div>
        <div class="master-rep-actions">
          <a href="wallet.html" class="btn btn--primary btn--small">💳 Открыть кошелёк</a>
          <a href="cabinet.html" class="btn btn--ghost btn--small">💬 Сообщения мастера</a>
        </div>
      </div>
    `;
  }

  // Оценки по категориям услуг (FDM, SLA, 3D-сканирование, 3D-моделирование)
  function renderServiceScores() {
    const services = [
      {
        id: "fdm",
        title: "3D-печать FDM / FFF (филамент)",
        icon: "🧵",
        score: "4.9",
        count: 34,
        pct: 98,
        desc: "Корпуса, крепления, кронштейны для снегоходов из PETG, ABS, Nylon"
      },
      {
        id: "sla",
        title: "Фотополимерная печать SLA / MSLA (смола)",
        icon: "💧",
        score: "5.0",
        count: 11,
        pct: 100,
        desc: "Шестерни приборов, миниатюры, гладкие прецизионные детали"
      },
      {
        id: "scan",
        title: "3D-сканирование и реверс-инжиниринг",
        icon: "🔬",
        score: "4.9",
        count: 7,
        pct: 98,
        desc: "Оцифровка сломанных деталей снегоходов «Буран», авто и техники"
      },
      {
        id: "modeling",
        title: "3D-моделирование и доработка CAD",
        icon: "✏️",
        score: "4.8",
        count: 12,
        pct: 96,
        desc: "Построение параметрических STEP-моделей и исправление полигональных сеток"
      }
    ];

    $("serviceScoresList").innerHTML = services.map((s) => `
      <div class="service-score-item">
        <div class="service-score-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="service-score-icon">${s.icon}</span>
            <div>
              <b style="font-size:14px;color:var(--text)">${s.title}</b>
              <small class="muted" style="display:block;font-size:11.5px">${s.desc}</small>
            </div>
          </div>
          <div style="text-align:right">
            <b class="service-score-val">${s.score} ★</b>
            <small class="muted" style="display:block;font-size:11px">${s.count} заказов</small>
          </div>
        </div>
        <div class="service-score-bar-wrap">
          <div class="service-score-bar" style="width:${s.pct}%"></div>
        </div>
      </div>
    `).join("");
  }

  // Критерии качества и сервиса
  function renderCriteriaScores() {
    const criteria = [
      { label: "Точность размеров и геометрии калибровки", val: "4.95", pct: 99, icon: "📐" },
      { label: "Соблюдение оговорённых сроков изготовления", val: "4.90", pct: 98, icon: "⏱️" },
      { label: "Вежливость и скорость ответов в чате", val: "5.00", pct: 100, icon: "💬" },
      { label: "Надёжность упаковки и удобство передачи в Норильске", val: "4.95", pct: 99, icon: "📦" }
    ];

    $("criteriaScoresList").innerHTML = criteria.map((c) => `
      <div class="criterion-item">
        <div class="criterion-head">
          <span>${c.icon} ${c.label}</span>
          <b>${c.val} <small class="muted">/ 5.0</small></b>
        </div>
        <div class="criterion-bar-wrap">
          <div class="criterion-bar" style="width:${c.pct}%"></div>
        </div>
      </div>
    `).join("");
  }

  // Список отзывов с фильтрацией
  function renderReviews() {
    let list = DB.reviews(targetMasterId);

    if (currentReviewFilter !== "all") {
      list = list.filter((r) => r.service === currentReviewFilter);
    }

    const container = $("reviewsFeed");
    if (!list.length) {
      container.innerHTML = `
        <div class="tx-empty-state">
          <div style="font-size:36px;margin-bottom:8px">💬</div>
          <b>Отзывов в этой категории пока нет</b>
          <p class="muted" style="font-size:13px;margin:4px 0 0">
            Здесь будут отображаться новые отзывы заказчиков после приёмки изделий.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map((r) => `
      <div class="review-card">
        <div class="review-head">
          <div class="review-author">
            ${avatar({ name: r.customerName, avatar: r.customerAvatar }, 44)}
            <div>
              <div class="review-author-name">
                <b>${esc(r.customerName)}</b>
                ${r.district ? `<small class="muted">· ${esc(r.district)}</small>` : ""}
              </div>
              <div class="review-meta-row">
                <span class="review-service-badge">${esc(r.serviceName || "3D-печать")}</span>
                ${r.orderTitle ? `<span class="review-order-pill">Заказ: «${esc(r.orderTitle)}»</span>` : ""}
              </div>
            </div>
          </div>
          <div class="review-score-wrap">
            <div class="review-stars">${stars(r.score)}</div>
            <span class="review-date muted">${date(r.date)}</span>
          </div>
        </div>

        <p class="review-comment">
          «${esc(r.comment)}»
        </p>

        <div class="review-footer">
          <span class="review-escrow-badge">
            <span style="color:#0ca678">🛡️</span> Сделка подтверждена платформой 3ДСосед (Гарант сделки)
          </span>
          <div class="review-subscores">
            <span>Точность: <b>${r.accuracyScore || 5}★</b></span>
            <span>Сроки: <b>${r.speedScore || 5}★</b></span>
            <span>Связь: <b>${r.commScore || 5}★</b></span>
          </div>
        </div>
      </div>
    `).join("");
  }

  function bindEvents() {
    $("reviewFilters")?.querySelectorAll(".tx-pill").forEach((btn) => {
      btn.onclick = () => {
        $("reviewFilters").querySelectorAll(".tx-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentReviewFilter = btn.dataset.filter;
        renderReviews();
      };
    });

    window.addEventListener("n3d:data-updated", () => {
      renderKpis();
      renderMasterCard();
      renderReviews();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
