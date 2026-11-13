// 3ДСосед — Полноценный раздел «Кошелёк» для заказчиков и исполнителей
(() => {
  "use strict";

  const { DB, esc, money, date, ago, avatar, toast, openModal, closeModal, loginModal } = N3D;

  const $ = (id) => document.getElementById(id);
  let currentUser = DB.user();
  let currentFilter = "all";

  function init() {
    currentUser = DB.user();
    if (!currentUser) {
      renderGuestState();
      return;
    }
    renderHeaderMeta();
    renderKpis();
    renderHolds();
    renderTransactions();
    bindEvents();
  }

  // Гостевое состояние
  function renderGuestState() {
    $("walletSubtitle").textContent = "Войдите в аккаунт, чтобы просматривать баланс кошелька, холды гаранта и историю платежей.";
    $("walletUserMeta").innerHTML = `
      <div style="text-align:right">
        <b>Не авторизован</b>
        <small class="muted" style="display:block">Демо-доступ</small>
      </div>
    `;
    $("switchWalletUserBtn").textContent = "Войти в демо-аккаунт";
    $("switchWalletUserBtn").onclick = () => {
      loginModal("customer", () => location.reload());
    };

    $("walletKpiGrid").innerHTML = `
      <div class="wallet-empty-box" style="grid-column: 1 / -1">
        <div style="font-size:48px;margin-bottom:12px">💳</div>
        <h3>Кошелёк доступен после входа</h3>
        <p class="muted" style="max-width:480px;margin:0 auto 20px">
          Выберите роль для мгновенного входа и тестирования финансового функционала 3ДСосед:
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn--primary" id="btnLogCust">Войти как Заказчик «Сергей» (14 300 ₽)</button>
          <button class="btn btn--ghost" id="btnLogPrint">Войти как Мастер «Алексей К.» (38 600 ₽)</button>
        </div>
      </div>
    `;

    $("btnLogCust")?.addEventListener("click", () => {
      DB.setUser({ id: "c79990001122", name: "Сергей", phone: "+7 999 000-11-22", role: "customer" });
      location.reload();
    });
    $("btnLogPrint")?.addEventListener("click", () => {
      DB.setUser({ id: "p79001112233", name: "Алексей К.", phone: "+7 900 111-22-33", role: "printer" });
      location.reload();
    });

    $("txFeedContainer").innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-muted)">
        История транзакций доступна после авторизации.
      </div>
    `;
  }

  // Метаданные пользователя в шапке
  function renderHeaderMeta() {
    const isP = currentUser.role === "printer";
    $("walletSubtitle").textContent = isP
      ? "Управление заработанными средствами, вывод на банковские карты и СБП, контроль выплат по безопасным сделкам."
      : "Управление балансом для оплаты заказов, мониторинг средств на гарантийном счёте Гарант 3ДСосед и пополнение.";

    $("walletUserMeta").innerHTML = `
      <div class="userchip" style="cursor:default">
        ${avatar(currentUser, 36)}
        <span>
          <b>${esc(currentUser.name)}</b>
          <small>${isP ? "🖨️ Мастер 3D-печати" : "🧑 Заказчик"}</small>
        </span>
      </div>
    `;

    $("switchWalletUserBtn").textContent = isP ? "Переключить на Заказчика Сергея" : "Переключить на Мастера Алексея К.";
    $("switchWalletUserBtn").onclick = () => {
      if (isP) {
        DB.setUser({ id: "c79990001122", name: "Сергей", phone: "+7 999 000-11-22", role: "customer" });
      } else {
        DB.setUser({ id: "p79001112233", name: "Алексей К.", phone: "+7 900 111-22-33", role: "printer" });
      }
      location.reload();
    };
  }

  // 4 Ключевые карточки состояния средств
  function renderKpis() {
    const w = DB.wallet(currentUser.id);
    const isP = currentUser.role === "printer";

    $("walletKpiGrid").innerHTML = `
      <!-- Карточка 1: Доступный баланс -->
      <div class="wallet-kpi-card wallet-kpi--balance">
        <div class="kpi-card-head">
          <span class="kpi-icon">💰</span>
          <span class="kpi-badge kpi-badge--active">Доступно</span>
        </div>
        <div class="kpi-amount">${money(w.balance)}</div>
        <p class="kpi-desc">
          ${isP ? "Доступно для моментального вывода на карту или СБП" : "Доступно для безопасной оплаты 3D-печати"}
        </p>
        <div class="kpi-quick-actions">
          <button class="btn btn--small btn--primary" id="btnQuickDeposit">+ Пополнить</button>
          <button class="btn btn--small btn--ghost" id="btnQuickWithdraw">↗ Вывести</button>
        </div>
      </div>

      <!-- Карточка 2: На холде (Гарант 3ДСосед) -->
      <div class="wallet-kpi-card wallet-kpi--hold">
        <div class="kpi-card-head">
          <span class="kpi-icon">🔒</span>
          <span class="kpi-badge kpi-badge--hold">${w.hold > 0 ? "В удержании" : "Нет холдов"}</span>
        </div>
        <div class="kpi-amount">${money(w.hold)}</div>
        <p class="kpi-desc">
          ${isP ? "Ожидает подтверждения приёмки готовых деталей заказчиком" : "Заблокировано на гарантийном счёте платформы по активным заказам"}
        </p>
        <div class="kpi-note">
          🛡️ Гарант 3ДСосед: деньги защищены до проверки
        </div>
      </div>

      <!-- Карточка 3: Всего поступило -->
      <div class="wallet-kpi-card wallet-kpi--in">
        <div class="kpi-card-head">
          <span class="kpi-icon">📥</span>
          <span class="kpi-badge kpi-badge--in">Поступления</span>
        </div>
        <div class="kpi-amount text-success">+${money(w.totalIn)}</div>
        <p class="kpi-desc">
          ${isP ? "Суммарно заработано и выплачено за всё время" : "Всего зачислено через СБП и банковские карты"}
        </p>
        <div class="kpi-submeta">
          <span>Сделок без диспутов: <b>100%</b></span>
        </div>
      </div>

      <!-- Карточка 4: Всего ушло -->
      <div class="wallet-kpi-card wallet-kpi--out">
        <div class="kpi-card-head">
          <span class="kpi-icon">📤</span>
          <span class="kpi-badge kpi-badge--out">Расход</span>
        </div>
        <div class="kpi-amount text-muted">-${money(w.totalOut)}</div>
        <p class="kpi-desc">
          ${isP ? "Успешно выведено на личные банковские карты" : "Оплачено выполненных заказов мастерам Норильска"}
        </p>
        <div class="kpi-submeta">
          <span>Комиссия за вывод: <b>0 ₽</b></span>
        </div>
      </div>
    `;

    $("btnQuickDeposit")?.addEventListener("click", openDepositModal);
    $("btnQuickWithdraw")?.addEventListener("click", openWithdrawModal);
  }

  // Блок активных холдов (если есть)
  function renderHolds() {
    const w = DB.wallet(currentUser.id);
    const holdSec = $("walletHoldSection");
    if (!holdSec) return;

    if (w.hold <= 0) {
      holdSec.style.display = "none";
      return;
    }

    holdSec.style.display = "block";
    const isP = currentUser.role === "printer";
    const orders = DB.orders().filter((o) => {
      if (isP) {
        return o.printerId === currentUser.id && o.status !== "done" && o.status !== "cancelled";
      } else {
        return o.customerId === currentUser.id && o.status !== "done" && o.status !== "cancelled";
      }
    });

    if (!orders.length) {
      $("walletHoldsList").innerHTML = `
        <div class="hold-item-card">
          <div class="hold-item-icon">🔒</div>
          <div class="hold-item-info">
            <b>Гарантийный холд платформы</b>
            <small class="muted">Зарезервированная сумма безопасной сделки: ${money(w.hold)}</small>
          </div>
          <div class="hold-item-amount">${money(w.hold)}</div>
        </div>
      `;
      return;
    }

    $("walletHoldsList").innerHTML = orders.map((o) => `
      <div class="hold-item-card">
        <div class="hold-item-main">
          <div class="hold-item-icon">🔒</div>
          <div class="hold-item-info">
            <b>Заказ #${esc(o.id)}: ${esc(o.title)}</b>
            <small class="muted">
              Статус: <b>${o.status === "in_work" ? "В производстве" : (o.status === "ready" ? "Готов к выдаче" : "Открыт")}</b> · 
              ${isP ? `Заказчик: ${esc(o.customerName)}` : `Мастер: ${esc(DB.printer(o.printerId)?.name || "Не назначен")}`}
            </small>
          </div>
        </div>
        <div class="hold-item-right">
          <div class="hold-item-amount">${money(isP ? ((o.payoutToPrinter || Math.round(o.budget * 0.9))) : o.budget)}</div>
          <a href="cabinet.html?order=${encodeURIComponent(o.id)}" class="btn btn--tiny btn--ghost">Открыть в сообщениях</a>
        </div>
      </div>
    `).join("");
  }

  // Лента транзакций с фильтрацией
  function renderTransactions() {
    const query = ($("txSearchInput")?.value || "").toLowerCase().trim();
    const w = DB.wallet(currentUser.id);
    let allUserTx = DB.transactions(currentUser.id);

    // Если у пользователя есть баланс или поступления, но список транзакций пуст — восстанавливаем транзакцию без двойного начисления баланса
    if (!allUserTx.length && (w.balance > 0 || w.totalIn > 0)) {
      const allTx = N3D.load ? N3D.load("n3d_transactions", []) : [];
      allTx.unshift({
        id: "tx_" + Date.now().toString(36),
        userId: currentUser.id,
        type: "deposit",
        amount: w.balance || 5000,
        title: "Пополнение баланса",
        desc: "Зачисление средств через СБП (Система Быстрых Платежей) · 0% комиссия",
        status: "success",
        method: "sbp",
        date: Date.now() - 3600000 * 2,
        fee: 0
      });
      if (N3D.save) N3D.save("n3d_transactions", allTx);
      allUserTx = DB.transactions(currentUser.id);
    }

    let list = allUserTx;

    // Фильтр по типу
    if (currentFilter !== "all") {
      list = list.filter((t) => t.type === currentFilter);
    }

    // Фильтр по поисковому запросу
    if (query) {
      list = list.filter((t) => {
        return (t.title || "").toLowerCase().includes(query) ||
               (t.desc || "").toLowerCase().includes(query) ||
               (t.orderTitle || "").toLowerCase().includes(query) ||
               (t.orderId || "").toLowerCase().includes(query);
      });
    }

    const container = $("txFeedContainer");
    if (!list.length) {
      container.innerHTML = `
        <div class="tx-empty-state">
          <div class="tx-empty-state__icon">📜</div>
          <div class="tx-empty-state__title">Операций не найдено</div>
          <p class="tx-empty-state__desc">
            ${query ? `По запросу «${esc(query)}» ничего не найдено. Попробуйте изменить поисковый запрос или сбросить фильтры.` : (currentFilter !== "all" ? "В данной категории пока не было движений средств." : "История операций пока пуста. Пополните баланс для оплаты заказов.")}
          </p>
          <div class="tx-empty-state__actions">
            ${query || currentFilter !== "all" ? `
              <button class="btn btn--small btn--ghost" id="btnResetTxFilters">↺ Сбросить фильтры</button>
            ` : `
              <button class="btn btn--small btn--primary" id="btnEmptyDeposit">💳 Пополнить баланс</button>
            `}
          </div>
        </div>
      `;

      container.querySelector("#btnResetTxFilters")?.addEventListener("click", () => {
        if ($("txSearchInput")) $("txSearchInput").value = "";
        $("txFilters")?.querySelectorAll(".tx-pill").forEach((b) => {
          b.classList.toggle("active", b.dataset.filter === "all");
        });
        currentFilter = "all";
        renderTransactions();
      });

      container.querySelector("#btnEmptyDeposit")?.addEventListener("click", openDepositModal);
      return;
    }

    container.innerHTML = `
      <div class="tx-list">
        ${list.map((t) => {
          let icon = "📥";
          let badgeCls = "tx-badge--success";
          let amountPrefix = "+";
          let amountCls = "tx-amount--plus";

          if (t.type === "deposit") {
            icon = "📥";
            badgeCls = "tx-badge--success";
            amountPrefix = "+";
            amountCls = "tx-amount--plus";
          } else if (t.type === "withdraw") {
            icon = "📤";
            badgeCls = "tx-badge--withdraw";
            amountPrefix = "-";
            amountCls = "tx-amount--minus";
          } else if (t.type === "hold") {
            icon = "🔒";
            badgeCls = "tx-badge--hold";
            amountPrefix = "🔒 ";
            amountCls = "tx-amount--hold";
          } else if (t.type === "payment") {
            icon = "💳";
            badgeCls = "tx-badge--payment";
            amountPrefix = "-";
            amountCls = "tx-amount--minus";
          } else if (t.type === "payout") {
            icon = "💰";
            badgeCls = "tx-badge--success";
            amountPrefix = "+";
            amountCls = "tx-amount--plus";
          }

          const statusText = t.status === "hold" ? "На удержании" : (t.status === "pending" ? "В обработке" : "Зачислено");

          return `
            <div class="tx-row" data-tx-id="${t.id}">
              <div class="tx-row__icon-wrap">
                <span class="tx-icon">${icon}</span>
              </div>
              <div class="tx-row__main">
                <div class="tx-row__title-line">
                  <b class="tx-title">${esc(t.title)}</b>
                  <span class="tx-badge ${badgeCls}">${statusText}</span>
                </div>
                <div class="tx-row__desc">
                  ${esc(t.desc || "")}
                  ${t.orderId ? `<a href="cabinet.html?order=${encodeURIComponent(t.orderId)}" class="tx-order-link" onclick="event.stopPropagation()">Заказ #${esc(t.orderId)}</a>` : ""}
                </div>
                <div class="tx-row__date muted">${date(t.date)}, ${new Date(t.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div class="tx-row__right">
                <div class="tx-amount ${amountCls}">
                  ${amountPrefix}${money(t.amount)}
                </div>
                ${t.fee ? `<small class="tx-fee muted">комиссия ${money(t.fee)}</small>` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    // Клик по строке открывает квитанцию
    container.querySelectorAll(".tx-row").forEach((el) => {
      el.onclick = () => {
        const txId = el.dataset.txId;
        const tx = list.find((x) => x.id === txId);
        if (tx) openReceiptModal(tx);
      };
    });
  }

  // Привязка событий
  function bindEvents() {
    $("btnOpenDepositModal")?.addEventListener("click", openDepositModal);
    $("btnOpenWithdrawModal")?.addEventListener("click", openWithdrawModal);

    $("txSearchInput")?.addEventListener("input", renderTransactions);

    $("txFilters")?.querySelectorAll(".tx-pill").forEach((btn) => {
      btn.onclick = () => {
        $("txFilters").querySelectorAll(".tx-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        renderTransactions();
      };
    });

    window.addEventListener("n3d:wallet-updated", () => {
      renderKpis();
      renderHolds();
      renderTransactions();
    });
  }

  // Модальное окно пополнения баланса
  function openDepositModal() {
    const box = openModal(`
      <div class="modal-form-wrap" style="max-width:480px;margin:0 auto">
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:42px;margin-bottom:6px">💳</div>
          <h2 style="font-size:22px;margin-bottom:4px">Пополнение баланса</h2>
          <p class="muted" style="font-size:13px">Моментальное зачисление средств без комиссии через СБП или банковские карты</p>
        </div>

        <form id="depositForm" class="form">
          <div class="field">
            <label>Сумма пополнения (₽) <span class="req">*</span></label>
            <div class="input-with-icon has-suffix">
              <span class="input-icon">💰</span>
              <input type="number" id="depAmountInput" name="amount" min="100" max="500000" value="3000" required />
              <span class="input-suffix">₽</span>
            </div>
          </div>

          <!-- Быстрые пресеты сумм -->
          <div class="deposit-presets">
            <button type="button" class="preset-btn" data-val="1000">+1 000 ₽</button>
            <button type="button" class="preset-btn active" data-val="3000">+3 000 ₽</button>
            <button type="button" class="preset-btn" data-val="5000">+5 000 ₽</button>
            <button type="button" class="preset-btn" data-val="10000">+10 000 ₽</button>
          </div>

          <!-- Выбор метода оплаты -->
          <div class="field" style="margin-top:16px">
            <label>Способ оплаты</label>
            <div class="payment-methods-grid">
              <label class="pay-method-card active">
                <input type="radio" name="payMethod" value="sbp" checked />
                <span class="pay-method-icon">⚡</span>
                <span class="pay-method-title">СБП</span>
                <small class="pay-method-sub">0% комиссия</small>
              </label>
              <label class="pay-method-card">
                <input type="radio" name="payMethod" value="card" />
                <span class="pay-method-icon">💳</span>
                <span class="pay-method-title">Карта МИР</span>
                <small class="pay-method-sub">Любой банк РФ</small>
              </label>
              <label class="pay-method-card">
                <input type="radio" name="payMethod" value="tbank" />
                <span class="pay-method-icon">🟡</span>
                <span class="pay-method-title">Т-Банк Pay</span>
                <small class="pay-method-sub">В 1 клик</small>
              </label>
              <label class="pay-method-card">
                <input type="radio" name="payMethod" value="sber" />
                <span class="pay-method-icon">🟢</span>
                <span class="pay-method-title">SberPay</span>
                <small class="pay-method-sub">В 1 клик</small>
              </label>
            </div>
          </div>

          <div style="background:var(--bg-subtle);padding:12px;border-radius:10px;border:1px solid var(--border);margin:16px 0;font-size:12px;color:var(--text-muted)">
            🔒 Безопасность платежей гарантирована протоколами 3D-Secure и шифрованием Банка России.
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button type="button" class="btn btn--ghost" id="btnCancelDeposit">Отмена</button>
            <button type="submit" class="btn btn--primary" id="btnSubmitDeposit" style="font-weight:800;padding:0 24px">
              Пополнить на 3 000 ₽
            </button>
          </div>
        </form>
      </div>
    `);

    const form = box.querySelector("#depositForm");
    const amountInp = box.querySelector("#depAmountInput");
    const submitBtn = box.querySelector("#btnSubmitDeposit");
    const presetBtns = box.querySelectorAll(".preset-btn");
    const payCards = box.querySelectorAll(".pay-method-card");

    const updateSubmitText = () => {
      const val = Math.max(0, +amountInp.value || 0);
      submitBtn.textContent = `Пополнить на ${money(val)}`;
    };

    presetBtns.forEach((b) => {
      b.onclick = () => {
        presetBtns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        amountInp.value = b.dataset.val;
        updateSubmitText();
      };
    });

    amountInp.oninput = () => {
      presetBtns.forEach((x) => x.classList.toggle("active", x.dataset.val === amountInp.value));
      updateSubmitText();
    };

    payCards.forEach((c) => {
      c.onclick = () => {
        payCards.forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
      };
    });

    box.querySelector("#btnCancelDeposit")?.addEventListener("click", closeModal);

    let isDepositSubmitting = false;
    form.onsubmit = (e) => {
      e.preventDefault();
      if (isDepositSubmitting) return;
      const val = Math.round(+amountInp.value || 0);
      if (val < 100) {
        toast("Минимальная сумма пополнения — 100 ₽");
        return;
      }
      isDepositSubmitting = true;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const method = form.payMethod.value;
      const methodLabel = method === "sbp" ? "СБП (Система быстрых платежей)" : (method === "card" ? "Карта МИР" : (method === "tbank" ? "Т-Банк Pay" : "SberPay"));

      DB.deposit(currentUser.id, val, method, `${methodLabel} · Моментальное зачисление без комиссии`);
      toast(`Баланс успешно пополнен на ${money(val)}!`);
      closeModal();
    };
  }

  // Модальное окно вывода средств
  function openWithdrawModal() {
    const w = DB.wallet(currentUser.id);
    if (w.balance < 100) {
      toast("Для вывода необходимо иметь на балансе минимум 100 ₽");
      return;
    }

    const box = openModal(`
      <div class="modal-form-wrap" style="max-width:500px;margin:0 auto;padding:6px 4px">
        <div style="text-align:center;margin-bottom:22px">
          <div style="font-size:42px;margin-bottom:6px">↗</div>
          <h2 style="font-size:22px;margin-bottom:6px">Вывод средств</h2>
          <p class="muted" style="font-size:13.5px;line-height:1.45;margin:0">Перевод на банковскую карту или по номеру телефона через СБП без комиссии платформы</p>
        </div>

        <form id="withdrawForm" class="form">
          <div class="field" style="margin-bottom:18px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
              <label style="font-size:13px;font-weight:700">Сумма вывода (₽) <span class="req">*</span></label>
              <small class="muted" style="font-size:12.5px">Доступно: <b style="color:var(--accent)">${money(w.balance)}</b></small>
            </div>
            <div class="input-with-icon has-suffix">
              <span class="input-icon">💰</span>
              <input type="number" id="withAmountInput" name="amount" min="100" max="${w.balance}" value="${Math.min(w.balance, 5000)}" required />
              <span class="input-suffix">₽</span>
            </div>
            <button type="button" class="link" id="btnMaxWithdraw" style="font-size:12px;margin-top:6px;color:var(--accent);font-weight:600">Вывести всю доступную сумму (${money(w.balance)})</button>
          </div>

          <div class="field" style="margin-bottom:18px">
            <label style="font-size:13px;font-weight:700;margin-bottom:8px;display:block">Способ выплаты</label>
            <div class="payment-methods-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <label class="pay-method-card active" id="cardMethodSbp" style="cursor:pointer;padding:16px 14px;border-radius:14px;background:var(--bg-subtle);border:1.5px solid var(--accent);text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px">
                <input type="radio" name="withMethod" value="sbp" checked style="display:none" />
                <span class="pay-method-icon" style="font-size:26px">⚡</span>
                <span class="pay-method-title" style="font-size:13.5px;font-weight:700">СБП (по номеру)</span>
                <small class="pay-method-sub" style="font-size:11.5px;color:var(--text-muted)">0% комиссия · 1 минута</small>
              </label>
              <label class="pay-method-card" id="cardMethodCard" style="cursor:pointer;padding:16px 14px;border-radius:14px;background:var(--bg-subtle);border:1.5px solid var(--border);text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px">
                <input type="radio" name="withMethod" value="card" style="display:none" />
                <span class="pay-method-icon" style="font-size:26px">💳</span>
                <span class="pay-method-title" style="font-size:13.5px;font-weight:700">Номер карты</span>
                <small class="pay-method-sub" style="font-size:11.5px;color:var(--text-muted)">МИР / Visa / Mastercard</small>
              </label>
            </div>
          </div>

          <div class="field" id="withDestField" style="margin-bottom:18px">
            <label id="destLabel" style="font-size:13px;font-weight:700;margin-bottom:6px;display:block">Номер телефона для СБП <span class="req">*</span></label>
            <div class="input-with-icon">
              <span class="input-icon">📱</span>
              <input type="text" id="destInput" name="destination" value="${esc(currentUser.phone || "+7 900 111-22-33")}" required />
            </div>
          </div>

          <div style="background:var(--bg-subtle);padding:14px 16px;border-radius:12px;border:1px solid var(--border);margin-bottom:20px;font-size:12.5px;color:var(--text-muted);line-height:1.45;display:flex;gap:10px;align-items:center">
            <span style="font-size:20px;flex-shrink:0">⚡</span>
            <span>Выплаты производятся автоматически через Систему Быстрых Платежей в режиме 24/7. Комиссия платформы — 0 ₽.</span>
          </div>

          <div style="display:flex;gap:12px;justify-content:flex-end">
            <button type="button" class="btn btn--ghost" id="btnCancelWithdraw" style="height:46px;padding:0 20px">Отмена</button>
            <button type="submit" class="btn btn--primary" id="btnSubmitWithdraw" style="height:46px;font-weight:800;padding:0 24px">
              Вывести средства
            </button>
          </div>
        </form>
      </div>
    `);

    const form = box.querySelector("#withdrawForm");
    const amountInp = box.querySelector("#withAmountInput");
    const destInp = box.querySelector("#destInput");
    const destLabel = box.querySelector("#destLabel");
    const maxBtn = box.querySelector("#btnMaxWithdraw");
    const payCards = box.querySelectorAll(".pay-method-card");

    maxBtn?.addEventListener("click", () => {
      amountInp.value = w.balance;
    });

    payCards.forEach((c) => {
      c.onclick = () => {
        payCards.forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        const method = form.withMethod.value;
        if (method === "sbp") {
          destLabel.innerHTML = 'Номер телефона для СБП <span class="req">*</span>';
          destInp.placeholder = "+7 (900) 000-00-00";
          destInp.value = currentUser.phone || "+7 900 111-22-33";
        } else {
          destLabel.innerHTML = 'Номер банковской карты <span class="req">*</span>';
          destInp.placeholder = "2200 0000 0000 0000";
          destInp.value = "2202 2045 8891 2910";
        }
      };
    });

    box.querySelector("#btnCancelWithdraw")?.addEventListener("click", closeModal);

    let isWithdrawSubmitting = false;
    form.onsubmit = (e) => {
      e.preventDefault();
      if (isWithdrawSubmitting) return;
      const val = Math.round(+amountInp.value || 0);
      if (val < 100) {
        toast("Минимальная сумма вывода — 100 ₽");
        return;
      }
      if (val > w.balance) {
        toast("Сумма вывода превышает доступный баланс");
        return;
      }
      isWithdrawSubmitting = true;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const dest = destInp.value.trim();
      const method = form.withMethod.value;
      const methodLabel = method === "sbp" ? `СБП (${dest})` : `Карта ${dest.slice(-4) ? '···· ' + dest.slice(-4) : dest}`;

      DB.withdraw(currentUser.id, val, methodLabel, `Вывод средств на ${methodLabel} · Комиссия 0%`);
      toast(`Заявка на вывод ${money(val)} выполнена! Средства отправлены.`);
      closeModal();
    };
  }

  // Модальный чек / квитанция операции
  function openReceiptModal(tx) {
    const isPlus = tx.type === "deposit" || tx.type === "payout";
    const isHold = tx.type === "hold";
    const sign = isHold ? "🔒 " : (isPlus ? "+" : "-");
    const colorCls = isHold ? "text-accent" : (isPlus ? "text-success" : "text-muted");

    openModal(`
      <div class="receipt-box" style="max-width:440px;margin:0 auto">
        <div class="receipt-header">
          <div class="receipt-check-icon">✓</div>
          <h3>Квитанция операции</h3>
          <small class="muted">3ДСосед Financial Network · Норильск</small>
        </div>

        <div class="receipt-amount-badge ${colorCls}">
          ${sign}${money(tx.amount)}
        </div>

        <div class="receipt-table">
          <div class="receipt-row">
            <span class="receipt-label">Тип операции</span>
            <b class="receipt-val">${esc(tx.title)}</b>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">ID транзакции</span>
            <span class="receipt-val" style="font-family:monospace;font-size:12px">${esc(tx.id)}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Дата и время</span>
            <span class="receipt-val">${date(tx.date)}, ${new Date(tx.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Статус</span>
            <span class="receipt-val status status--ready">${tx.status === "hold" ? "Заблокировано" : "Успешно исполнено"}</span>
          </div>
          ${tx.orderId ? `
            <div class="receipt-row">
              <span class="receipt-label">Связанный заказ</span>
              <a href="cabinet.html?order=${encodeURIComponent(tx.orderId)}" class="receipt-val accent" style="text-decoration:none">#${esc(tx.orderId)} (${esc(tx.orderTitle || "деталь")})</a>
            </div>
          ` : ""}
          <div class="receipt-row">
            <span class="receipt-label">Назначение</span>
            <span class="receipt-val" style="max-width:240px;text-align:right">${esc(tx.desc || tx.title)}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Комиссия сервиса</span>
            <span class="receipt-val text-success">${tx.fee ? money(tx.fee) : "0 ₽ (бесплатно)"}</span>
          </div>
        </div>

        <div style="margin-top:24px;text-align:center">
          <button class="btn btn--primary btn--wide" onclick="N3D.closeModal()">Закрыть квитанцию</button>
        </div>
      </div>
    `);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
