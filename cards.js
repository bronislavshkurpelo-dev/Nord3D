// NORD 3D — карточки заказов и мастеров с онлайн-статусом, технологиями и чатом
(() => {
  "use strict";
  const { esc, money, date, ago, avatar, stars, statusBadge, Presence, Chat, DB } = N3D;

  function order(o) {
    const isScan = o.type === "scan";
    const ext = isScan ? "СКАН" : (o.file?.name ? o.file.name.split(".").pop().toUpperCase() : "3D");
    const n = o.responses ? o.responses.length : 0;
    const resp = o.status === "open" ? `${n} ${plural(n, "отклик", "отклика", "откликов")}` : "";
    const isUrgent = !!o.urgent;
    const isEscrow = !!o.escrow;
    const needsModeling = !!o.needsModeling;

    return `
      <div class="ocard ${isUrgent ? "ocard--urgent" : ""}" onclick="location.href='orders.html?id=${encodeURIComponent(o.id)}'">
        <div class="ocard__top">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;min-width:0">
            <span class="file-badge ${isScan ? "file-badge--scan" : `file-badge--${ext.toLowerCase()}`}">${isScan ? "🔬 СКАН" : ext}</span>
            ${isUrgent ? `<span class="chip chip--urgent">⚡ СРОЧНО 24ч</span>` : ""}
            ${isEscrow ? `<span class="chip chip--escrow" title="Сделка под защитой гаранта NORD 3D">🛡️ Гарант</span>` : ""}
          </div>
          ${statusBadge(o.status)}
        </div>
        <h3>${esc(o.title)}</h3>
        <div class="chips">
          ${isScan ? `<span class="chip" style="background:rgba(2,132,199,0.12);color:#0284c7;font-weight:800;border-color:rgba(56,189,248,0.4)">🔬 3D-сканирование</span>` : ""}
          <span class="chip chip--${(o.material || "PLA").toLowerCase()}">${isScan && o.scanDetails?.needsPrint ? `Печать: ${o.material}` : o.material}</span>
          ${o.size ? `<span class="chip">${o.size.map((v) => Math.round(v)).join("×")} мм</span>` : ""}
          ${isScan && o.scanDetails?.originalMaterial ? `<span class="chip">Оригинал: ${esc(o.scanDetails.originalMaterial.split(" / ")[0])}</span>` : ""}
          ${needsModeling ? `<span class="chip" style="background:rgba(112,72,232,0.1);color:#7048e8;border-color:rgba(112,72,232,0.3)">📐 Моделирование</span>` : ""}
          <span class="chip">📍 ${esc(o.district)}</span>
        </div>
        <div class="ocard__bottom">
          <div><small>Бюджет</small><b>${money(o.budget)}</b></div>
          <div><small>Срок до</small><b>${date(o.deadline)}</b></div>
        </div>
        <div class="ocard__meta">
          <span>${ago(o.createdAt)}</span>
          <span class="accent">${resp}</span>
        </div>
      </div>`;
  }

  function printer(p) {
    const u = DB.user();
    const myId = u ? u.id : "c79990001122";
    const techs = (p.tech || ["fdm"]).map((t) => t === "scan" ? "3D-СКАН" : t.toUpperCase()).join(" + ");
    const hasScan = (p.tech && p.tech.includes("scan")) || (p.services && p.services.includes("scanning")) || !!p.scannerEquipment;

    return `
      <article class="pcard" data-printer-id="${esc(p.id)}">
        <div class="pcard__head" onclick="N3DCards.openPrinterModal('${esc(p.id)}')" style="cursor:pointer">
          ${avatar(p, 52)}
          <div class="pcard__head-info">
            <div class="pcard__title-row">
              <h3>${esc(p.name)}</h3>
              ${Presence.badge(p.id)}
            </div>
            <small>📍 ${esc(p.district)} · с ${esc(p.since)} г.</small>
          </div>
        </div>
        <div class="pcard__stats" onclick="N3DCards.openPrinterModal('${esc(p.id)}')" style="cursor:pointer" title="Нажмите, чтобы посмотреть отзывы и рейтинг">
          <div class="pcard__stat-item pcard__stat-item--rating">
            <div class="pcard__stat-stars">${stars(p.rating)}</div>
            <small>${p.reviews} ${plural(p.reviews, "отзыв", "отзыва", "отзывов")}</small>
          </div>
          <div class="pcard__stat-item">
            <b>${p.done}</b>
            <small>заказов</small>
          </div>
          <div class="pcard__stat-item">
            <b>от ${p.pricePerGram} ₽</b>
            <small>за грамм</small>
          </div>
        </div>
        <p class="pcard__about">${esc(p.about || "Печать 3D-деталей в Норильске.")}</p>
        <div class="chips">
          <span class="chip" style="background:#f0fdf4;color:#166534;font-weight:700">⚙️ ${techs}</span>
          ${hasScan ? `<span class="chip" style="background:rgba(2,132,199,0.12);color:#0284c7;font-weight:700;border-color:rgba(56,189,248,0.3)">🔬 3D-сканирование</span>` : ""}
          ${(p.materials || []).map((m) => {
            const pr = p.materialPrices && p.materialPrices[m] ? ` · ${p.materialPrices[m]} ₽` : "";
            return `<span class="chip chip--${m.toLowerCase()}">${m}${pr}</span>`;
          }).join("")}
          ${(p.specMaterials || []).map((m) => {
            const pr = p.materialPrices && p.materialPrices[m] ? ` · ${p.materialPrices[m]} ₽` : "";
            return `<span class="chip chip--spec chip--${m.toLowerCase()}">⭐ ${m}${pr}</span>`;
          }).join("")}
          ${p.customMatName ? `<span class="chip chip--spec">⭐ ${esc(p.customMatName)}${p.customMatPrice ? ` · ${p.customMatPrice} ₽` : (p.materialPrices?.[p.customMatName] ? ` · ${p.materialPrices[p.customMatName]} ₽` : "")}</span>` : ""}
          <span class="chip">🖨️ ${esc(p.equipment)}</span>
          ${p.buildArea ? `<span class="chip">📐 ${esc(p.buildArea)}</span>` : ""}
          ${p.scannerEquipment ? `<span class="chip" style="background:rgba(2,132,199,0.1);color:#0284c7;font-weight:700;border-color:rgba(56,189,248,0.3)">🔬 ${esc(p.scannerEquipment)}</span>` : ""}
          ${p.scannerAccuracy ? `<span class="chip">🎯 ${esc(p.scannerAccuracy)}</span>` : ""}
        </div>
        <div class="pcard__actions">
          <button class="btn btn--small btn--ghost" onclick="N3DCards.openPrinterModal('${esc(p.id)}')">⭐ Отзывы (${p.reviews})</button>
          <a class="btn btn--small btn--ghost" href="order.html?printer=${encodeURIComponent(p.id)}">Заказ</a>
          <button class="btn btn--small btn--primary" onclick="N3D.Chat.openModal('${myId}','${p.id}')">💬 Чат</button>
        </div>
      </article>`;
  }

  function openPrinterModal(printerId) {
    const p = DB.printer(printerId);
    if (!p) return;
    const u = DB.user();
    const myId = u ? u.id : "c79990001122";
    const reviews = DB.reviews(p.id) || [];
    const techs = (p.tech || ["fdm"]).map((t) => t === "scan" ? "3D-СКАН" : t.toUpperCase()).join(" + ");
    const hasScan = (p.tech && p.tech.includes("scan")) || (p.services && p.services.includes("scanning")) || !!p.scannerEquipment;

    const modalBox = N3D.openModal(`
      <div class="printer-profile-modal" style="max-width:760px;margin:0 auto">
        <div class="pcard__head" style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">
          ${avatar(p, 64)}
          <div class="pcard__head-info">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
              <h2 style="font-size:22px;margin:0">${esc(p.name)}</h2>
              ${Presence.badge(p.id)}
            </div>
            <div class="muted" style="font-size:13.5px">
              📍 ${esc(p.district)} · На платформе с ${esc(p.since)} г. · Телефон: <b>${esc(p.phone || "—")}</b>
            </div>
          </div>
        </div>

        <div class="pcard__stats" style="margin-bottom:20px;padding:12px;background:var(--bg-subtle);border-radius:14px;border:1px solid var(--border)">
          <div class="pcard__stat-item">
            <div style="font-size:18px">${stars(p.rating)}</div>
            <b style="font-size:15px;color:var(--text)">${p.rating.toFixed(1)}</b>
            <small class="muted">${p.reviews} ${plural(p.reviews, "отзыв", "отзыва", "отзывов")}</small>
          </div>
          <div class="pcard__stat-item">
            <b style="font-size:18px;color:var(--text)">${p.done}</b>
            <small class="muted">успешных заказов</small>
          </div>
          <div class="pcard__stat-item">
            <b style="font-size:18px;color:var(--accent)">от ${p.pricePerGram} ₽</b>
            <small class="muted">за грамм печати</small>
          </div>
        </div>

        <div style="margin-bottom:20px">
          <h4 style="font-size:15px;margin-bottom:8px">О мастере и мастерской</h4>
          <p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin:0">
            ${esc(p.about || "Качественная 3D-печать и быстрое выполнение заказов в Норильске.")}
          </p>
        </div>

        <div style="margin-bottom:20px">
          <h4 style="font-size:15px;margin-bottom:8px">Оборудование и материалы</h4>
          <div class="chips" style="gap:8px">
            <span class="chip" style="background:#f0fdf4;color:#166534;font-weight:700">⚙️ ${techs}</span>
            ${hasScan ? `<span class="chip" style="background:rgba(2,132,199,0.12);color:#0284c7;font-weight:700;border-color:rgba(56,189,248,0.3)">🔬 3D-сканирование</span>` : ""}
            <span class="chip">🖨️ ${esc(p.equipment)}</span>
            ${p.buildArea ? `<span class="chip">📐 Область: ${esc(p.buildArea)}</span>` : ""}
            ${p.scannerEquipment ? `<span class="chip" style="background:rgba(2,132,199,0.1);color:#0284c7;font-weight:700">🔬 Сканер: ${esc(p.scannerEquipment)}</span>` : ""}
            ${p.scannerAccuracy ? `<span class="chip">🎯 Точность: ${esc(p.scannerAccuracy)}</span>` : ""}
            ${(p.materials || []).map((m) => `<span class="chip chip--${m.toLowerCase()}">${m}${p.materialPrices?.[m] ? ` · ${p.materialPrices[m]} ₽/г` : ""}</span>`).join("")}
            ${(p.specMaterials || []).map((m) => `<span class="chip chip--spec chip--${m.toLowerCase()}">⭐ ${m}${p.materialPrices?.[m] ? ` · ${p.materialPrices[m]} ₽/г` : ""}</span>`).join("")}
          </div>
        </div>

        <!-- Раздел портфолио мастера -->
        ${(() => {
          const pList = (DB.portfolio && DB.portfolio(p.id)) || [];
          if (!pList.length) return "";
          return `
            <div style="margin-bottom:22px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <h4 style="font-size:15.5px;margin:0">
                  📸 Работы из портфолио мастера (${pList.length})
                </h4>
                <a href="portfolio.html?printer=${encodeURIComponent(p.id)}" class="link-more" style="font-size:12.5px">Смотреть все →</a>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:10px">
                ${pList.slice(0, 3).map((item) => {
                  const r = (reviews || []).find((x) => x.orderId === item.orderId);
                  return `
                    <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:12px;overflow:hidden">
                      <img src="${esc(item.photo)}" alt="${esc(item.title)}" style="width:100%;height:115px;object-fit:cover;display:block" />
                      <div style="padding:8px 10px">
                        <b style="font-size:12.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px">${esc(item.title)}</b>
                        <span class="chip chip--sm chip--${(item.material || 'petg').toLowerCase()}">${esc(item.material || 'PETG')}</span>
                        ${r ? `
                          <div style="margin-top:6px;font-size:11px;color:#0ca678;display:flex;align-items:center;gap:4px">
                            <span>🛡️</span> <b>Отзыв:</b> ⭐ ${(r.score || 5).toFixed(1)}
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        })()}

        <!-- Раздел отзывов -->
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h4 style="font-size:16px;margin:0">
              ⭐ Отзывы и оценки заказчиков (${reviews.length})
            </h4>
            <span class="muted" style="font-size:12.5px">Сделки с подтверждённой приёмкой</span>
          </div>

          <div class="printer-reviews-list" style="display:flex;flex-direction:column;gap:12px;max-height:360px;overflow-y:auto;padding-right:4px">
            ${reviews.length ? reviews.map((r) => `
              <div class="review-card-item" style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:14px;padding:14px 16px">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px">
                  <div style="display:flex;align-items:center;gap:10px">
                    ${avatar({ name: r.customerName, avatar: r.customerAvatar }, 36)}
                    <div>
                      <b style="font-size:14px;color:var(--text)">${esc(r.customerName)}</b>
                      <div class="muted" style="font-size:11.5px">📍 ${esc(r.district || "Норильск")} · ${ago(r.date)}</div>
                    </div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:14px">${stars(r.score)}</div>
                    ${r.verifiedEscrow ? `<small style="font-size:11px;color:#0ca678;font-weight:700">🛡️ Гарант NORD 3D</small>` : ""}
                  </div>
                </div>
                ${r.serviceName ? `
                  <div style="margin-bottom:6px">
                    <span class="chip" style="font-size:11px;padding:2px 8px;background:rgba(2,132,199,0.08);color:#0284c7;border-color:rgba(2,132,199,0.2)">
                      ${esc(r.serviceName)}
                    </span>
                  </div>
                ` : ""}
                <p style="font-size:13.5px;color:var(--text);margin:0;line-height:1.45">
                  ${esc(r.comment)}
                </p>
              </div>
            `).join("") : `
              <div style="text-align:center;padding:24px;background:var(--bg-subtle);border-radius:14px;border:1px dashed var(--border)">
                <div style="font-size:32px;margin-bottom:6px">💬</div>
                <b>Пока нет отзывов</b>
                <p class="muted" style="font-size:13px;margin:4px 0 0">Станьте первым, кто сделает заказ у этого мастера!</p>
              </div>
            `}
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:16px">
          <button class="btn btn--ghost" onclick="N3D.closeModal()">Закрыть</button>
          <a class="btn btn--ghost" href="order.html?printer=${encodeURIComponent(p.id)}">🚀 Предложить заказ</a>
          <button class="btn btn--primary" onclick="N3D.closeModal();N3D.Chat.openModal('${myId}','${p.id}')">💬 Написать в чат</button>
        </div>
      </div>
    `, "modal__box--wide");
  }

  function plural(n, a, b, c) {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c;
  }

  // Модальное окно оценки мастера и отзыва после завершения заказа
  function openReviewModal(order, onDone) {
    if (!order) return;
    const { openModal, closeModal, toast } = N3D;
    const currentUser = DB.user();
    if (!currentUser) return;
    const printer = DB.printer(order.printerId);
    let selectedRating = order.rating || 5;

    const modalBox = openModal(`
      <div class="modal-form-wrap" style="max-width:480px;margin:0 auto;padding:6px 4px">
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:42px;margin-bottom:6px">⭐</div>
          <h2 style="font-size:22px;margin-bottom:4px">Оцените работу мастера</h2>
          <p class="muted" style="font-size:13.5px;margin:0">
            Заказ #${esc(order.id)} «${esc(order.title)}» выполнен. Ваш отзыв поможет другим заказчикам Норильска!
          </p>
        </div>

        <form id="orderReviewModalForm" class="form">
          <div class="field" style="margin-bottom:16px;text-align:center">
            <label style="font-size:13px;font-weight:700;display:block;margin-bottom:8px">Общая оценка работы</label>
            <div class="star-rating-picker" id="starPickerGroup" style="display:flex;justify-content:center;gap:10px;font-size:32px;cursor:pointer;user-select:none">
              <span data-star="1" style="color:#f59f00">★</span>
              <span data-star="2" style="color:#f59f00">★</span>
              <span data-star="3" style="color:#f59f00">★</span>
              <span data-star="4" style="color:#f59f00">★</span>
              <span data-star="5" style="color:#f59f00">★</span>
            </div>
            <small class="muted" id="starPickerHint" style="font-size:12px;margin-top:6px;display:block">Отлично, всё идеально (5 из 5)</small>
          </div>

          <div class="field" style="margin-bottom:20px">
            <label style="font-size:13px;font-weight:700;margin-bottom:6px;display:block">Ваш отзыв о детали и мастере</label>
            <textarea name="comment" rows="4" placeholder="Опишите качество печати, точность размеров, прочность материала и соблюдение сроков..." style="width:100%;border-radius:12px;padding:12px;font-size:13.5px;box-sizing:border-box" required>Отличная работа! Деталь подошла идеально, размеры точные, печать прочная и аккуратная. Рекомендую мастера!</textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button type="button" class="btn btn--ghost" id="btnCancelReview">Позже</button>
            <button type="submit" class="btn btn--primary" id="btnSubmitReview" style="font-weight:800;padding:0 24px">
              Опубликовать отзыв
            </button>
          </div>
        </form>
      </div>
    `);

    const form = modalBox.querySelector("#orderReviewModalForm");
    const starsSpans = modalBox.querySelectorAll("#starPickerGroup span");
    const hint = modalBox.querySelector("#starPickerHint");

    const hints = [
      "",
      "Очень плохо (1 из 5)",
      "Есть замечания (2 из 5)",
      "Нормально, деталь работает (3 из 5)",
      "Хорошо, качественная печать (4 из 5)",
      "Отлично, всё идеально (5 из 5)"
    ];

    const updateStars = (val) => {
      selectedRating = val;
      starsSpans.forEach((s) => {
        const starVal = +s.dataset.star;
        s.style.color = starVal <= val ? "#f59f00" : "var(--border)";
      });
      if (hint) hint.textContent = hints[val] || `${val} из 5`;
    };

    starsSpans.forEach((s) => {
      s.addEventListener("click", () => updateStars(+s.dataset.star));
    });

    modalBox.querySelector("#btnCancelReview")?.addEventListener("click", closeModal);

    let isReviewSubmitting = false;
    form.onsubmit = (e) => {
      e.preventDefault();
      if (isReviewSubmitting) return;
      isReviewSubmitting = true;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const commentText = form.comment.value.trim();

      DB.updateOrder(order.id, (o) => {
        o.rating = selectedRating;
        o.hasReviewed = true;
      });

      DB.addReview({
        printerId: order.printerId,
        customerId: currentUser.id,
        customerName: currentUser.name,
        customerAvatar: currentUser.avatar,
        district: currentUser.district || order.district,
        orderId: order.id,
        orderTitle: order.title,
        service: order.type === "scan" ? "scan" : "fdm",
        serviceName: order.type === "scan" ? "3D-сканирование и реверс" : `3D-печать (${order.material || "PETG"})`,
        score: selectedRating,
        accuracyScore: selectedRating,
        speedScore: selectedRating,
        commScore: 5,
        comment: commentText,
        verifiedEscrow: !!order.escrow
      });

      closeModal();
      toast("Отзыв и оценка успешно сохранены!");
      window.dispatchEvent(new CustomEvent("n3d:data-updated"));
      if (typeof onDone === "function") onDone();
    };
  }

  window.N3DCards = { order, printer, plural, openPrinterModal, openReviewModal };
  if (typeof N3D !== "undefined") {
    N3D.openPrinterModal = openPrinterModal;
    N3D.openReviewModal = openReviewModal;
  }
})();
