
  async function triggerSlicing(file, m) {
    const box = $("slicerResultBox");
    if (!box) return;
    box.hidden = false;
    $("slicerTime").textContent = "Нарезка слоёв G-Code...";
    $("slicerWeight").textContent = "—";
    $("slicerMeters").textContent = "—";
    $("slicerLayers").textContent = "—";
    if ($("slicerDownloadBox")) $("slicerDownloadBox").hidden = true;

    try {
      const mat = document.querySelector('input[name="material"]:checked')?.value || "PETG";
      const res = await fetch("/api/slice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: file.name,
          material: mat,
          infill: 25,
          layerHeight: 0.20
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          $("slicerTime").textContent = data.printTimeFormatted || "2 ч 15 мин";
          $("slicerWeight").textContent = (data.weightGrams || 42) + " г";
          $("slicerMeters").textContent = (data.lengthMeters || 14) + " м";
          $("slicerLayers").textContent = data.totalLayers || 220;
          if (data.gcodeUrl && $("slicerDownloadBox") && $("btnDownloadGcode")) {
            $("slicerDownloadBox").hidden = false;
            $("btnDownloadGcode").href = data.gcodeUrl;
          }
          return;
        }
      }
    } catch (e) {
      console.warn("Slicing API error, using estimate:", e);
    }

    // Fallback расчет
    const estWeight = Math.max(15, Math.round((m.volume / 1000) * 1.25));
    $("slicerTime").textContent = Math.max(1, Math.round(estWeight / 20)) + " ч " + Math.round((estWeight % 20) * 2.5) + " мин";
    $("slicerWeight").textContent = estWeight + " г";
    $("slicerMeters").textContent = Math.round(estWeight / 3) + " м";
    $("slicerLayers").textContent = Math.round((m.size ? m.size[2] : 40) / 0.20) || 180;
  }

