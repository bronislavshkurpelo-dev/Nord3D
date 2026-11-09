// NORD 3D — логика оформления заказа на 3D-сканирование и реверс-инжиниринг
(() => {
  "use strict";
  const { DB, DISTRICTS, money, uid, requireUser, toast, compressImage, openPhotoModal } = N3D;
  const $ = (id) => document.getElementById(id);

  
  // Проверка авторизации для гостей при прямом переходе на страницу
  if (typeof N3D !== "undefined" && N3D.DB && !N3D.DB.user()) {
    N3D.loginModal("customer", () => {
      location.reload();
    }, "Для заказа 3D-сканирования и реверса детали, пожалуйста, зарегистрируйтесь или войдите");
  }

  const districtSel = $("scanDistrict");
  if (districtSel) {
    districtSel.innerHTML = DISTRICTS.map((d) => `<option>${d}</option>`).join("");
  }

  // Дедлайн по умолчанию (+4 дня)
  const d = new Date(Date.now() + 4 * 86400000);
  if ($("scanDeadline")) {
    $("scanDeadline").value = d.toISOString().slice(0, 10);
    $("scanDeadline").min = new Date().toISOString().slice(0, 10);
  }

  // Состояние загруженных фотографий
  const photos = [];
  const dropzone = $("scanDropzone");
  const fileInput = $("scanFileInput");
  const gallery = $("scanGallery");

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => handleFiles(fileInput.files));

    ["dragenter", "dragover"].forEach((e) => {
      dropzone.addEventListener(e, (ev) => {
        ev.preventDefault();
        dropzone.classList.add("drag");
      });
    });
    ["dragleave", "drop"].forEach((e) => {
      dropzone.addEventListener(e, (ev) => {
        ev.preventDefault();
        dropzone.classList.remove("drag");
      });
    });
    dropzone.addEventListener("drop", (ev) => {
      if (ev.dataTransfer.files && ev.dataTransfer.files.length) {
        handleFiles(ev.dataTransfer.files);
      }
    });
  }

  async function handleFiles(fileList) {
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) continue;
      if (photos.length >= 8) {
        toast("Можно прикрепить до 8 фотографий");
        break;
      }
      try {
        const compressed = await compressImage(file, 1000);
        photos.push({ id: uid(), dataUrl: compressed, name: file.name });
      } catch (err) {
        console.warn("Failed to load photo:", err);
      }
    }
    renderGallery();
    updateSummary();
  }

  function renderGallery() {
    if (!gallery) return;
    gallery.innerHTML = photos.map((p, idx) => `
      <div class="scan-photo-thumb" data-idx="${idx}" title="Нажмите для увеличения">
        <img src="${p.dataUrl}" alt="Фото детали ${idx + 1}" />
        <button type="button" class="scan-photo-remove" data-remove="${p.id}" title="Удалить фото">✕</button>
      </div>
    `).join("");

    gallery.querySelectorAll(".scan-photo-thumb").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".scan-photo-remove")) return;
        const idx = +el.dataset.idx;
        if (photos[idx]) openPhotoModal(photos[idx].dataUrl, `Фото детали #${idx + 1}`);
      });
    });

    gallery.querySelectorAll(".scan-photo-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.remove;
        const i = photos.findIndex((x) => x.id === id);
        if (i !== -1) {
          photos.splice(i, 1);
          renderGallery();
          updateSummary();
        }
      });
    });
  }

  // Переключатель 3D-печати
  const needsPrint = $("scanNeedsPrint");
  const printBox = $("scanPrintBox");
  const printOptions = $("scanPrintOptions");

  function syncPrintToggle() {
    if (!needsPrint || !printBox || !printOptions) return;
    const on = needsPrint.checked;
    printBox.classList.toggle("active", on);
    printOptions.style.display = on ? "block" : "none";
    updateSummary();
  }

  if (needsPrint) {
    needsPrint.addEventListener("change", syncPrintToggle);
    syncPrintToggle();
  }

  // Обновление сводки в реальном времени
  function updateSummary() {
    if ($("sumPhotos")) $("sumPhotos").textContent = photos.length + " шт.";
    if ($("sumOriginal")) $("sumOriginal").textContent = $("scanOriginalMaterial")?.value.split(" / ")[0] || "Пластик";

    const goal = document.querySelector("[name=scanGoal]:checked");
    if ($("sumGoal") && goal) {
      const gVal = goal.value;
      $("sumGoal").textContent = gVal.includes("CAD") ? "CAD (STEP)" : gVal.includes("Реверс") ? "Реверс в CAD" : "STL для печати";
    }

    if ($("sumPrint") && needsPrint) {
      if (needsPrint.checked) {
        const mat = $("scanPrintMaterial")?.value || "PETG";
        const q = $("scanPrintQty")?.value || 1;
        $("sumPrint").textContent = `Да (${mat}, ${q} шт.)`;
      } else {
        $("sumPrint").textContent = "Только файл (без печати)";
      }
    }

    if ($("sumDistrict") && districtSel) {
      $("sumDistrict").textContent = districtSel.value;
    }

    const b = parseInt($("scanBudget")?.value, 10);
    if ($("sumBudget")) {
      $("sumBudget").textContent = b && !isNaN(b) ? money(b) : "2 500 ₽";
    }
  }

  // Слушатели изменений для автокалькуляции
  [
    "scanOriginalMaterial", "scanSurface", "scanPrintMaterial", "scanPrintQty",
    "scanDistrict", "scanBudget"
  ].forEach((id) => $(id)?.addEventListener("input", updateSummary));

  document.querySelectorAll("[name=scanGoal]").forEach((r) => r.addEventListener("change", updateSummary));

  updateSummary();

  // Рендер динамического блока монетизации для сканирования
  function renderScanMonetization() {
    const box = $("scanMonetizationBox");
    if (!box) return;
    const cfg = DB.monetization ? DB.monetization() : { escrowEnabled: true, boostEnabled: true, escrowCommissionPercent: 10, urgentPrice: 250, privatePrice: 150 };

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
          <p class="muted" style="font-size:12.5px;margin:0 0 12px">Ускорьте поиск мастера для срочной оцифровки или скройте чертежи от посторонних.</p>
          <div class="paid-options-grid">
            <label class="paid-option-card" id="cardScanOptUrgent">
              <input type="checkbox" id="scanOptUrgent" />
              <div class="paid-option-content">
                <div class="paid-option-title">
                  <span>⚡ Срочный заказ (24ч)</span>
                  <span class="paid-option-price">+${money(cfg.urgentPrice)}</span>
                </div>
                <div class="paid-option-desc">Золотое неоновое свечение в бирже, приоритетный показ мастерам 3D-сканирования Норильска.</div>
              </div>
            </label>

            <label class="paid-option-card" id="cardScanOptPrivate">
              <input type="checkbox" id="scanOptPrivate" />
              <div class="paid-option-content">
                <div class="paid-option-title">
                  <span>🔒 Приватный заказ</span>
                  <span class="paid-option-price">+${money(cfg.privatePrice)}</span>
                </div>
                <div class="paid-option-desc">Фотографии узла и ваши контакты будут скрыты до утверждения мастера.</div>
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
            <span>Оплата резервируется на гарантийном счёте сервиса (комиссия ${cfg.escrowCommissionPercent}%). Средства поступят мастеру только после того, как вы примете готовую 3D-модель или деталь.</span>
          </div>
        </div>
      `;
    }

    box.innerHTML = html;

    ["scanOptUrgent", "scanOptPrivate"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("change", () => {
          el.closest(".paid-option-card")?.classList.toggle("selected", el.checked);
        });
      }
    });
  }

  renderScanMonetization();
  window.addEventListener("n3d:data-updated", renderScanMonetization);

  // Отправка формы
  const form = $("scanOrderForm");
  if (form) {
    let isScanSubmitting = false;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (isScanSubmitting) return;

      const msg = $("scanFormMsg");
      const submitBtn = form.querySelector('button[type="submit"]');
      const fail = (t) => {
        isScanSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
        if (!msg) return alert(t);
        msg.textContent = t;
        msg.className = "form-msg err";
        msg.style.display = "block";
        msg.scrollIntoView({ behavior: "smooth", block: "center" });
      };

      const title = $("scanTitle")?.value.trim();
      if (!title) return fail("Укажите название детали.");

      const comment = $("scanComment")?.value.trim();
      if (!comment) return fail("Опишите задачу и состояние детали.");

      const dimensions = $("scanDimensions")?.value.trim();
      if (!dimensions) return fail("Укажите габариты детали (например: 60 × 40 × 25 мм).");

      const budget = parseInt($("scanBudget")?.value, 10);
      if (!budget || budget < 500) return fail("Минимальный бюджет заказа от 500 ₽.");

      isScanSubmitting = true;
      if (submitBtn) submitBtn.disabled = true;

      const goal = document.querySelector("[name=scanGoal]:checked")?.value || "Точная копия для 3D-печати (STL / 3MF)";
      const isPrint = !!needsPrint?.checked;
      const printMat = isPrint ? ($("scanPrintMaterial")?.value || "PETG") : "PETG";
      const printQty = isPrint ? Math.max(1, parseInt($("scanPrintQty")?.value, 10) || 1) : 1;
      const printCol = isPrint ? ($("scanPrintColor")?.value.trim() || "Чёрный") : "Чёрный";

      const cfg = DB.monetization ? DB.monetization() : {};
      const isUrgent = !!(cfg.boostEnabled && $("scanOptUrgent")?.checked);
      const isPrivate = !!(cfg.boostEnabled && $("scanOptPrivate")?.checked);
      let boostFee = 0;
      if (isUrgent) boostFee += (cfg.urgentPrice || 250);
      if (isPrivate) boostFee += (cfg.privatePrice || 150);
      const isEscrow = !!cfg.escrowEnabled;

      requireUser("customer", (user) => {
        // Парсинг габаритов в массив чисел, если возможно
        const dimMatches = dimensions.match(/\d+([.,]\d+)?/g);
        const parsedSize = dimMatches && dimMatches.length >= 2
          ? dimMatches.slice(0, 3).map((v) => parseFloat(v.replace(",", ".")))
          : [60, 50, 30];

        const order = {
          id: "o" + uid(),
          type: "scan",
          category: "3d-сканирование",
          title: "🔬 " + title,
          customerId: user.id,
          customerName: user.name,
          customerPhone: user.phone,
          photos: photos.map((p) => p.dataUrl),
          file: {
            name: photos[0] ? photos[0].name : "scan_target.jpg",
            size: photos[0] ? 1024 * 120 : 1024 * 50
          },
          scanDetails: {
            dimensions,
            originalMaterial: $("scanOriginalMaterial")?.value || "Пластик / Капролон",
            surface: $("scanSurface")?.value || "Стандартная матовая",
            purpose: goal,
            needsPrint: isPrint,
            printMaterial: printMat,
            printColor: printCol,
            printQty,
            handover: $("scanHandover")?.value || "Привезу мастеру лично"
          },
          volume: parsedSize.reduce((a, b) => a * b, 1) * 0.4,
          size: parsedSize,
          material: printMat,
          color: printCol,
          qty: printQty,
          infill: 40,
          quality: "normal",
          deadline: $("scanDeadline")?.value || d.toISOString().slice(0, 10),
          district: districtSel?.value || "Норильск (центр)",
          budget,
          estimate: budget,
          comment,
          status: "open",
          urgent: isUrgent,
          isPrivate: isPrivate,
          boostFee: boostFee,
          escrow: isEscrow,
          escrowCommissionPercent: isEscrow ? (cfg.escrowCommissionPercent || 10) : 0,
          escrowStatus: isEscrow ? "held" : "none",
          responses: [],
          printerId: null,
          rating: null,
          invitedId: null,
          createdAt: Date.now()
        };

        const list = DB.orders();
        list.push(order);
        DB.saveOrders(list);

        toast("Заказ на 3D-сканирование успешно опубликован!");
        setTimeout(() => {
          location.href = "orders.html?id=" + order.id;
        }, 500);
      });
    });
  }
})();
