// 3ДСосед · Панель администратора
// Полноценный CRUD для заказов, мастеров, заказчиков и резервных копий

(function () {
  const ADMIN_PASS = "admin3d";
  const AUTH_KEY = "n3d_admin_authenticated";

  let ordersCache = [];
  let printersCache = [];
  let chatsCache = {};

  // ==========================================
  // 1. АВТОРИЗАЦИЯ В АДМИНКЕ
  // ==========================================
  function isAuth() {
    const u = window.N3D?.DB?.user();
    if (u && u.role === "admin") return true;
    return sessionStorage.getItem(AUTH_KEY) === "true";
  }

  function setAuth(val) {
    if (val) {
      sessionStorage.setItem(AUTH_KEY, "true");
      const u = window.N3D?.DB?.user();
      if (!u || u.role !== "admin") {
        window.N3D?.DB?.setUser({
          id: "admin_nord3d",
          name: "Администратор 3ДСосед",
          phone: "+7 (999) 000-00-01",
          role: "admin",
          email: "admin@nord3d.ru",
          avatar: "emoji:⚡",
          district: "Норильск (центр)"
        });
      }
    } else {
      sessionStorage.removeItem(AUTH_KEY);
      const u = window.N3D?.DB?.user();
      if (u && u.role === "admin") {
        window.N3D?.DB?.setUser(null);
      }
    }
    updateAuthView();
  }

  function updateAuthView() {
    const authBox = document.getElementById("adminAuthBox");
    const appBox = document.getElementById("adminAppBox");
    const topLogoutBtn = document.getElementById("adminLogoutTopBtn");

    if (isAuth()) {
      if (authBox) authBox.style.display = "none";
      if (appBox) appBox.style.display = "block";
      if (topLogoutBtn) topLogoutBtn.style.display = "inline-flex";
      loadAndRenderAll();
    } else {
      if (authBox) authBox.style.display = "block";
      if (appBox) appBox.style.display = "none";
      if (topLogoutBtn) topLogoutBtn.style.display = "none";

      const curU = window.N3D?.DB?.user();
      const authErr = document.getElementById("adminAuthErr");
      if (authErr && curU && curU.role !== "admin") {
        const roleLabel = curU.role === "printer" ? "мастер" : "заказчик";
        authErr.textContent = `Вы вошли как «${curU.name}» (${roleLabel}). Панель управления доступна только учётной записи администратора.`;
      }
    }
  }

  // ==========================================
  // 2. ЗАГРУЗКА И СИНХРОНИЗАЦИЯ ДАННЫХ
  // ==========================================
  function loadData() {
    ordersCache = window.N3D.DB.orders() || [];
    printersCache = window.N3D.DB.printers() || [];
    chatsCache = window.N3D.DB.chats() || {};
  }

  function loadAndRenderAll() {
    loadData();
    renderKpi();
    renderOrdersTable();
    renderPrintersTable();
    renderCustomersTable();
    renderMonetization();
    checkBackendHealth();
  }

  // ==========================================
  // 3. KPI ДАШБОРД
  // ==========================================
  function renderKpi() {
    const orders = ordersCache;
    const printers = printersCache;
    const chats = chatsCache;

    const totalOrders = orders.length;
    const totalSum = orders.reduce((acc, o) => acc + (Number(o.budget) || 0), 0);
    const scanOrders = orders.filter((o) => o.isScan || o.type === "scan" || o.category === "scan").length;
    const printOrders = totalOrders - scanOrders;
    const verifiedPrinters = printers.filter((p) => p.verified !== false).length;

    // Сбор уникальных заказчиков
    const custMap = getCustomersMap();
    const totalCustomers = Object.keys(custMap).length;
    const totalChats = Object.keys(chats).length;

    // Обновляем виджеты
    const kpiOrdersCount = document.getElementById("kpiOrdersCount");
    const kpiOrdersSum = document.getElementById("kpiOrdersSum");
    const kpiOrdersRatio = document.getElementById("kpiOrdersRatio");
    const kpiPrintersCount = document.getElementById("kpiPrintersCount");
    const kpiPrintersVerified = document.getElementById("kpiPrintersVerified");
    const kpiCustomersCount = document.getElementById("kpiCustomersCount");
    const kpiChatsCount = document.getElementById("kpiChatsCount");

    if (kpiOrdersCount) kpiOrdersCount.textContent = totalOrders;
    if (kpiOrdersSum) kpiOrdersSum.textContent = `Общий бюджет: ${window.N3D.money(totalSum)}`;
    if (kpiOrdersRatio) kpiOrdersRatio.textContent = `${printOrders} / ${scanOrders}`;
    const kpiOrdersRatioHint = document.getElementById("kpiOrdersRatioHint");
    if (kpiOrdersRatioHint) kpiOrdersRatioHint.textContent = `🖨️ ${printOrders} печать · 🔬 ${scanOrders} скан`;
    if (kpiPrintersCount) kpiPrintersCount.textContent = printers.length;
    if (kpiPrintersVerified) kpiPrintersVerified.textContent = `Верифицировано: ${verifiedPrinters} из ${printers.length}`;
    if (kpiCustomersCount) kpiCustomersCount.textContent = totalCustomers;
    if (kpiChatsCount) kpiChatsCount.textContent = `Открытых чатов: ${totalChats}`;

    // Бейджи на вкладках
    const badgeOrders = document.getElementById("badgeTabOrders");
    const badgePrinters = document.getElementById("badgeTabPrinters");
    const badgeCust = document.getElementById("badgeTabCustomers");
    if (badgeOrders) badgeOrders.textContent = totalOrders;
    if (badgePrinters) badgePrinters.textContent = printers.length;
    if (badgeCust) badgeCust.textContent = totalCustomers;
  }

  // ==========================================
  // 4. ТАБЛИЦА ЗАКАЗОВ
  // ==========================================
  function renderOrdersTable() {
    const tbody = document.getElementById("ordersTableBody");
    if (!tbody) return;

    const search = (document.getElementById("orderSearchInp")?.value || "").toLowerCase().trim();
    const stFilter = document.getElementById("orderStatusFilter")?.value || "";
    const typeFilter = document.getElementById("orderTypeFilter")?.value || "";

    const filtered = ordersCache.filter((o) => {
      const isScan = !!(o.isScan || o.type === "scan" || o.category === "scan");
      if (typeFilter === "scan" && !isScan) return false;
      if (typeFilter === "print" && isScan) return false;
      if (stFilter && o.status !== stFilter) return false;

      if (search) {
        const text = [o.id, o.title, o.customerName, o.phone, o.district, o.material, o.comment]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">Заказы не найдены</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((o) => {
      const isScan = !!(o.isScan || o.type === "scan" || o.category === "scan");
      const icon = isScan ? "🔬" : "🖨️";
      const typeLabel = isScan ? "3D-скан" : "3D-печать";
      const typeCls = isScan ? "badge--scan" : "badge--print";
      const badgeHtml = window.N3D.statusBadge ? window.N3D.statusBadge(o.status) : o.status;
      const budgetText = o.budget ? window.N3D.money(o.budget) : "Договорная";
      const dateText = o.createdAt ? window.N3D.date(o.createdAt) : "—";

      return `
        <tr data-order-id="${o.id}">
          <td style="font-family:monospace;font-size:11px;color:var(--text-muted)">${o.id.slice(-6)}</td>
          <td>
            <div style="font-weight:700;font-size:13.5px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${window.N3D.esc(o.title)}">
              ${window.N3D.esc(o.title)}
            </div>
            ${o.material ? `<small style="color:var(--text-muted)">Материал: ${o.material}</small>` : ""}
          </td>
          <td>
            <span class="badge ${typeCls}" style="font-size:11px;padding:3px 8px">
              ${icon} ${typeLabel}
            </span>
          </td>
          <td>
            <div style="font-weight:600">${window.N3D.esc(o.customerName || "Заказчик")}</div>
            <small style="color:var(--text-muted)">${window.N3D.esc(o.phone || "—")}</small>
          </td>
          <td><span style="font-size:12px">${window.N3D.esc(o.district || "Норильск")}</span></td>
          <td style="font-weight:700;color:var(--accent)">${budgetText}</td>
          <td>${badgeHtml}</td>
          <td style="font-size:12px;color:var(--text-muted)">${dateText}</td>
          <td style="text-align:right">
            <div class="admin-actions" style="justify-content:flex-end">
              <button class="btn-action btn-edit-order" data-id="${o.id}" title="Редактировать заказ">✏️</button>
              <button class="btn-action btn-action--danger btn-del-order" data-id="${o.id}" title="Удалить заказ">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Привязываем события
    tbody.querySelectorAll(".btn-edit-order").forEach((btn) => {
      btn.onclick = () => openOrderEditModal(btn.dataset.id);
    });
    tbody.querySelectorAll(".btn-del-order").forEach((btn) => {
      btn.onclick = () => deleteOrder(btn.dataset.id);
    });
  }

  // Модальное окно редактирования заказа
  function openOrderEditModal(orderId) {
    const order = ordersCache.find((o) => o.id === orderId);
    if (!order) return;

    const isScan = !!(order.isScan || order.type === "scan" || order.category === "scan");

    const modal = window.N3D.openModal(`
      <div style="max-width:540px;margin:0 auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="font-size:18px">Редактирование заказа #${order.id}</h3>
          <span class="badge" style="font-size:12px">${isScan ? "🔬 Сканирование" : "🖨️ Печать"}</span>
        </div>

        <form id="editOrderForm" style="display:flex;flex-direction:column;gap:12px">
          <div class="field">
            <label>Название детали или услуги <span class="req">*</span></label>
            <input name="title" type="text" value="${window.N3D.esc(order.title || "")}" required />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label>Статус заказа</label>
              <select name="status">
                <option value="open" ${order.status === "open" ? "selected" : ""}>🟢 Ищет мастера</option>
                <option value="in_work" ${order.status === "in_work" ? "selected" : ""}>🟡 В работе</option>
                <option value="done" ${order.status === "done" ? "selected" : ""}>✅ Выполнен</option>
                <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>⚪ Отменён</option>
              </select>
            </div>
            <div class="field">
              <label>Бюджет (₽)</label>
              <input name="budget" type="number" min="0" step="50" value="${order.budget || 0}" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label>Имя заказчика</label>
              <input name="customerName" type="text" value="${window.N3D.esc(order.customerName || "")}" />
            </div>
            <div class="field">
              <label>Телефон заказчика</label>
              <input name="phone" type="tel" value="${window.N3D.esc(order.phone || "")}" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label>Район Норильска</label>
              <select name="district">
                ${window.N3D.DISTRICTS.map((d) => `<option ${order.district === d ? "selected" : ""}>${d}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label>Желаемый материал</label>
              <input name="material" type="text" value="${window.N3D.esc(order.material || "")}" placeholder="PLA, PETG, ABS..." />
            </div>
          </div>

          <div class="field">
            <label>Срок выполнения / Дедлайн</label>
            <input name="deadline" type="text" value="${window.N3D.esc(order.deadline || "")}" placeholder="До 20 числа, Срочно за 2 дня..." />
          </div>

          <div class="field">
            <label>Описание и комментарии к заказу</label>
            <textarea name="comment" rows="3">${window.N3D.esc(order.comment || "")}</textarea>
          </div>

          <div style="display:flex;gap:10px;margin-top:8px">
            <button type="submit" class="btn btn--primary" style="flex:1;height:44px;font-weight:700">
              💾 Сохранить изменения
            </button>
            <button type="button" class="btn btn-action--danger" id="btnDeleteFromModal" style="height:44px;padding:0 18px">
              Удалить
            </button>
          </div>
        </form>
      </div>
    `, "modal__box");

    let isOrderSaving = false;
    modal.querySelector("#editOrderForm").onsubmit = async (e) => {
      e.preventDefault();
      if (isOrderSaving) return;
      isOrderSaving = true;
      const submitBtn = modal.querySelector("#editOrderForm button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;

      const f = e.target;
      order.title = f.title.value.trim();
      order.status = f.status.value;
      order.budget = Number(f.budget.value) || 0;
      order.customerName = f.customerName.value.trim();
      order.phone = f.phone.value.trim();
      order.district = f.district.value;
      order.material = f.material.value.trim();
      order.deadline = f.deadline.value.trim();
      order.comment = f.comment.value.trim();

      window.N3D.DB.updateOrder(order);

      // Синхронизация с сервером
      try {
        await fetch(`/api/orders/${order.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order)
        });
      } catch (err) {
        // локальный режим
      }

      window.N3D.closeModal();
      window.N3D.toast(`Заказ #${order.id} успешно обновлён`);
      loadAndRenderAll();
    };

    modal.querySelector("#btnDeleteFromModal").onclick = () => {
      deleteOrder(order.id);
    };
  }

  async function deleteOrder(orderId) {
    if (!confirm(`Вы действительно хотите удалить заказ #${orderId}? Действие необратимо.`)) return;

    const list = window.N3D.DB.orders().filter((o) => o.id !== orderId);
    window.N3D.DB.saveOrders(list);

    try {
      await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    } catch (e) {}

    window.N3D.closeModal();
    window.N3D.toast("Заказ удалён");
    loadAndRenderAll();
  }

  // ==========================================
  // 5. ТАБЛИЦА МАСТЕРОВ (ИСПОЛНИТЕЛЕЙ)
  // ==========================================
  function renderPrintersTable() {
    const tbody = document.getElementById("printersTableBody");
    if (!tbody) return;

    const search = (document.getElementById("printerSearchInp")?.value || "").toLowerCase().trim();
    const distFilter = document.getElementById("printerDistrictFilter")?.value || "";

    const filtered = printersCache.filter((p) => {
      if (distFilter && p.district && !p.district.includes(distFilter)) return false;
      if (search) {
        const text = [p.name, p.phone, p.district, p.equipment, p.scannerEquipment, p.about]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">Мастера не найдены</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((p) => {
      const isVerified = p.verified !== false;
      const isBlocked = !!p.blocked;
      const rating = Number(p.rating || 5.0).toFixed(1);
      const doneCount = p.done || 0;
      const equip = p.equipment || "3D-принтер";
      const scanner = p.scannerEquipment ? ` · 🔬 ${p.scannerEquipment}` : "";

      return `
        <tr data-printer-id="${p.id}" style="${isBlocked ? "opacity:0.6;background:rgba(239,68,68,0.05)" : ""}">
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              ${window.N3D.avatar ? window.N3D.avatar(p, 36) : ""}
              <div>
                <div style="font-weight:700;font-size:14px">
                  ${window.N3D.esc(p.name)}
                  ${isVerified ? '<span style="color:var(--accent);margin-left:4px" title="Верифицирован">✓</span>' : ""}
                </div>
                <small style="color:var(--text-muted)">ID: ${p.id}</small>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight:600">${window.N3D.esc(p.phone || "—")}</div>
            ${p.telegram ? `<small style="color:var(--accent)">✈️ ${window.N3D.esc(p.telegram)}</small>` : ""}
            ${p.vk ? `<small style="color:#2787F5">🆔 ${window.N3D.esc(p.vk)}</small>` : ""}
          </td>
          <td><span style="font-size:12.5px">${window.N3D.esc(p.district || "Норильск")}</span></td>
          <td>
            <div style="max-width:200px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${window.N3D.esc(equip + scanner)}">
              🖨️ ${window.N3D.esc(equip)}${window.N3D.esc(scanner)}
            </div>
            <small style="color:var(--text-muted)">от ${p.pricePerGram || 10} ₽/г</small>
          </td>
          <td><b style="color:#f59e0b">★ ${rating}</b></td>
          <td><span style="font-weight:600">${doneCount}</span></td>
          <td>
            <button class="btn-action btn-toggle-verify" data-id="${p.id}" style="font-size:11px;${isVerified ? "color:var(--accent);border-color:var(--accent)" : "color:var(--text-muted)"}">
              ${isVerified ? "✓ Проверен" : "⏳ Не проверен"}
            </button>
          </td>
          <td>
            <button class="btn-action btn-toggle-block" data-id="${p.id}" style="font-size:11px;${isBlocked ? "color:#ef4444;border-color:#ef4444" : "color:var(--text)"}">
              ${isBlocked ? "⛔ Заблокирован" : "🟢 Активен"}
            </button>
          </td>
          <td style="text-align:right">
            <div class="admin-actions" style="justify-content:flex-end">
              <button class="btn-action btn-edit-printer" data-id="${p.id}" title="Редактировать мастера">✏️</button>
              <button class="btn-action btn-action--danger btn-del-printer" data-id="${p.id}" title="Удалить мастера">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Привязываем события
    tbody.querySelectorAll(".btn-toggle-verify").forEach((btn) => {
      btn.onclick = () => togglePrinterVerify(btn.dataset.id);
    });
    tbody.querySelectorAll(".btn-toggle-block").forEach((btn) => {
      btn.onclick = () => togglePrinterBlock(btn.dataset.id);
    });
    tbody.querySelectorAll(".btn-edit-printer").forEach((btn) => {
      btn.onclick = () => openPrinterEditModal(btn.dataset.id);
    });
    tbody.querySelectorAll(".btn-del-printer").forEach((btn) => {
      btn.onclick = () => deletePrinter(btn.dataset.id);
    });
  }

  function togglePrinterVerify(printerId) {
    const list = window.N3D.DB.printers();
    const p = list.find((x) => x.id === printerId);
    if (!p) return;
    p.verified = p.verified === false ? true : false;
    window.N3D.DB.savePrinters(list);
    window.N3D.toast(`Статус верификации ${p.name} изменён`);
    loadAndRenderAll();
  }

  function togglePrinterBlock(printerId) {
    const list = window.N3D.DB.printers();
    const p = list.find((x) => x.id === printerId);
    if (!p) return;
    p.blocked = !p.blocked;
    window.N3D.DB.savePrinters(list);
    window.N3D.toast(`${p.name} ${p.blocked ? "заблокирован" : "разблокирован"}`);
    loadAndRenderAll();
  }

  function openPrinterEditModal(printerId) {
    const p = printersCache.find((x) => x.id === printerId);
    if (!p) return;

    let currentModalAvatar = p.avatar || null;

    const modal = window.N3D.openModal(`
      <div style="max-width:540px;margin:0 auto">
        <h3 style="font-size:18px;margin-bottom:16px">Редактирование профиля мастера: ${window.N3D.esc(p.name)}</h3>

        <div style="display:flex;align-items:center;gap:14px;padding:12px;background:var(--bg-subtle);border-radius:12px;margin-bottom:14px;border:1px solid var(--border)">
          <div class="avatar-editable" id="adminPrinterAvatarTrigger" title="Нажмите, чтобы изменить аватар">
            ${window.N3D.avatar(p, 54)}
            <span class="avatar-editable__badge">📷</span>
          </div>
          <div style="flex:1">
            <b>Аватар мастера</b>
            <small style="display:block;color:var(--text-muted)">Нажмите на фото, чтобы выбрать маскот или загрузить фото с ПК/смартфона</small>
          </div>
          <button type="button" class="btn btn--ghost btn--small" id="btnAdminChangeAvatar">Выбрать</button>
        </div>

        <form id="editPrinterForm" style="display:flex;flex-direction:column;gap:12px">
          <div class="field">
            <label>Имя мастера или студии <span class="req">*</span></label>
            <input name="name" type="text" value="${window.N3D.esc(p.name)}" required />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label>Телефон мастера</label>
              <input name="phone" type="tel" value="${window.N3D.esc(p.phone || "")}" required />
            </div>
            <div class="field">
              <label>Район Норильска</label>
              <select name="district">
                ${window.N3D.DISTRICTS.map((d) => `<option ${p.district === d ? "selected" : ""}>${d}</option>`).join("")}
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label>Telegram username</label>
              <input name="telegram" type="text" value="${window.N3D.esc(p.telegram || "")}" placeholder="@username" />
            </div>
            <div class="field">
              <label>VK страница или ID</label>
              <input name="vk" type="text" value="${window.N3D.esc(p.vk || "")}" placeholder="vk.com/id..." />
            </div>
          </div>

          <div class="field">
            <label>Модели 3D-принтеров</label>
            <input name="equipment" type="text" value="${window.N3D.esc(p.equipment || "")}" placeholder="Bambu Lab P1S, Voron..." />
          </div>

          <div class="field">
            <label>Оборудование 3D-сканирования (если есть)</label>
            <input name="scannerEquipment" type="text" value="${window.N3D.esc(p.scannerEquipment || "")}" placeholder="Revopoint POP 3, Creality Ferret..." />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div class="field">
              <label>Рейтинг (★)</label>
              <input name="rating" type="number" min="1" max="5" step="0.1" value="${p.rating || 5.0}" />
            </div>
            <div class="field">
              <label>Выполнено</label>
              <input name="done" type="number" min="0" value="${p.done || 0}" />
            </div>
            <div class="field">
              <label>Цена за грамм (₽)</label>
              <input name="pricePerGram" type="number" min="1" value="${p.pricePerGram || 10}" />
            </div>
          </div>

          <div style="display:flex;gap:16px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer">
              <input type="checkbox" name="verified" ${p.verified !== false ? "checked" : ""} />
              <b>✓ Верифицирован</b>
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer;color:#ef4444">
              <input type="checkbox" name="blocked" ${p.blocked ? "checked" : ""} />
              <b>⛔ Заблокирован</b>
            </label>
          </div>

          <div class="field">
            <label>Описание и опыт</label>
            <textarea name="about" rows="3">${window.N3D.esc(p.about || "")}</textarea>
          </div>

          <div style="display:flex;gap:10px;margin-top:8px">
            <button type="submit" class="btn btn--primary" style="flex:1;height:44px;font-weight:700">
              💾 Сохранить мастера
            </button>
            <button type="button" class="btn btn-action--danger" id="btnDeletePrinterFromModal" style="height:44px;padding:0 18px">
              Удалить
            </button>
          </div>
        </form>
      </div>
    `, "modal__box");

    const updateAdminAvatarPreview = () => {
      const trig = modal.querySelector("#adminPrinterAvatarTrigger");
      if (trig) {
        trig.innerHTML = `${window.N3D.avatar({ name: p.name, avatar: currentModalAvatar }, 54)}<span class="avatar-editable__badge">📷</span>`;
      }
    };
    const openPickerForAdmin = () => {
      window.N3D.openAvatarPickerModal(currentModalAvatar, (newAv) => {
        currentModalAvatar = newAv;
        updateAdminAvatarPreview();
      });
    };
    modal.querySelector("#adminPrinterAvatarTrigger")?.addEventListener("click", openPickerForAdmin);
    modal.querySelector("#btnAdminChangeAvatar")?.addEventListener("click", openPickerForAdmin);

    let isPrinterSaving = false;
    modal.querySelector("#editPrinterForm").onsubmit = async (e) => {
      e.preventDefault();
      if (isPrinterSaving) return;
      isPrinterSaving = true;
      const submitBtn = modal.querySelector("#editPrinterForm button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;

      const f = e.target;
      p.name = f.name.value.trim();
      p.avatar = currentModalAvatar;
      p.phone = f.phone.value.trim();
      p.district = f.district.value;
      p.telegram = f.telegram.value.trim();
      p.vk = f.vk.value.trim();
      p.equipment = f.equipment.value.trim();
      p.scannerEquipment = f.scannerEquipment.value.trim();
      p.rating = parseFloat(f.rating.value) || 5.0;
      p.done = parseInt(f.done.value, 10) || 0;
      p.pricePerGram = parseInt(f.pricePerGram.value, 10) || 10;
      p.verified = f.verified.checked;
      p.blocked = f.blocked.checked;
      p.about = f.about.value.trim();

      window.N3D.DB.updatePrinter(p);

      try {
        await fetch(`/api/printers/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p)
        });
      } catch (err) {}

      window.N3D.closeModal();
      window.N3D.toast(`Профиль ${p.name} успешно обновлён`);
      loadAndRenderAll();
    };

    modal.querySelector("#btnDeletePrinterFromModal").onclick = () => {
      deletePrinter(p.id);
    };
  }

  async function deletePrinter(printerId) {
    if (!confirm(`Удалить мастера из каталога? Все связанные отклики останутся в истории.`)) return;

    const list = window.N3D.DB.printers().filter((p) => p.id !== printerId);
    window.N3D.DB.savePrinters(list);

    try {
      await fetch(`/api/printers/${printerId}`, { method: "DELETE" });
    } catch (e) {}

    window.N3D.closeModal();
    window.N3D.toast("Мастер удалён из каталога");
    loadAndRenderAll();
  }

  // ==========================================
  // 6. ТАБЛИЦА ЗАКАЗЧИКОВ
  // ==========================================
  function getCustomersMap() {
    const custMap = {};

    ordersCache.forEach((o) => {
      const key = o.phone || o.customerName || o.id;
      if (!custMap[key]) {
        custMap[key] = {
          name: o.customerName || "Заказчик",
          phone: o.phone || "—",
          district: o.district || "Норильск",
          ordersCount: 0,
          totalBudget: 0,
          telegram: o.telegram || "",
          vk: o.vk || "",
          lastOrderDate: o.createdAt
        };
      }
      custMap[key].ordersCount++;
      custMap[key].totalBudget += Number(o.budget) || 0;
      if (o.telegram) custMap[key].telegram = o.telegram;
      if (o.vk) custMap[key].vk = o.vk;
    });

    const currUser = window.N3D.DB.user();
    if (currUser && currUser.role === "customer") {
      const k = currUser.phone || currUser.id;
      if (!custMap[k]) {
        custMap[k] = {
          name: currUser.name,
          phone: currUser.phone || "—",
          district: currUser.district || "Норильск",
          ordersCount: 0,
          totalBudget: 0,
          telegram: currUser.telegram || "",
          vk: currUser.vk || ""
        };
      }
    }

    return custMap;
  }

  function renderCustomersTable() {
    const tbody = document.getElementById("customersTableBody");
    if (!tbody) return;

    const search = (document.getElementById("custSearchInp")?.value || "").toLowerCase().trim();
    const custMap = getCustomersMap();
    const list = Object.values(custMap).filter((c) => {
      if (!search) return true;
      const text = [c.name, c.phone, c.telegram, c.vk, c.district].filter(Boolean).join(" ").toLowerCase();
      return text.includes(search);
    });

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Заказчики не найдены</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((c) => {
      let socialBadge = "—";
      if (c.telegram) {
        socialBadge = `<span style="color:var(--accent);font-weight:600">✈️ ${window.N3D.esc(c.telegram)}</span>`;
      } else if (c.vk) {
        socialBadge = `<span style="color:#2787F5;font-weight:600">🆔 ${window.N3D.esc(c.vk)}</span>`;
      }

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              ${window.N3D.avatar ? window.N3D.avatar(c, 32) : ""}
              <b>${window.N3D.esc(c.name)}</b>
            </div>
          </td>
          <td>${window.N3D.esc(c.phone)}</td>
          <td>${socialBadge}</td>
          <td><span style="font-size:12.5px">${window.N3D.esc(c.district)}</span></td>
          <td><span style="font-weight:700">${c.ordersCount} шт.</span></td>
          <td style="font-weight:700;color:var(--accent)">${window.N3D.money(c.totalBudget)}</td>
          <td style="text-align:right">
            <button class="btn-action btn-chat-cust" data-name="${window.N3D.esc(c.name)}" data-phone="${window.N3D.esc(c.phone)}">
              💬 Написать
            </button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".btn-chat-cust").forEach((btn) => {
      btn.onclick = () => {
        window.N3D.toast(`Открываем диалог с ${btn.dataset.name}...`);
        window.location.href = "cabinet.html";
      };
    });
  }

  // ==========================================
  // 6.5 МОНЕТИЗАЦИЯ (МОДЕЛИ 1 И 3)
  // ==========================================
  function renderMonetization() {
    const cfg = window.N3D.DB.monetization ? window.N3D.DB.monetization() : window.N3D.DEFAULT_MONETIZATION;

    // Мастер-переключатели 1-кликом
    const toggleEscrow = document.getElementById("toggleEscrowMaster");
    const pillEscrow = document.getElementById("pillEscrowStatus");
    const inputEscrowComm = document.getElementById("inputEscrowCommission");
    const inputEscrowMin = document.getElementById("inputEscrowMinAmount");

    const toggleBoost = document.getElementById("toggleBoostMaster");
    const pillBoost = document.getElementById("pillBoostStatus");
    const inputUrgent = document.getElementById("inputUrgentPrice");
    const inputPrivate = document.getElementById("inputPrivatePrice");
    const inputModeling = document.getElementById("inputModelingPrice");

    if (toggleEscrow) toggleEscrow.checked = !!cfg.escrowEnabled;
    if (pillEscrow) {
      pillEscrow.className = `switch-status-pill ${cfg.escrowEnabled ? "active" : ""}`;
      pillEscrow.innerHTML = cfg.escrowEnabled ? "🟢 Вкл" : "⚪ Выкл";
    }
    if (inputEscrowComm) inputEscrowComm.value = cfg.escrowCommissionPercent || 10;
    if (inputEscrowMin) inputEscrowMin.value = cfg.minEscrowAmount || 500;

    if (toggleBoost) toggleBoost.checked = !!cfg.boostEnabled;
    if (pillBoost) {
      pillBoost.className = `switch-status-pill ${cfg.boostEnabled ? "active" : ""}`;
      pillBoost.innerHTML = cfg.boostEnabled ? "🟢 Вкл" : "⚪ Выкл";
    }
    if (inputUrgent) inputUrgent.value = cfg.urgentPrice || 250;
    if (inputPrivate) inputPrivate.value = cfg.privatePrice || 150;
    if (inputModeling) inputModeling.value = cfg.modelingPrice || 500;

    // Расчёт финансовых показателей
    let escrowEarned = 0;
    let boostEarned = 0;
    let monetizedCount = 0;

    ordersCache.forEach((o) => {
      let isMonetized = false;
      const b = Number(o.budget) || 0;

      // Модель 1: Гарант
      if (o.escrow) {
        isMonetized = true;
        const commPct = o.escrowCommissionPercent || cfg.escrowCommissionPercent || 10;
        if (o.status === "done") {
          escrowEarned += o.platformFeeEarned || Math.round(b * commPct / 100);
        }
      }

      // Модель 3: Boost
      let orderBoost = 0;
      if (o.boostFee) {
        orderBoost = Number(o.boostFee) || 0;
      } else {
        if (o.urgent) orderBoost += (cfg.urgentPrice || 250);
        if (o.isPrivate) orderBoost += (cfg.privatePrice || 150);
        if (o.needsModeling) orderBoost += (cfg.modelingPrice || 500);
      }
      if (orderBoost > 0) {
        isMonetized = true;
        boostEarned += orderBoost;
      }

      if (isMonetized) monetizedCount++;
    });

    const totalRev = escrowEarned + boostEarned;

    // Обновляем виджеты дохода
    const revTotalPlatform = document.getElementById("revTotalPlatform");
    const revEscrowFees = document.getElementById("revEscrowFees");
    const revBoostRevenue = document.getElementById("revBoostRevenue");
    const revOrdersCount = document.getElementById("revOrdersCount");

    if (revTotalPlatform) revTotalPlatform.textContent = window.N3D.money(totalRev);
    if (revEscrowFees) revEscrowFees.textContent = window.N3D.money(escrowEarned);
    if (revBoostRevenue) revBoostRevenue.textContent = window.N3D.money(boostEarned);
    if (revOrdersCount) revOrdersCount.textContent = `${monetizedCount} из ${ordersCache.length}`;

    const badge = document.getElementById("monetizedOrdersCountBadge");
    if (badge) badge.textContent = `${monetizedCount} сделок с монетизацией`;

    // Заполнение таблицы сделок
    const tbody = document.getElementById("monetizationTableBody");
    if (!tbody) return;

    if (!ordersCache.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px" class="muted">В базе пока нет заказов</td></tr>`;
      return;
    }

    tbody.innerHTML = ordersCache.map((o) => {
      const b = Number(o.budget) || 0;
      const commPct = o.escrowCommissionPercent || cfg.escrowCommissionPercent || 10;
      const commVal = Math.round(b * commPct / 100);

      // Бейджи опций
      let boostChips = [];
      let orderBoost = 0;
      if (o.urgent) {
        boostChips.push(`<span class="chip chip--urgent">⚡ Срочно 24ч (+${o.boostFee ? 250 : cfg.urgentPrice} ₽)</span>`);
        orderBoost += (cfg.urgentPrice || 250);
      }
      if (o.isPrivate) {
        boostChips.push(`<span class="chip" style="background:rgba(100,116,139,0.12);color:#475569">🔒 Приватно (+${cfg.privatePrice} ₽)</span>`);
        orderBoost += (cfg.privatePrice || 150);
      }
      if (o.needsModeling) {
        boostChips.push(`<span class="chip" style="background:rgba(112,72,232,0.1);color:#7048e8">📐 3D-модель (+${cfg.modelingPrice} ₽)</span>`);
        orderBoost += (cfg.modelingPrice || 500);
      }

      const escrowStatusBadge = o.escrow
        ? (o.status === "done" || o.escrowStatus === "released"
            ? `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3)">✓ Выплачен (${commPct}% комиссия)</span>`
            : `<span class="badge" style="background:rgba(14,165,233,0.15);color:#0284c7;border:1px solid rgba(14,165,233,0.3)">🛡️ Холд (${window.N3D.money(b)})</span>`)
        : `<span class="muted" style="font-size:12px">Прямой расчет</span>`;

      const platformIncome = (o.status === "done" && o.escrow ? (o.platformFeeEarned || commVal) : 0) + orderBoost;

      return `
        <tr>
          <td><span style="font-family:monospace;font-size:12px">#${o.id.slice(-4)}</span></td>
          <td>
            <div style="font-weight:700">${window.N3D.esc(o.title)}</div>
            <small class="muted">${o.material || "PLA"} · 📍 ${window.N3D.esc(o.district)}</small>
          </td>
          <td>
            <div><b>${window.N3D.esc(o.customerName || "Заказчик")}</b></div>
            <small class="muted">${o.customerPhone || "—"}</small>
          </td>
          <td style="font-weight:700">${window.N3D.money(b)}</td>
          <td>${escrowStatusBadge}</td>
          <td>${boostChips.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${boostChips.join("")}</div>` : `<span class="muted" style="font-size:12px">—</span>`}</td>
          <td style="font-weight:800;color:#10b981">+${window.N3D.money(platformIncome)}</td>
          <td style="text-align:right">
            ${o.escrow && o.status !== "done" ? `
              <button class="btn-action btn-release-escrow" data-id="${o.id}" style="color:#10b981;border-color:rgba(16,185,129,0.4)" title="Принудительно завершить и перевести мастеру">
                ✓ Выплата
              </button>
            ` : `
              <button class="btn-action btn-inspect-order" data-id="${o.id}">
                👁️ Инфо
              </button>
            `}
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".btn-release-escrow").forEach((btn) => {
      btn.onclick = () => {
        const o = window.N3D.DB.order(btn.dataset.id);
        if (!o) return;
        const commPct = o.escrowCommissionPercent || cfg.escrowCommissionPercent || 10;
        const commVal = Math.round((Number(o.budget) || 0) * commPct / 100);
        const payout = (Number(o.budget) || 0) - commVal;
        if (!confirm(`Принудительно разблокировать гарант для заказа «${o.title}»?\nВыплата мастеру: ${window.N3D.money(payout)}\nКомиссия платформы: ${window.N3D.money(commVal)}`)) return;

        if (window.N3D.DB.completeOrder) {
          window.N3D.DB.completeOrder(o.id);
        } else {
          window.N3D.DB.updateOrder(o.id, (x) => {
            x.status = "done";
            x.escrowStatus = "released";
            x.platformFeeEarned = commVal;
            x.payoutToPrinter = payout;
            x.releasedAt = Date.now();
          });
        }
        window.N3D.toast(`Гарант разблокирован: выплата ${window.N3D.money(payout)} переведена мастеру!`);
        loadAndRenderAll();
      };
    });

    tbody.querySelectorAll(".btn-inspect-order").forEach((btn) => {
      btn.onclick = () => {
        openEditOrderModal(btn.dataset.id);
      };
    });
  }

  // ==========================================
  // 7. СИСТЕМА, ЭКСПОРТ/ИМПОРТ И БЭКЕНД
  // ==========================================
  function exportBackup() {
    loadData();
    const backup = {
      platform: "3ДСосед Norilsk",
      exportedAt: new Date().toISOString(),
      orders: ordersCache,
      printers: printersCache,
      chats: chatsCache
    };

    const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", str);
    const dateStr = new Date().toISOString().slice(0, 10);
    a.setAttribute("download", `nord3d-backup-${dateStr}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.N3D.toast("Резервная копия базы успешно скачана!");
  }

  function importBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        if (!json.orders || !json.printers) {
          throw new Error("Неверный формат бэкапа 3ДСосед");
        }

        window.N3D.DB.saveOrders(json.orders);
        window.N3D.DB.savePrinters(json.printers);
        if (json.chats) window.N3D.DB.saveChats(json.chats);

        window.N3D.toast("База успешно восстановлена из бэкапа!");
        loadAndRenderAll();
      } catch (err) {
        alert("Ошибка импорта: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  async function checkBackendHealth() {
    const badge = document.getElementById("serverStatusBadge");
    const out = document.getElementById("backendStatsOutput");

    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Status " + res.status);
      const data = await res.json();

      if (badge) {
        badge.innerHTML = `🟢 <b>Node.js API:</b> В сети · Uptime: ${Math.round(data.uptime)}с`;
        badge.style.borderColor = "var(--accent)";
      }
      if (out) {
        out.textContent = JSON.stringify(data, null, 2);
      }
    } catch (e) {
      if (badge) {
        badge.innerHTML = `🟡 <b>Локальный режим:</b> WebStorage / Offline Ready`;
        badge.style.borderColor = "var(--border)";
      }
      if (out) {
        out.textContent = "Сервер Node.js не обнаружен по адресу http://localhost:3000.\nПлатформа работает в автономном режиме браузера на базе LocalStorage и IndexedDB.";
      }
    }
  }

  // ==========================================
  // 8. ИНИЦИАЛИЗАЦИЯ И СОБЫТИЯ
  // ==========================================
  function init() {
    // Вход в админку
    const loginForm = document.getElementById("adminLoginForm");
    const passInput = document.getElementById("adminPassInput");
    const authErr = document.getElementById("adminAuthErr");
    const quickLoginBtn = document.getElementById("quickLoginBtn");
    const topLogoutBtn = document.getElementById("adminLogoutTopBtn");

    if (loginForm) {
      loginForm.onsubmit = (e) => {
        e.preventDefault();
        const p = passInput.value.trim();
        if (p === ADMIN_PASS || p === "admin") {
          setAuth(true);
        } else {
          if (authErr) authErr.textContent = "Неверный пароль администратора";
        }
      };
    }

    if (quickLoginBtn) {
      quickLoginBtn.onclick = () => {
        setAuth(true);
      };
    }

    if (topLogoutBtn) {
      topLogoutBtn.onclick = () => {
        setAuth(false);
      };
    }

    // Переключение вкладок
    document.querySelectorAll(".admin-tab").forEach((tab) => {
      tab.onclick = () => {
        document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".admin-tab-pane").forEach((p) => (p.style.display = "none"));

        tab.classList.add("active");
        const pane = document.getElementById(`tabContent_${tab.dataset.tab}`);
        if (pane) pane.style.display = "block";
      };
    });

    // Фильтры заказов
    document.getElementById("orderSearchInp")?.addEventListener("input", renderOrdersTable);
    document.getElementById("orderStatusFilter")?.addEventListener("change", renderOrdersTable);
    document.getElementById("orderTypeFilter")?.addEventListener("change", renderOrdersTable);

    // Фильтры мастеров
    document.getElementById("printerSearchInp")?.addEventListener("input", renderPrintersTable);
    document.getElementById("printerDistrictFilter")?.addEventListener("change", renderPrintersTable);

    // Фильтры заказчиков
    document.getElementById("custSearchInp")?.addEventListener("input", renderCustomersTable);

    // Кнопка общего обновления
    document.getElementById("refreshAllBtn")?.addEventListener("click", loadAndRenderAll);

    // 1-КЛИК ПЕРЕКЛЮЧАТЕЛЬ: Безопасная сделка (Гарант)
    const toggleEscrow = document.getElementById("toggleEscrowMaster");
    toggleEscrow?.addEventListener("change", (e) => {
      const cfg = window.N3D.DB.monetization();
      cfg.escrowEnabled = e.target.checked;
      window.N3D.DB.saveMonetization(cfg);
      window.N3D.toast(cfg.escrowEnabled ? "🟢 Безопасная сделка (Гарант) ВКЛЮЧЕНА!" : "⚪ Безопасная сделка ВЫКЛЮЧЕНА");
      renderMonetization();
    });

    // 1-КЛИК ПЕРЕКЛЮЧАТЕЛЬ: Платные опции Boost
    const toggleBoost = document.getElementById("toggleBoostMaster");
    toggleBoost?.addEventListener("change", (e) => {
      const cfg = window.N3D.DB.monetization();
      cfg.boostEnabled = e.target.checked;
      window.N3D.DB.saveMonetization(cfg);
      window.N3D.toast(cfg.boostEnabled ? "🟢 Платные опции Boost ВКЛЮЧЕНЫ!" : "⚪ Платные опции Boost ВЫКЛЮЧЕНЫ");
      renderMonetization();
    });

    // Сохранение тарифа комиссии Гаранта
    document.getElementById("btnSaveEscrowSettings")?.addEventListener("click", () => {
      const cfg = window.N3D.DB.monetization();
      const comm = parseInt(document.getElementById("inputEscrowCommission").value, 10) || 10;
      const minA = parseInt(document.getElementById("inputEscrowMinAmount").value, 10) || 500;
      cfg.escrowCommissionPercent = Math.max(1, Math.min(50, comm));
      cfg.minEscrowAmount = Math.max(100, minA);
      window.N3D.DB.saveMonetization(cfg);
      window.N3D.toast("Тариф комиссии сохранён!");
      renderMonetization();
    });

    // Сохранение расценок Boost-опций
    document.getElementById("btnSaveBoostSettings")?.addEventListener("click", () => {
      const cfg = window.N3D.DB.monetization();
      const u = parseInt(document.getElementById("inputUrgentPrice").value, 10) || 250;
      const p = parseInt(document.getElementById("inputPrivatePrice").value, 10) || 150;
      const m = parseInt(document.getElementById("inputModelingPrice").value, 10) || 500;
      cfg.urgentPrice = Math.max(50, u);
      cfg.privatePrice = Math.max(50, p);
      cfg.modelingPrice = Math.max(100, m);
      window.N3D.DB.saveMonetization(cfg);
      window.N3D.toast("Расценки платных опций сохранены!");
      renderMonetization();
    });

    // Кнопки системы и бэкапа
    document.getElementById("btnExportJson")?.addEventListener("click", exportBackup);
    document.getElementById("btnImportJson")?.addEventListener("change", importBackup);
    document.getElementById("btnCheckBackendHealth")?.addEventListener("click", checkBackendHealth);
    document.getElementById("btnResetDemoData")?.addEventListener("click", () => {
      if (confirm("Вы уверены, что хотите сбросить все заказы и мастеров к исходным демо-данным?")) {
        window.N3D.DB.reset();
        window.N3D.toast("База сброшена к эталонным данным!");
        loadAndRenderAll();
      }
    });

    updateAuthView();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