// NORD 3D — логика загрузки и оформления заказа со всеми 5 материалами
(() => {
  "use strict";
  const { DB, DISTRICTS, MATERIALS, esc, money, estimate, uid, requireUser, qs, toast } = N3D;
  const $ = (id) => document.getElementById(id);
  const MAX_BUILD = [256, 256, 256];

  
  // Проверка авторизации для гостей при прямом переходе на страницу
  if (typeof N3D !== "undefined" && N3D.DB && !N3D.DB.user()) {
    N3D.loginModal("customer", () => {
      location.reload();
    }, "Для размещения заказа на 3D-печать, пожалуйста, зарегистрируйтесь или войдите");
  }

  const viewer = N3DModel.createViewer($("preview"));
  const dropzone = $("dropzone"), fileInput = $("fileInput");
  let model = null;
  let budgetTouched = false;

  $("district").innerHTML = DISTRICTS.map((d) => `<option>${d}</option>`).join("");
  const d = new Date(Date.now() + 4 * 86400000);
  $("deadline").value = d.toISOString().slice(0, 10);
  $("deadline").min = new Date().toISOString().slice(0, 10);

  const invited = qs("printer") && DB.printer(qs("printer"));
  if (invited) {
    $("invite").hidden = false;
    $("invite").innerHTML = `✉️ Заказ будет персонально предложен мастеру <b>${esc(invited.name)}</b> (${esc(invited.district)}).`;
    $("district").value = invited.district;
  }

  // Загрузка файла
  fileInput.addEventListener("change", () => fileInput.files[0] && handleFile(fileInput.files[0]));
  ["dragenter", "dragover"].forEach((e) => dropzone.addEventListener(e, (ev) => { ev.preventDefault(); dropzone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((e) => dropzone.addEventListener(e, (ev) => { ev.preventDefault(); dropzone.classList.remove("drag"); }));
  dropzone.addEventListener("drop", (ev) => ev.dataTransfer.files[0] && handleFile(ev.dataTransfer.files[0]));
  dropzone.addEventListener("click", (e) => { if (viewer.wasDragged()) e.preventDefault(); });

  function warn(t) { $("modelWarn").textContent = t; $("modelWarn").hidden = !t; }

  async function handleFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    warn("");
    if (!["stl", "3mf"].includes(ext)) return warn("Принимаются только файлы STL и 3MF.");
    if (file.size > 100 * 1024 * 1024) return warn("Файл больше 100 МБ.");

    $("dropHint").hidden = false;
    $("dropHint").style.display = "flex";
    $("dropHint").innerHTML = `<div class="spinner"></div><b>Анализируем геометрию...</b>`;

    try {
      const m = await N3DModel.readModel(file);
      model = { file, volume: m.volume, size: m.size };
      $("modelInfo").hidden = false;
      $("infoName").textContent = file.name;
      $("infoSize").textContent = m.size.map((v) => v.toFixed(1)).join(" × ") + " мм";
      $("infoVolume").textContent = (m.volume / 1000).toFixed(2) + " см³";
      $("infoTris").textContent = (m.triCount || (m.tris.length / 9)).toLocaleString("ru-RU");

      const desc = (a) => [...a].sort((x, y) => y - x), b = desc(MAX_BUILD);
      if (desc(m.size).some((v, i) => v > b[i])) warn(`Габариты превышают 256 мм — мастеру потребуется разделить модель.`);

      if (!$("title").value) $("title").value = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      $("dropHint").hidden = true;
      $("dropHint").style.display = "none";
      $("rotateHint").hidden = false;
      $("rotateHint").style.display = "block";
      viewer.show(m.tris, m);
      triggerSlicing(file, m);
    } catch (err) {
      console.warn("Parse error:", err);
      viewer.clear();
      model = { file, volume: 0, size: null };
      $("modelInfo").hidden = true;
      $("rotateHint").hidden = true;
      $("rotateHint").style.display = "none";
      $("dropHint").hidden = false;
      $("dropHint").style.display = "flex";
      $("dropHint").innerHTML = `<div class="dropzone__icon">✓</div><b>${esc(file.name)}</b><span>Файл принят, расчет сделает исполнитель.</span>`;
    }
    updateEstimate();
  }

  const material = () => document.querySelector("[name=material]:checked")?.value || "PLA";
  const qty = () => Math.max(1, Math.min(500, parseInt($("quantity").value, 10) || 1));
  let lastEstimate = null;

  function updateEstimate() {
    const matKey = material();
    const isResin = matKey === "RESIN";
    $("infillField").style.opacity = isResin ? "0.4" : "1";
    $("infill").disabled = isResin;
    $("infillVal").textContent = isResin ? "Сплошное (смола)" : $("infill").value + "%";

    if (viewer && viewer.setColor && MATERIALS[matKey]) {
      viewer.setColor(MATERIALS[matKey].color);
    }

    const e = model && estimate(model.volume, matKey, isResin ? 100 : +$("infill").value, qty());
    lastEstimate = e ? e.total : null;
    if (e) {
      $("estimate").textContent = money(e.total);
      $("estimateNote").textContent = `≈ ${e.grams.toFixed(1)} г материала · минимальный заказ 500 ₽`;
      if (!budgetTouched) $("budget").value = e.total;
    } else {
      $("estimate").textContent = model ? "оценят мастера" : "загрузите модель";
    }
  }

  $("budget").addEventListener("input", () => (budgetTouched = true));
  ["input", "change"].forEach((ev) => [
    $("infill"), $("quantity"), ...document.querySelectorAll("[name=material]")
  ].forEach((el) => el.addEventListener(ev, updateEstimate)));

  updateEstimate();

  // Рендер динамического блока монетизации (Безопасная сделка + Платный буст)
  function renderMonetizationOptions() {
    const box = $("monetizationContainer");
    if (!box) return;
    const cfg = DB.monetization ? DB.monetization() : { escrowEnabled: true, boostEnabled: true, escrowCommissionPercent: 10, urgentPrice: 250, privatePrice: 150, modelingPrice: 500 };
    
    let html = "";
    if (cfg.boostEnabled) {
      html += `
        <div class="paid-options-block">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <h4 style="margin:0;font-size:15px;display:flex;align-items:center;gap:6px">
              ⚡ <span>Платные опции продвижения (Boost)</span>
            </h4>
            <span class="badge" style="background:rgba(245,158,11,0.12);color:#d97706;border:1px solid rgba(245,158,11,0.3);font-size:11.5px;font-weight:700">Опционально</span>
          </div>
          <p class="muted" style="font-size:12.5px;margin:0 0 12px">Увеличьте скорость откликов и защитите проект от публичного просмотра.</p>
          <div class="paid-options-grid">
            <label class="paid-option-card" id="cardOptUrgent">
              <input type="checkbox" id="optUrgent" />
              <div class="paid-option-content">
                <div class="paid-option-title">
                  <span>⚡ Срочный заказ (24ч)</span>
                  <span class="paid-option-price">+${money(cfg.urgentPrice)}</span>
                </div>
                <div class="paid-option-desc">Золотое неоновое свечение в ленте, закрепление на первом месте, приоритетное уведомление мастеров.</div>
              </div>
            </label>

            <label class="paid-option-card" id="cardOptPrivate">
              <input type="checkbox" id="optPrivate" />
              <div class="paid-option-content">
                <div class="paid-option-title">
                  <span>🔒 Приватный заказ</span>
                  <span class="paid-option-price">+${money(cfg.privatePrice)}</span>
                </div>
                <div class="paid-option-desc">Ваше имя, контакты и файлы модели скрыты в открытом доступе до выбора исполнителя.</div>
              </div>
            </label>

            <label class="paid-option-card" id="cardOptModeling">
              <input type="checkbox" id="optModeling" />
              <div class="paid-option-content">
                <div class="paid-option-title">
                  <span>📐 3D-моделирование</span>
                  <span class="paid-option-price">+${money(cfg.modelingPrice)}</span>
                </div>
                <div class="paid-option-desc">Мастер исправит сетку, оптимизирует толщину стенок или доработает модель под печать.</div>
              </div>
            </label>
          </div>
        </div>
      `;
    }

    if (cfg.escrowEnabled) {
      html += `
        <div class="escrow-banner-card">
          <div class="escrow-banner-icon">🛡️</div>
          <div class="escrow-banner-text">
            <b>Безопасная сделка NORD 3D включена</b>
            <span>Оплата резервируется на гарантийном счёте платформы (комиссия сервиса ${cfg.escrowCommissionPercent}%). Мастер получит деньги только после того, как вы подтвердите приёмку готового изделия.</span>
          </div>
        </div>
      `;
    }

    box.innerHTML = html;

    ["optUrgent", "optPrivate", "optModeling"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("change", () => {
          el.closest(".paid-option-card")?.classList.toggle("selected", el.checked);
        });
      }
    });
  }

  renderMonetizationOptions();
  window.addEventListener("n3d:data-updated", renderMonetizationOptions);

  let isSubmitting = false;
  $("orderForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const msg = $("formMsg");
    const submitBtn = $("orderForm").querySelector('button[type="submit"]');
    const fail = (t) => {
      msg.textContent = t;
      msg.className = "form-msg err";
      isSubmitting = false;
      if (submitBtn) submitBtn.disabled = false;
    };

    if (!model) return fail("Пожалуйста, прикрепите 3D-модель (STL или 3MF).");
    const title = $("title").value.trim();
    if (!title) return fail("Укажите название заказа.");
    const budget = parseInt($("budget").value, 10);
    if (!budget || budget < 100) return fail("Укажите бюджет от 100 ₽.");

    isSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    const cfg = DB.monetization ? DB.monetization() : {};
    const isUrgent = !!(cfg.boostEnabled && $("optUrgent")?.checked);
    const isPrivate = !!(cfg.boostEnabled && $("optPrivate")?.checked);
    const needsModeling = !!(cfg.boostEnabled && $("optModeling")?.checked);
    let boostFee = 0;
    if (isUrgent) boostFee += (cfg.urgentPrice || 250);
    if (isPrivate) boostFee += (cfg.privatePrice || 150);
    if (needsModeling) boostFee += (cfg.modelingPrice || 500);

    const isEscrow = !!cfg.escrowEnabled;

    requireUser("customer", (u) => {
      const order = {
        id: "o" + uid(),
        title,
        customerId: u.id,
        customerName: u.name,
        customerPhone: u.phone,
        file: { name: model.file.name, size: model.file.size },
        volume: model.volume,
        size: model.size,
        material: material(),
        color: $("color").value,
        qty: qty(),
        infill: material() === "RESIN" ? 100 : +$("infill").value,
        quality: "normal",
        deadline: $("deadline").value,
        district: $("district").value,
        budget,
        estimate: lastEstimate,
        comment: $("comment").value.trim(),
        status: "open",
        urgent: isUrgent,
        isPrivate: isPrivate,
        needsModeling: needsModeling,
        boostFee: boostFee,
        escrow: isEscrow,
        escrowCommissionPercent: isEscrow ? (cfg.escrowCommissionPercent || 10) : 0,
        escrowStatus: isEscrow ? "held" : "none",
        responses: [],
        printerId: null,
        rating: null,
        invitedId: invited ? invited.id : null,
        createdAt: Date.now(),
      };
      const list = DB.orders();
      list.push(order);
      DB.saveOrders(list);
      toast("Заказ опубликован на бирже!");
      setTimeout(() => (location.href = "orders.html?id=" + order.id), 500);
    });
  });
})();
