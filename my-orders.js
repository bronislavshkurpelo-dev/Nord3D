// NORD 3D — Отдельный раздел управления заказами и сделками (в стиле FunPay)
(() => {
  "use strict";

  const { DB, Chat, Presence, esc, money, date, ago, avatar, stars, statusBadge, STATUS, toast, openModal, closeModal, loginModal } = N3D;
  const $ = (id) => document.getElementById(id);

  let currentUser = DB.user();
  let currentTab = "all";       // 'all' | 'customer' | 'printer'
  let currentStatus = "all";    // 'all' | 'in_work' | 'ready' | 'done' | 'open'
  let targetOrderId = null;     // из URL ?id=...

  function init() {
    currentUser = DB.user();
    const params = new URLSearchParams(location.search);
    targetOrderId = params.get("id");

    if (!currentUser) {
      renderGuestState();
      return;
    }

    // По умолчанию для мастера ставим таб «Продажи», для заказчика — «Покупки»
    if (currentUser.role === "printer") {
      currentTab = "printer";
    } else {
      currentTab = "customer";
    }

    renderUserMeta();
    renderKpis();
    renderOrders();
    bindEvents();
  }

  function renderGuestState() {
    const meta = $("dealsUserMeta");
    if (meta) {
      meta.innerHTML = `
        <button class="btn btn--primary btn--small" id="btnLoginDeals">Войти в аккаунт</button>
      `;
      $("btnLoginDeals")?.addEventListener("click", () => loginModal("customer", () => location.reload()));
    }

    const feed = $("dealsFeedContainer");
    if (feed) {
      feed.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:18px;padding:48px 24px;text-align:center;box-shadow:var(--shadow-sm)">
          <div style="font-size:48px;margin-bottom:12px">🛡️</div>
          <h2 style="font-size:22px;margin-bottom:6px">Управление сделками доступно после авторизации</h2>
          <p class="muted" style="max-width:480px;margin:0 auto 24px;font-size:14px;line-height:1.5">
            Войдите как заказчик или исполнитель для контроля производства деталей, согласования выдачи и безопасных выплат Гаранта NORD 3D.
          </p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn--primary" id="btnLogGuestCust">Войти как Заказчик «Сергей»</button>
            <button class="btn btn--ghost" id="btnLogGuestPrint">Войти как Мастер «Алексей К.»</button>
          </div>
        </div>
      `;

      $("btnLogGuestCust")?.addEventListener("click", () => {
        DB.setUser({ id: "c79990001122", name: "Сергей", phone: "+7 999 000-11-22", role: "customer" });
        location.reload();
      });
      $("btnLogGuestPrint")?.addEventListener("click", () => {
        DB.setUser({ id: "p79001112233", name: "Алексей К.", phone: "+7 900 111-22-33", role: "printer" });
        location.reload();
      });
    }
  }

  function renderUserMeta() {
    const meta = $("dealsUserMeta");
    if (!meta) return;

    const isP = currentUser.role === "printer";
    meta.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px">
        <div class="userchip" style="cursor:default">
          ${avatar(currentUser, 36)}
          <span>
            <b>${esc(currentUser.name)}</b>
            <small>${isP ? "🖨️ Мастер 3D-печати" : "🧑 Заказчик"}</small>
          </span>
        </div>
        <button class="btn btn--ghost btn--small" id="btnSwitchDealsUser" title="Переключить тестового пользователя">
          ${isP ? "Войти как Заказчик" : "Войти как Мастер"}
        </button>
      </div>
    `;

    $("btnSwitchDealsUser")?.addEventListener("click", () => {
      if (isP) {
        DB.setUser({ id: "c79990001122", name: "Сергей", phone: "+7 999 000-11-22", role: "customer" });
      } else {
        DB.setUser({ id: "p79001112233", name: "Алексей К.", phone: "+7 900 111-22-33", role: "printer" });
      }
      location.reload();
    });
  }

  function renderKpis() {
    const grid = $("dealsKpiGrid");
    if (!grid) return;

    const allOrders = DB.orders();
    const isP = currentUser.role === "printer";

    const myOrders = allOrders.filter((o) => {
      if (isP) return o.printerId === currentUser.id || o.invitedId === currentUser.id;
      return o.customerId === currentUser.id;
    });

    const activeCount = myOrders.filter((o) => o.status === "in_work" || o.status === "ready").length;
    const doneCount = myOrders.filter((o) => o.status === "done").length;
    
    // Сумма в холде гаранта
    const holdSum = myOrders
      .filter((o) => o.status === "in_work" || o.status === "ready")
      .reduce((acc, o) => acc + (Number(o.budget) || 0), 0);

    // Суммарно выполнено
    const totalVolume = myOrders
      .filter((o) => o.status === "done")
      .reduce((acc, o) => acc + (Number(o.budget) || 0), 0);

    grid.innerHTML = `
      <div class="kpi-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:18px 20px;box-shadow:var(--shadow-sm)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:24px">📦</span>
          <span class="chip chip--in-work" style="font-size:11px">В процессе</span>
        </div>
        <div style="font-size:26px;font-weight:800;color:var(--text);margin-bottom:4px">${activeCount}</div>
        <small class="muted" style="font-size:12.5px">Сделок в производстве и выдаче</small>
      </div>

      <div class="kpi-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:18px 20px;box-shadow:var(--shadow-sm)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:24px">🔒</span>
          <span class="chip chip--escrow" style="font-size:11px">Гарант NORD 3D</span>
        </div>
        <div style="font-size:26px;font-weight:800;color:var(--accent);margin-bottom:4px">${money(holdSum)}</div>
        <small class="muted" style="font-size:12.5px">${isP ? "Ожидает подтверждения приёмки" : "Заблокировано на гарантийном счёте"}</small>
      </div>

      <div class="kpi-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:18px 20px;box-shadow:var(--shadow-sm)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:24px">✓</span>
          <span class="chip" style="font-size:11px;background:rgba(16,185,129,0.12);color:#059669;border-color:rgba(16,185,129,0.3)">Успешно</span>
        </div>
        <div style="font-size:26px;font-weight:800;color:#0ca678;margin-bottom:4px">${doneCount}</div>
        <small class="muted" style="font-size:12.5px">Завершённых сделок без диспутов</small>
      </div>

      <div class="kpi-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:18px 20px;box-shadow:var(--shadow-sm)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:24px">💰</span>
          <span class="chip" style="font-size:11px">Оборот</span>
        </div>
        <div style="font-size:26px;font-weight:800;color:var(--text);margin-bottom:4px">${money(totalVolume)}</div>
        <small class="muted" style="font-size:12.5px">${isP ? "Заработано на заказах" : "Всего оплачено мастерам"}</small>
      </div>
    `;
  }

  function renderOrders() {
    const feed = $("dealsFeedContainer");
    if (!feed) return;

    const allOrders = DB.orders();
    const myId = currentUser.id;

    // Фильтрация по роли (FunPay табы)
    let list = allOrders.filter((o) => {
      const isMyCustomer = o.customerId === myId;
      const isMyPrinter = o.printerId === myId || o.invitedId === myId;

      if (currentTab === "customer") return isMyCustomer;
      if (currentTab === "printer") return isMyPrinter;
      return isMyCustomer || isMyPrinter;
    });

    // Фильтрация по статусу
    if (currentStatus !== "all") {
      list = list.filter((o) => o.status === currentStatus);
    }

    // Если передан конкретный заказ из URL (?id=...) — ставим его на первое место
    if (targetOrderId) {
      list.sort((a, b) => (a.id === targetOrderId ? -1 : (b.id === targetOrderId ? 1 : (b.createdAt || 0) - (a.createdAt || 0))));
    } else {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    // Обновляем визуальное состояние табов
    $("roleTabs")?.querySelectorAll(".deals-tab-btn").forEach((btn) => {
      const isActive = btn.dataset.tab === currentTab;
      btn.classList.toggle("active", isActive);
      btn.style.background = isActive ? "var(--bg-card)" : "transparent";
      btn.style.color = isActive ? "var(--text)" : "var(--text-muted)";
      btn.style.boxShadow = isActive ? "var(--shadow-sm)" : "none";
    });

    $("statusFilters")?.querySelectorAll(".tx-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.status === currentStatus);
    });

    if (!list.length) {
      feed.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:18px;padding:48px 24px;text-align:center;box-shadow:var(--shadow-sm)">
          <div style="font-size:44px;margin-bottom:12px">📋</div>
          <h3 style="font-size:18px;margin-bottom:6px">Сделок не найдено</h3>
          <p class="muted" style="max-width:440px;margin:0 auto 18px;font-size:13.5px;line-height:1.5">
            ${currentStatus !== "all" ? "В выбранной категории пока нет заказов. Попробуйте сбросить фильтры статуса." : "У вас пока нет активных сделок. Разместите заказ или откликнитесь на бирже!"}
          </p>
          <div style="display:flex;gap:10px;justify-content:center">
            ${currentStatus !== "all" ? `
              <button class="btn btn--small btn--ghost" id="btnResetStatusFilter">↺ Сбросить фильтры</button>
            ` : `
              <a href="order.html" class="btn btn--small btn--primary">🚀 Разместить заказ</a>
              <a href="orders.html" class="btn btn--small btn--ghost">🔍 Биржа заказов</a>
            `}
          </div>
        </div>
      `;

      $("btnResetStatusFilter")?.addEventListener("click", () => {
        currentStatus = "all";
        renderOrders();
      });
      return;
    }

    feed.innerHTML = list.map((o) => renderOrderDealCard(o)).join("");
    bindDealActions(feed, list);
  }

  // Генерация карточки сделки в стиле FunPay
  function renderOrderDealCard(o) {
    const isTarget = targetOrderId && o.id === targetOrderId;
    const isCustomer = o.customerId === currentUser.id;
    const isPrinter = o.printerId === currentUser.id || o.invitedId === currentUser.id;

    const printer = DB.printer(o.printerId || o.invitedId);
    const counterpartyName = isCustomer
      ? (printer ? printer.name : "Мастер не назначен")
      : (o.customerName || "Заказчик");
    const counterpartyAvatar = isCustomer
      ? (printer ? printer.avatar : null)
      : null;

    const budget = Number(o.budget) || 0;
    const commPct = o.escrowCommissionPercent !== undefined ? o.escrowCommissionPercent : 10;
    const commVal = Math.round(budget * commPct / 100);
    const payout = Math.max(0, budget - commVal);

    const isScan = o.type === "scan";
    const fileExt = isScan ? "СКАН" : (o.file?.name?.split(".").pop()?.toUpperCase() || "3D");

    // Определение этапов сделки (FunPay Timeline)
    const step1 = true; // Оплата / холд
    const step2 = o.status === "in_work" || o.status === "ready" || o.status === "done"; // В работе
    const step3 = o.status === "ready" || o.status === "done"; // Готово к выдаче
    const step4 = o.status === "done"; // Приёмка и закрытие
    const step5 = o.status === "done" && (o.hasReviewed || (DB.reviews(o.printerId || "").some((r) => r.orderId === o.id))); // Отзыв

    // Ссылка на чат
    const chatUrl = `cabinet.html?customer=${encodeURIComponent(o.customerId)}&printer=${encodeURIComponent(o.printerId || o.invitedId || "")}&order=${encodeURIComponent(o.id)}`;

    return `
      <div class="deal-card ${isTarget ? 'deal-card--target' : ''}" data-order-id="${esc(o.id)}" style="background:var(--bg-card);border:${isTarget ? '2px solid var(--accent)' : '1px solid var(--border)'};border-radius:18px;padding:24px;box-shadow:var(--shadow-sm);transition:all .2s">
        
        <!-- Верхняя шапка сделки: номер, дата, статус и сумма -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="file-badge ${isScan ? 'file-badge--scan' : ''}">${fileExt}</span>
            <div>
              <b style="font-size:17px;color:var(--text)">Заказ #${esc(o.id)}: ${esc(o.title)}</b>
              <div class="muted" style="font-size:12px;margin-top:2px">
                Создан: ${date(o.createdAt)}, ${new Date(o.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                ${o.deadline ? `· Срок сдачи: <b>${date(o.deadline)}</b>` : ""}
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:10px">
            <span class="status ${STATUS[o.status]?.cls || ''}">${STATUS[o.status]?.label || o.status}</span>
            <div style="font-size:20px;font-weight:800;color:var(--accent);letter-spacing:-0.5px">${money(budget)}</div>
          </div>
        </div>

        <!-- Центральный блок: Детали детали + Участник сделки -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:20px">
          
          <!-- Характеристики заказа -->
          <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:12px;padding:14px">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Спецификация изделия</div>
            <div class="chips" style="gap:6px;margin-bottom:10px">
              <span class="chip chip--${(o.material || 'PLA').toLowerCase()}">${o.material || 'PLA'}</span>
              <span class="chip">Цвет: ${esc(o.color || 'Любой')}</span>
              <span class="chip">${o.qty || 1} шт.</span>
              ${o.infill ? `<span class="chip">Заполнение: ${o.infill}%</span>` : ''}
              <span class="chip">📍 ${esc(o.district || 'Норильск')}</span>
              ${o.urgent ? `<span class="chip chip--urgent">⚡ СРОЧНО</span>` : ''}
              ${o.escrow ? `<span class="chip chip--escrow">🛡️ Гарант</span>` : ''}
            </div>
            ${o.comment ? `<p style="margin:0;font-size:12.5px;color:var(--text);background:var(--bg-card);padding:8px 10px;border-radius:8px;border:1px solid var(--border)">💬 <i>«${esc(o.comment)}»</i></p>` : ''}
          </div>

          <!-- Контрагент сделки (Мастер / Заказчик) -->
          <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
                ${isCustomer ? "Исполнитель (Мастер 3D-печати)" : "Заказчик детали"}
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;overflow:hidden">
                  ${counterpartyAvatar ? `<img src="${counterpartyAvatar}" style="width:100%;height:100%;object-fit:cover" />` : counterpartyName.charAt(0)}
                </div>
                <div>
                  <b style="font-size:14.5px;color:var(--text)">${esc(counterpartyName)}</b>
                  <div class="muted" style="font-size:12px">
                    ${isCustomer && printer ? `⭐ ${printer.rating || 5.0} · ${esc(printer.equipment || "3D-принтер")} · ${esc(printer.district || "Норильск")}` : (isCustomer ? (o.responses && o.responses.length > 0 ? `✅ Приняли заказ: ${o.responses.length} ${o.responses.length === 1 ? 'мастер' : 'мастера'}` : "⏳ Ожидание принятия заказа мастером") : "Заказчик платформы")}
                  </div>
                </div>
              </div>
            </div>

            <div style="margin-top:12px">
              <a href="${chatUrl}" class="btn btn--small btn--ghost" style="width:100%;text-align:center;box-sizing:border-box">
                💬 Написать в чат диалога
              </a>
            </div>
          </div>

        </div>

        <!-- FunPay Timeline: 5 Этапов сделки -->
        <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">
            🛡️ Этапы безопасной сделки Гарант NORD 3D
          </div>
          <div class="deal-timeline" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px">
            
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:${step1 ? '#0ca678' : 'var(--border)'};color:#fff;align-items:center;justify-content:center;font-size:11px;font-weight:800">✓</span>
                <b style="font-size:12px;color:${step1 ? 'var(--text)' : 'var(--text-muted)'}">1. Оплата</b>
              </div>
              <small class="muted" style="font-size:11px">Зарезервировано</small>
            </div>

            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:${step2 ? '#0ca678' : 'var(--border)'};color:#fff;align-items:center;justify-content:center;font-size:11px;font-weight:800">${step2 ? '✓' : '2'}</span>
                <b style="font-size:12px;color:${step2 ? 'var(--text)' : 'var(--text-muted)'}">2. Печать</b>
              </div>
              <small class="muted" style="font-size:11px">${step3 ? 'Деталь готова' : (step2 ? 'В производстве' : 'Ожидает')}</small>
            </div>

            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:${step3 ? '#0ca678' : 'var(--border)'};color:#fff;align-items:center;justify-content:center;font-size:11px;font-weight:800">${step3 ? '✓' : '3'}</span>
                <b style="font-size:12px;color:${step3 ? 'var(--text)' : 'var(--text-muted)'}">3. Выдача</b>
              </div>
              <small class="muted" style="font-size:11px">${step3 ? 'Готово к выдаче' : 'Ожидает печати'}</small>
            </div>

            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:${step4 ? '#0ca678' : 'var(--border)'};color:#fff;align-items:center;justify-content:center;font-size:11px;font-weight:800">${step4 ? '✓' : '4'}</span>
                <b style="font-size:12px;color:${step4 ? 'var(--text)' : 'var(--text-muted)'}">4. Приёмка</b>
              </div>
              <small class="muted" style="font-size:11px">${step4 ? 'Работа принята' : 'Ожидает проверки'}</small>
            </div>

            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:${step5 ? '#0ca678' : 'var(--border)'};color:#fff;align-items:center;justify-content:center;font-size:11px;font-weight:800">${step5 ? '✓' : '5'}</span>
                <b style="font-size:12px;color:${step5 ? 'var(--text)' : 'var(--text-muted)'}">5. Отзыв</b>
              </div>
              <small class="muted" style="font-size:11px">${step5 ? 'Отзыв опубликован' : 'Оценка мастера'}</small>
            </div>

          </div>
        </div>

        <!-- Нижний блок: Финансы + Кнопки управления сделкой -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;padding-top:14px;border-top:1px solid var(--border)">
          
          <!-- Финансовый статус -->
          <div style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <span>Сумма сделки: <b style="color:var(--text)">${money(budget)}</b></span>
            <span>Выплата мастеру: <b style="color:#0ca678">${money(payout)}</b></span>
            <span>Комиссия: <b>${money(commVal)} (10%)</b></span>
            ${o.status === "done" ? `
              <span class="badge" style="background:rgba(16,185,129,0.12);color:#059669;border:1px solid rgba(16,185,129,0.3);font-size:11.5px;font-weight:700">
                💰 Средства выплачены мастеру
              </span>
            ` : `
              <span class="badge" style="background:rgba(2,132,199,0.12);color:#0284c7;border:1px solid rgba(2,132,199,0.3);font-size:11.5px;font-weight:700">
                🔒 Средства в гаранте NORD 3D
              </span>
            `}
          </div>

          <!-- Панель кнопок управления сделкой -->
          <div class="deal-actions-bar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            
            <!-- Кнопка назначения мастера: заказчик может назначить ТОЛЬКО после того, как мастер принял заказ -->
            ${isCustomer && (o.status === "open" || !o.printerId) ? `
              ${(o.responses && o.responses.length > 0) ? `
                <button class="btn btn--primary btn-assign-master" data-order-id="${esc(o.id)}" style="background:linear-gradient(135deg, #10b981, #059669);font-weight:800">
                  🤝 Назначить исполнителя (${o.responses.length})
                </button>
              ` : `
                <span class="badge" style="background:var(--bg-subtle);color:var(--text-muted);border:1px dashed var(--border);font-size:12px;padding:8px 12px;display:inline-flex;align-items:center;gap:6px" title="Заказчик может назначить мастера только после того, как мастер примет заказ">
                  ⏳ Заказ ещё не принят мастером
                </span>
              `}
            ` : ''}

            <!-- Для мастера при открытом заказе: кнопка принять заказ -->
            ${isPrinter && o.status === "open" && !((o.responses || []).some(r => r.printerId === currentUser.id)) ? `
              <button class="btn btn--primary btn-accept-order" data-order-id="${esc(o.id)}" style="background:linear-gradient(135deg, #0ca678, #099268);font-weight:800">
                📥 Принять заказ (${money(budget)})
              </button>
            ` : ''}

            <!-- Кнопка для мастера при статусе in_work -->
            ${isPrinter && o.status === "in_work" ? `
              <button class="btn btn--primary btn-mark-ready" data-order-id="${esc(o.id)}" style="background:linear-gradient(135deg, #0284c7, #0369a1);font-weight:800">
                📦 Отметить готовность к выдаче
              </button>
            ` : ''}

            <!-- Кнопка для заказчика при статусе ready (или in_work) -->
            ${isCustomer && (o.status === "ready" || o.status === "in_work") ? `
              <button class="btn btn--primary btn-complete-order" data-order-id="${esc(o.id)}" style="background:linear-gradient(135deg, #10b981, #059669);font-weight:800">
                🛡️ Подтвердить приёмку и выплатить мастеру (${money(payout)})
              </button>
            ` : ''}

            <!-- Кнопка отзыва для заказчика при done -->
            ${isCustomer && o.status === "done" && !step5 ? `
              <button class="btn btn--primary btn-rate-order" data-order-id="${esc(o.id)}" style="font-weight:800">
                ⭐ Оставить отзыв о мастере
              </button>
            ` : ''}

            ${o.status === "done" && step5 ? `
              <span class="badge" style="background:rgba(14,165,233,0.12);color:#0284c7;border:1px solid rgba(14,165,233,0.3);font-size:12px;font-weight:700">
                ✓ Сделка завершена и оценена (${stars(o.rating || 5)})
              </span>
            ` : ''}

            <a href="${chatUrl}" class="btn btn--ghost" style="font-size:13px">
              💬 Чат
            </a>
          </div>

        </div>

      </div>
    `;
  }

  // Привязка обработчиков действий
  function bindDealActions(container, orders) {
    // 0. Назначение мастера заказчиком (только после принятия заказа мастером)
    container.querySelectorAll(".btn-assign-master").forEach((btn) => {
      btn.onclick = () => {
        const orderId = btn.dataset.orderId;
        const o = orders.find((x) => x.id === orderId);
        if (o) openAssignMasterModal(o);
      };
    });

    // 0.1 Принятие заказа мастером
    container.querySelectorAll(".btn-accept-order").forEach((btn) => {
      btn.onclick = () => {
        const orderId = btn.dataset.orderId;
        const o = orders.find((x) => x.id === orderId);
        if (!o) return;

        DB.updateOrder(orderId, (item) => {
          item.responses = item.responses || [];
          if (!item.responses.some((r) => r.printerId === currentUser.id)) {
            item.responses.push({
              id: "r" + Date.now().toString(36),
              printerId: currentUser.id,
              price: item.budget,
              days: 2,
              comment: "Готов выполнить печать по указанной стоимости",
              createdAt: Date.now()
            });
          }
        });

        if (o.customerId) {
          Chat.sendMessage(
            o.customerId,
            currentUser.id,
            o.id,
            `👋 Здравствуйте! Я принял ваш заказ #${o.id} («${o.title}»). Готов выполнить печать за ${money(o.budget)}. Вы можете утвердить сделку в разделе «Мои заказы»!`
          );
        }

        toast(`Вы приняли заказ #${o.id}! Заказчик получил уведомление и теперь может утвердить вас исполнителем.`);
        renderKpis();
        renderOrders();
      };
    });

    // 1. Мастер отмечает готовность изделия
    container.querySelectorAll(".btn-mark-ready").forEach((btn) => {
      btn.onclick = () => {
        const orderId = btn.dataset.orderId;
        const o = orders.find((x) => x.id === orderId);
        if (!o) return;

        DB.updateOrder(orderId, (item) => {
          item.status = "ready";
        });

        if (o.customerId) {
          Chat.sendMessage(
            o.customerId,
            currentUser.id,
            o.id,
            `📦 Заказ #${o.id} («${o.title}») полностью напечатан и готов к выдаче! Вы можете забрать готовые детали или согласовать доставку.`
          );
        }

        toast(`Заказ #${o.id} отмечен как готовый к выдаче! Заказчик получил уведомление.`);
        renderKpis();
        renderOrders();
      };
    });

    // 2. Заказчик подтверждает получение изделия и производит выплату мастеру
    container.querySelectorAll(".btn-complete-order").forEach((btn) => {
      btn.onclick = () => {
        const orderId = btn.dataset.orderId;
        const o = orders.find((x) => x.id === orderId);
        if (!o) return;

        const commPct = o.escrowCommissionPercent !== undefined ? o.escrowCommissionPercent : 10;
        const payout = Math.max(0, Math.round((Number(o.budget) || 0) * (1 - commPct / 100)));
        const targetPrinterId = o.printerId || o.invitedId;

        openModal(`
          <div class="modal-confirm-box">
            <div style="font-size:42px;margin-bottom:12px">🛡️</div>
            <h3 style="font-size:20px;font-weight:800;margin-bottom:8px">Подтвердить приёмку изделия?</h3>
            <p class="muted" style="font-size:13.5px;line-height:1.5;margin-bottom:24px">
              Вы подтверждаете, что получили деталь по заказу <b>#${esc(o.id)}</b> и проверили её качество.<br><br>
              Гарант NORD 3D перечислит вознаграждение <b>${money(payout)}</b> исполнителю на баланс кошелька.
            </p>
            <div class="modal-confirm-actions">
              <button class="btn btn--ghost" id="btnCancelComplete" style="min-width:110px;height:48px">Отмена</button>
              <button class="btn btn--primary" id="btnConfirmComplete" style="background:linear-gradient(135deg, #10b981, #059669);font-weight:800;flex:1;height:48px;white-space:nowrap">
                Подтвердить и выплатить ${money(payout)}
              </button>
            </div>
          </div>
        `, "modal__box--narrow");

        $("btnCancelComplete")?.addEventListener("click", closeModal);
        $("btnConfirmComplete")?.addEventListener("click", () => {
          closeModal();
          const res = DB.completeOrder(o.id, { printerId: targetPrinterId });
          const payoutAmount = res?.payout || payout;

          if (targetPrinterId) {
            Chat.sendMessage(
              currentUser.id,
              targetPrinterId,
              o.id,
              `🎉 Заказ #${o.id} получен и проверен! Спасибо за работу! Выплата ${money(payoutAmount)} успешно поступила на ваш баланс.`
            );
          }

          toast(`Сделка успешно завершена! Выплата ${money(payoutAmount)} перечислена мастеру.`);
          renderKpis();
          renderOrders();

          // Сразу открываем модалку для отзыва о мастере
          setTimeout(() => {
            if (N3D.openReviewModal) {
              N3D.openReviewModal(DB.order(orderId), () => {
                renderKpis();
                renderOrders();
              });
            }
          }, 400);
        });
      };
    });

    // 3. Отзыв о мастере
    container.querySelectorAll(".btn-rate-order").forEach((btn) => {
      btn.onclick = () => {
        const orderId = btn.dataset.orderId;
        const o = orders.find((x) => x.id === orderId);
        if (o && N3D.openReviewModal) {
          N3D.openReviewModal(o, () => {
            renderKpis();
            renderOrders();
          });
        }
      };
    });
  }

  // Модальное окно выбора исполнителя (ТОЛЬКО среди мастеров, принявших заказ)
  function openAssignMasterModal(order) {
    const responses = order.responses || [];

    // Заказчик может назначить исполнителя ТОЛЬКО после того, как мастер принял заказ (откликнулся)
    const candidates = [];
    const addedIds = new Set();

    responses.forEach((r) => {
      const p = DB.printer(r.printerId);
      if (p && !addedIds.has(p.id)) {
        candidates.push({
          printer: p,
          price: r.price,
          days: r.days || 2,
          note: r.comment || "Принял заказ на бирже"
        });
        addedIds.add(p.id);
      }
    });

    if (!candidates.length) {
      toast("Исполнитель ещё не принял данный заказ. Дождитесь, пока мастер примет заказ!");
      return;
    }

    const modalBox = openModal(`
      <div class="modal-form-wrap" style="max-width:540px;margin:0 auto;padding:4px">
        <div style="text-align:center;margin-bottom:18px">
          <div style="font-size:38px;margin-bottom:6px">🤝</div>
          <h2 style="font-size:22px;margin-bottom:4px">Мастера, принявшие заказ</h2>
          <p class="muted" style="font-size:13.5px;margin:0">
            Заказ #${esc(order.id)} «${esc(order.title)}» · Откликов: <b>${candidates.length}</b>
          </p>
        </div>

        <div style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding-right:4px;margin-bottom:18px">
          ${candidates.map((c) => {
            const p = c.printer;
            return `
              <div class="assign-printer-row" style="display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--bg-subtle);border:1px solid var(--border);border-radius:14px;padding:12px 14px">
                <div style="display:flex;align-items:center;gap:10px">
                  ${avatar(p, 42)}
                  <div>
                    <div style="display:flex;align-items:center;gap:6px">
                      <b style="font-size:14px;color:var(--text)">${esc(p.name)}</b>
                      <span style="font-size:12px;color:#f59f00">★ ${p.rating || 5.0}</span>
                    </div>
                    <small class="muted" style="font-size:12px;display:block">
                      ${esc(p.equipment || "3D-принтер")} · 📍 ${esc(p.district || "Норильск")}
                    </small>
                    <div style="font-size:12px;color:var(--text);margin-top:2px">
                      Цена мастера: <b style="color:var(--accent)">${money(c.price)}</b> · Срок: <b>${c.days} дн.</b>
                    </div>
                    <small class="accent" style="font-size:11.5px;font-weight:600;display:block;margin-top:2px">
                      💬 ${esc(c.note)}
                    </small>
                  </div>
                </div>

                <button class="btn btn--small btn--primary btn-pick-this-printer" data-printer-id="${esc(p.id)}" data-price="${c.price || order.budget}" style="font-weight:800;padding:8px 16px;background:linear-gradient(135deg, #10b981, #059669)">
                  Утвердить
                </button>
              </div>
            `;
          }).join("")}
        </div>

        <div style="display:flex;justify-content:flex-end">
          <button class="btn btn--ghost" id="btnCancelAssignModal">Закрыть</button>
        </div>
      </div>
    `);

    modalBox.querySelector("#btnCancelAssignModal")?.addEventListener("click", closeModal);

    modalBox.querySelectorAll(".btn-pick-this-printer").forEach((btn) => {
      btn.onclick = () => {
        const printerId = btn.dataset.printerId;
        const agreedPrice = Number(btn.dataset.price) || order.budget;
        const p = DB.printer(printerId);

        DB.updateOrder(order.id, (o) => {
          o.printerId = printerId;
          o.status = "in_work";
          o.budget = agreedPrice;
          o.assignedAt = Date.now();
        });

        Chat.sendMessage(
          currentUser.id,
          printerId,
          order.id,
          `🤝 Здравствуйте! Я выбрал вас исполнителем заказа #${order.id} («${order.title}»)! Сделка перешла в статус «В производстве». Жду готовые детали!`
        );

        closeModal();
        toast(`Мастер ${p ? p.name : ""} успешно назначен исполнителем заказа #${order.id}!`);
        renderKpis();
        renderOrders();
      };
    });
  }

  function bindEvents() {
    // Переключение FunPay табов (Все / Покупки / Продажи)
    $("roleTabs")?.querySelectorAll(".deals-tab-btn").forEach((btn) => {
      btn.onclick = () => {
        currentTab = btn.dataset.tab;
        targetOrderId = null;
        renderOrders();
      };
    });

    // Переключение фильтров статуса
    $("statusFilters")?.querySelectorAll(".tx-pill").forEach((btn) => {
      btn.onclick = () => {
        currentStatus = btn.dataset.status;
        targetOrderId = null;
        renderOrders();
      };
    });

    // Живое обновление при изменении данных
    window.addEventListener("n3d:data-updated", () => {
      renderKpis();
      renderOrders();
    });
    window.addEventListener("n3d:wallet-updated", () => {
      renderKpis();
      renderOrders();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
