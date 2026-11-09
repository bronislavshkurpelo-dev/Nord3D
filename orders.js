// NORD 3D — биржа заказов: фильтры, карточка заказа, чат, смена статусов
(() => {
  "use strict";
  const { DB, DISTRICTS, STATUS, Presence, Chat, esc, money, date, ago, uid, avatar, stars, statusBadge, qs, openModal, closeModal, toast, requireUser, loginModal } = N3D;
  const $ = (id) => document.getElementById(id);
  const user = DB.user();

  let tab = qs("tab") || "open";
  $("fDistrict").innerHTML += DISTRICTS.map((d) => `<option>${d}</option>`).join("");
  if (!user) $("tabMy").textContent = "Мои (войдите)";

  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tab === "my" && !user) return loginModal();
    tab = b.dataset.tab; render();
  });
  ["fMaterial", "fDistrict", "fSort"].forEach((id) => $(id).addEventListener("change", render));

  function isMine(o) {
    if (!user) return false;
    return user.role === "customer" ? o.customerId === user.id
      : o.printerId === user.id || o.invitedId === user.id || o.responses.some((r) => r.printerId === user.id);
  }

  function render() {
    const curU = DB.user();
    const canSeeOrders = curU && (curU.role === "printer" || curU.role === "admin");
    const toolbar = document.querySelector(".toolbar");
    const listEl = $("list");
    const emptyEl = $("empty");
    const gateEl = $("ordersGate");

    if (!canSeeOrders) {
      if (toolbar) toolbar.style.display = "none";
      if (listEl) listEl.style.display = "none";
      if (emptyEl) emptyEl.style.display = "none";

      if (!gateEl) {
        const container = document.querySelector(".section.section--tight .container");
        if (container) {
          const div = document.createElement("div");
          div.id = "ordersGate";
          div.innerHTML = `
            <div style="text-align:center;padding:50px 24px;max-width:540px;margin:20px auto;background:var(--bg-card);border:1.5px solid var(--border);border-radius:24px;box-shadow:var(--shadow-md)">
              <div style="font-size:44px;margin-bottom:14px">🖨️</div>
              <h2 style="font-size:24px;margin-bottom:10px">Лента актуальных заказов</h2>
              <p class="muted" style="font-size:15px;line-height:1.55;margin-bottom:24px">
                Раздел предназначен для исполнителей 3D-печати. Здесь мастера Норильска берут заказы в работу и отправляют отклики.
                ${curU ? `<br><br>Вы вошли как <b>заказчик</b> (${esc(curU.name)}). Вы можете отслеживать свои заявки в разделе «Мои заказы» или разместить новую деталь.` : ''}
              </p>
              <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
                ${curU ? `
                  <a href="order.html" class="btn btn--primary">Разместить заказ</a>
                  <a href="my-orders.html" class="btn btn--ghost">📋 Мои заказы</a>
                ` : `
                  <button class="btn btn--primary" id="btnOrdersLoginPrinter">Войти как исполнитель</button>
                  <a href="order.html" class="btn btn--ghost">Разместить заказ</a>
                `}
              </div>
            </div>
          `;
          container.appendChild(div);
          div.querySelector("#btnOrdersLoginPrinter")?.addEventListener("click", () => loginModal("printer"));
        }
      }
      return;
    }

    if (gateEl) gateEl.remove();
    if (toolbar) toolbar.style.display = "";
    if (listEl) listEl.style.display = "";
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    let list = DB.orders();
    if (tab === "open") list = list.filter((o) => o.status === "open");
    if (tab === "scan") list = list.filter((o) => o.type === "scan");
    if (tab === "my") list = list.filter(isMine);
    if ($("fMaterial").value) list = list.filter((o) => o.material === $("fMaterial").value);
    if ($("fDistrict").value) list = list.filter((o) => o.district === $("fDistrict").value);
    const sort = $("fSort").value;
    list.sort((a, b) => {
      // Платный буст: срочные заказы 24ч всегда имеют высший приоритет в ленте
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      return sort === "budget" ? b.budget - a.budget : sort === "deadline" ? a.deadline.localeCompare(b.deadline) : b.createdAt - a.createdAt;
    });

    $("myHint").hidden = tab !== "my";
    if (tab === "my") $("myHint").textContent = user?.role === "customer"
      ? "Ваши опубликованные заказы и предложения мастеров."
      : "Заказы, где вы откликнулись или назначены исполнителем.";

    $("list").innerHTML = list.map(N3DCards.order).join("");
    $("empty").hidden = list.length > 0;
  }

  // Карточка заказа в модалке
  function showOrder(id) {
    const o = DB.order(id);
    if (!o) return toast("Заказ не найден");
    history.replaceState(null, "", "?id=" + id + (tab !== "open" ? "&tab=" + tab : ""));
    const u = DB.user();
    const isOwner = u && u.role === "customer" && u.id === o.customerId;
    const isPrinter = u && u.role === "printer";
    const chosen = o.printerId && DB.printer(o.printerId);
    const isChosen = isPrinter && o.printerId === u.id;
    const myResp = isPrinter && o.responses.find((r) => r.printerId === u.id);
    const isScan = o.type === "scan";
    const ext = isScan ? "СКАН" : o.file.name.split(".").pop().toUpperCase();

    const photosHtml = o.photos && o.photos.length ? `
      <div style="margin: 16px 0">
        <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:8px">Фотографии объекта для сканирования (${o.photos.length} шт.):</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${o.photos.map((p, i) => `
            <div class="scan-photo-thumb" style="width:90px;height:90px;cursor:pointer" data-scan-photo="${esc(p)}">
              <img src="${p}" alt="Фото ${i+1}" />
            </div>
          `).join("")}
        </div>
      </div>
    ` : "";

    const specsHtml = isScan ? `
      <div class="od__grid">
        <div class="spec"><span>Услуга</span><b style="color:#0284c7">🔬 3D-сканирование</b></div>
        <div class="spec"><span>Оригинал</span><b>${esc(o.scanDetails?.originalMaterial || "Пластик")}</b></div>
        <div class="spec"><span>Цель оцифровки</span><b>${esc(o.scanDetails?.purpose || "STL / 3MF")}</b></div>
        <div class="spec"><span>3D-печать</span><b>${o.scanDetails?.needsPrint ? `${o.material} (${o.qty} шт., ${esc(o.color)})` : "Только файл"}</b></div>
        <div class="spec"><span>Габариты</span><b>${esc(o.scanDetails?.dimensions || (o.size ? o.size.join(" × ") + " мм" : "—"))}</b></div>
        <div class="spec"><span>Передача</span><b>${esc(o.scanDetails?.handover || "Лично")}</b></div>
        <div class="spec"><span>Район</span><b>${esc(o.district)}</b></div>
        <div class="spec"><span>Срок до</span><b>${date(o.deadline)}</b></div>
        <div class="spec"><span>Бюджет</span><b class="accent" style="font-size:16px">${money(o.budget)}</b></div>
      </div>
    ` : `
      <div class="od__grid">
        <div class="spec"><span>Материал</span><b>${o.material}</b></div>
        <div class="spec"><span>Цвет</span><b>${esc(o.color)}</b></div>
        <div class="spec"><span>Количество</span><b>${o.qty} шт.</b></div>
        <div class="spec"><span>Заполнение</span><b>${o.infill}%</b></div>
        <div class="spec"><span>Габариты</span><b>${o.size ? o.size.map((v) => v.toFixed(0)).join(" × ") + " мм" : "—"}</b></div>
        <div class="spec"><span>Район</span><b>${esc(o.district)}</b></div>
        <div class="spec"><span>Срок до</span><b>${date(o.deadline)}</b></div>
        <div class="spec"><span>Бюджет</span><b class="accent">${money(o.budget)}</b></div>
        <div class="spec"><span>Файл</span><b>${esc(o.file.name)}</b></div>
      </div>
    `;

    const isUrgent = !!o.urgent;
    const isEscrow = !!o.escrow;
    const isPrivate = !!o.isPrivate;
    const needsModeling = !!o.needsModeling;

    const box = openModal(`
      <div class="od">
        <div class="od__head">
          <div class="ocard__top">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;min-width:0">
              <span class="file-badge ${isScan ? "file-badge--scan" : `file-badge--${ext.toLowerCase()}`}">${isScan ? "🔬 3D-сканирование" : ext}</span>
              ${isUrgent ? `<span class="chip chip--urgent">⚡ СРОЧНО 24ч</span>` : ""}
              ${isEscrow ? `<span class="chip chip--escrow" title="Сделка под защитой гаранта NORD 3D">🛡️ Гарант сделки</span>` : ""}
              ${isPrivate ? `<span class="chip" style="background:rgba(100,116,139,0.12);color:#475569;border-color:rgba(100,116,139,0.3)">🔒 Приватный</span>` : ""}
              ${needsModeling ? `<span class="chip" style="background:rgba(112,72,232,0.1);color:#7048e8;border-color:rgba(112,72,232,0.3)">📐 Моделирование</span>` : ""}
            </div>
            ${statusBadge(o.status)}
          </div>
          <h2>${esc(o.title)}</h2>
          <div class="od__author-row">
            <span>Заказчик: <b>${isPrivate && !isOwner && !isChosen ? "🔒 Приватный клиент" : esc(o.customerName)}</b></span>
            ${Presence.badge(o.customerId)}
            <span class="muted">· ${ago(o.createdAt)}</span>
          </div>
        </div>
        ${photosHtml}
        ${specsHtml}
        ${isEscrow ? `
          <div class="escrow-banner-card" style="margin:16px 0">
            <div class="escrow-banner-icon">🛡️</div>
            <div class="escrow-banner-text">
              <b>Оплата под защитой гаранта NORD 3D</b>
              <span>Бюджет ${money(o.budget)} зарезервирован на безопасном счёте. Мастер гарантированно получит выплату после того, как заказчик проверит готовую деталь.</span>
            </div>
          </div>
        ` : ""}
        ${o.comment ? `<div class="od__comment"><b>Комментарий:</b> ${esc(o.comment)}</div>` : ""}
        <div class="od__action" id="action"></div>
      </div>`, "modal__box--wide");

    box.querySelectorAll("[data-scan-photo]").forEach((el) => {
      el.addEventListener("click", () => {
        N3D.openPhotoModal(el.dataset.scanPhoto, "Деталь для 3D-сканирования");
      });
    });

    const act = box.querySelector("#action");
    const reopen = () => { render(); showOrder(id); };

    // Заказчик
    if (isOwner) {
      if (o.status === "open") {
        act.innerHTML = `
          <h3>Отклики исполнителей (${o.responses.length})</h3>
          ${o.responses.length ? o.responses.map((r) => respCard(r, true, o)).join("") : `
            <div style="background:var(--bg-subtle);border:1px dashed var(--border);border-radius:12px;padding:24px;text-align:center">
              <div style="font-size:32px;margin-bottom:6px">⏳</div>
              <b>Откликов пока нет</b>
              <p class="muted" style="font-size:13px;margin:4px 0 0">
                Заказчик может назначить мастера только после того, как исполнитель примет заказ (откликнется на бирже).
              </p>
            </div>
          `}
        `;
        act.querySelectorAll("[data-pick]").forEach((b) => b.onclick = () => {
          const r = o.responses.find((x) => x.id === b.dataset.pick);
          const p = DB.printer(r.printerId);
          if (!confirm(`Выбрать исполнителя «${p.name}» за ${money(r.price)}?`)) return;
          DB.updateOrder(id, (x) => { x.status = "in_work"; x.printerId = r.printerId; x.budget = r.price; x.assignedAt = Date.now(); });
          Chat.sendMessage(o.customerId, r.printerId, o.id,
            `🤝 Здравствуйте! Я выбрал вас исполнителем заказа #${o.id}! Сделка перешла в статус «В производстве». Жду готовые детали!`);
          toast("Исполнитель выбран!"); reopen();
        });
        act.querySelectorAll("[data-chat]").forEach((b) => b.onclick = () => {
          Chat.openModal(o.customerId, b.dataset.chat, o.id);
        });
      } else {
        act.innerHTML = `
          <h3>Выбранный мастер</h3>
          <div class="contact-card">
            ${avatar(chosen, 44)}
            <div>
              <b>${esc(chosen.name)}</b>
              <div class="muted">${chosen.phone} · 📍 ${chosen.district}</div>
            </div>
            <button class="btn btn--small btn--primary" id="chatChosen">💬 Чат с мастером</button>
          </div>
          ${o.status === "ready" ? `
            <div class="rate-box">
              <p>Мастер напечатал изделие! Оцените качество:</p>
              <div class="rate-stars">${[1,2,3,4,5].map((n) => `<button data-rate="${n}">★</button>`).join("")}</div>
            </div>` : ""}
        `;
        box.querySelector("#chatChosen")?.addEventListener("click", () => Chat.openModal(o.customerId, chosen.id, o.id));
        box.querySelectorAll("[data-rate]").forEach((b) => b.onclick = () => {
          const rateVal = +b.dataset.rate;
          const res = DB.completeOrder(id, { rating: rateVal, printerId: o.printerId || chosen?.id });
          const payout = res?.payout || Math.round((Number(o.budget) || 0) * 0.9);
          toast(`Спасибо за оценку! Выплата ${money(payout)} перечислена на баланс мастера.`);
          reopen();
        });
      }
      return;
    }

    // Исполнитель
    if (isPrinter) {
      if (isChosen) {
        act.innerHTML = `
          <div class="chosen-badge">✓ Вы выбраны исполнителем этого заказа!</div>
          <div class="contact-card" style="margin-top:14px">
            <div>
              <b>Заказчик: ${esc(o.customerName)}</b>
              <div class="muted">${o.customerPhone}</div>
            </div>
            <button class="btn btn--small btn--primary" id="chatCust">💬 Открыть чат с заказчиком</button>
          </div>
          ${o.status === "in_work" ? `<button class="btn btn--wide" style="margin-top:14px" id="readyBtn">✓ Изделие напечатано, готово к передаче</button>` : ""}
        `;
        box.querySelector("#chatCust")?.addEventListener("click", () => Chat.openModal(o.customerId, u.id, o.id));
        box.querySelector("#readyBtn")?.addEventListener("click", () => {
          DB.updateOrder(id, (x) => (x.status = "ready"));
          toast("Заказчику отправлено уведомление о готовности!");
          reopen();
        });
      } else if (myResp) {
        act.innerHTML = `
          <div class="resp-status-card">
            <div class="resp-status-card__info">
              <div class="resp-status-card__icon">✓</div>
              <div>
                <div class="resp-status-card__title">Вы откликнулись на этот заказ</div>
                <div class="resp-status-card__val">Ваше предложение: <b>${money(myResp.price)}</b> за <b>${myResp.days} дн.</b></div>
              </div>
            </div>
            <button class="btn btn--small btn--primary resp-status-card__btn" id="openChatResp">💬 Открыть чат с заказчиком</button>
          </div>
        `;
        box.querySelector("#openChatResp")?.addEventListener("click", () => Chat.openModal(o.customerId, u.id, o.id));
      } else if (o.status === "open") {
        act.innerHTML = `
          <h3>Откликнуться на печать</h3>
          <form class="resp-form" id="respForm">
            <div class="row">
              <div class="field">
                <label>Ваша цена (₽)</label>
                <div class="input-with-icon has-suffix">
                  <span class="input-icon">💰</span>
                  <input name="price" type="number" min="100" value="${o.budget}" required>
                  <span class="input-suffix">₽</span>
                </div>
              </div>
              <div class="field">
                <label>Срок выполнения</label>
                <div class="input-with-icon has-suffix">
                  <span class="input-icon">⏱️</span>
                  <input name="days" type="number" min="1" max="30" value="2" required>
                  <span class="input-suffix">дн.</span>
                </div>
              </div>
            </div>
            <div class="field">
              <label>Комментарий заказчику (отправится сразу в чат)</label>
              <div class="input-with-icon input-with-icon--textarea">
                <span class="input-icon">💬</span>
                <textarea name="message" rows="3" placeholder="На каком принтере будете печатать, точность, цвет... Сообщение сразу поступит в чат заказчика."></textarea>
              </div>
            </div>
            <div class="resp-form__actions">
              <button class="btn btn--primary" type="submit">Предложить цену</button>
              <button type="button" class="btn btn--ghost" id="chatFirst">💬 Задать вопрос в чате</button>
            </div>
          </form>
        `;
        box.querySelector("#chatFirst")?.addEventListener("click", () => Chat.openModal(o.customerId, u.id, o.id));
        let isRespSubmitting = false;
        box.querySelector("#respForm").onsubmit = (e) => {
          e.preventDefault();
          if (isRespSubmitting) return;
          const f = e.target;
          const submitBtn = f.querySelector('button[type="submit"]');
          isRespSubmitting = true;
          if (submitBtn) submitBtn.disabled = true;

          const priceVal = +f.price.value;
          const daysVal = +f.days.value;
          const msgVal = f.message ? f.message.value.trim() : "";

          DB.updateOrder(id, (x) => x.responses.push({
            id: "r" + uid(),
            printerId: u.id,
            price: priceVal,
            days: daysVal,
            createdAt: Date.now()
          }));

          // Отправляем комментарий сразу в чат заказчика
          const offerHeader = `Здравствуйте! Предлагаю выполнить ваш заказ: ${money(priceVal)} за ${daysVal} дн.`;
          const chatMsg = msgVal ? `${offerHeader}\n\n${msgVal}` : offerHeader;
          Chat.sendMessage(o.customerId, u.id, o.id, chatMsg);

          toast("Отклик и сообщение отправлены заказчику в чат!");
          reopen();
        };
      }
      return;
    }

    // Гость
    act.innerHTML = `
      <div class="cta-box">
        <div class="cta-box__info">
          <div class="cta-box__icon">👥</div>
          <div>
            <div class="cta-box__title">Откликов от мастеров: <b>${o.responses.length}</b></div>
            <div class="cta-box__hint">
              ${o.responses.length ? "Мастера уже предложили свои условия" : "Станьте первым исполнителем этого заказа"}
            </div>
          </div>
        </div>
        <button class="btn btn--primary cta-box__btn" onclick="N3D.loginModal('printer')">
          Войти как мастер и откликнуться
        </button>
      </div>
    `;
  }

  function respCard(r, withPick, o) {
    const p = DB.printer(r.printerId) || { name: "Мастер", district: "", rating: 5, reviews: 1, done: 1 };
    const agoText = r.createdAt ? ago(r.createdAt) : "";
    return `
      <div class="resp-item">
        <div class="resp-item__top">
          <div class="resp-item__master">
            ${avatar(p, 42)}
            <div>
              <div class="resp-item__name-row">
                <b class="resp-item__name">${esc(p.name)}</b>
                ${Presence.badge(p.id)}
              </div>
              <div class="resp-item__sub">
                ${stars(p.rating)}
                <span class="muted">·</span>
                <span class="muted">📍 ${esc(p.district || "Норильск")}</span>
                ${p.equipment ? `<span class="muted">· 🖨️ ${esc(p.equipment.split(',')[0])}</span>` : ""}
              </div>
            </div>
          </div>
          <div class="resp-item__price-box">
            <div class="resp-item__price">${money(r.price)}</div>
            <div class="resp-item__days">⏱️ Срок: <b>${r.days} дн.</b></div>
          </div>
        </div>
        ${r.message ? `
          <div class="resp-item__msg">
            <span class="resp-item__msg-icon">💬</span>
            <div class="resp-item__msg-text">${esc(r.message)}</div>
          </div>
        ` : ""}
        <div class="resp-item__footer">
          <div class="resp-item__meta">
            ${agoText ? `<span class="muted">🕒 ${agoText}</span>` : ""}
            ${o && o.escrow ? `<span class="chip chip--escrow" style="font-size:11px;padding:2px 8px">🛡️ Гарант сделки</span>` : ""}
          </div>
          <div class="resp-item__actions">
            <button class="btn btn--small btn--ghost" data-chat="${r.printerId}">💬 Чат с мастером</button>
            ${withPick ? `<button class="btn btn--small btn--primary" data-pick="${r.id}">Выбрать мастера</button>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  render();
  if (qs("id")) showOrder(qs("id"));
})();
