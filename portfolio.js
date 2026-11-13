// 3ДСосед — раздел портфолио мастеров с фото выполненных работ и подтверждёнными отзывами заказчиков
(() => {
  "use strict";

  const { DB, Presence, esc, money, stars, ago, uid, toast, loginModal, openModal, closeModal } = N3D;
  const $ = (id) => document.getElementById(id);

  let currentCategory = "all";
  let currentMaterial = "all";
  let currentDistrict = "all";
  let currentPrinter = "all";
  let currentSearch = "";
  let verifiedOnly = false;
  let currentScope = "all"; // 'all' | 'my'

  // Пресеты качественных фотографий для быстрого выбора
  const PHOTO_PRESETS = [
    { name: "Шестерни и узлы (PETG)", src: "img/hero-arctic-gears.jpg" },
    { name: "Кронштейны и детали (PETG)", src: "img/parts.jpg" },
    { name: "Фотополимер SLA (Смола)", src: "img/hero-resin-sculpture.jpg" },
    { name: "Карбоновый дрон (CF)", src: "img/hero-drone-part.jpg" },
    { name: "Архитектурный макет (PLA)", src: "img/model-city.jpg" },
    { name: "Мастерская и принтеры", src: "img/hero-talnakh-workshop.jpg" }
  ];

  function init() {
    renderUserBar();
    populatePrinterFilter();
    setupFilters();
    renderGrid();

    window.addEventListener("n3d:data-updated", () => {
      renderUserBar();
      renderGrid();
    });
    window.addEventListener("n3d:auth-changed", () => {
      renderUserBar();
      renderGrid();
    });
  }

  // Панель мастера (добавление работы и переключение Все/Мои)
  function renderUserBar() {
    const u = DB.user();
    const isPrinter = u && u.role === "printer";
    const bar = $("printerActionBanner");
    const ownerTabs = $("portfolioOwnerTabs");

    if (isPrinter) {
      if (ownerTabs) ownerTabs.hidden = false;
      if (bar) {
        bar.hidden = false;
        bar.innerHTML = `
          <div class="portfolio-printer-bar__inner">
            <div class="portfolio-printer-bar__left">
              <div class="user-avatar-badge">${(u.name || "М").charAt(0).toUpperCase()}</div>
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <b style="font-size:15px;color:var(--text)">Мастер: ${esc(u.name)}</b>
                  <span class="chip chip--sm" style="background:rgba(12,166,120,0.15);color:#0ca678;font-weight:700">Исполнитель</span>
                </div>
                <div class="muted" style="font-size:13px;margin-top:2px">
                  Пополняйте своё портфолио реальными фотографиями. При привязке выполненного на сайте заказа под фото появится <b>официальный отзыв заказчика</b>!
                </div>
              </div>
            </div>
            <button class="btn btn--primary" id="btnOpenAddModal">
              <span style="font-size:16px">➕</span> Добавить работу в портфолио
            </button>
          </div>
        `;
        $("btnOpenAddModal")?.addEventListener("click", () => openAddModal());
      }
    } else {
      if (ownerTabs) ownerTabs.hidden = true;
      if (bar) {
        bar.hidden = false;
        bar.innerHTML = `
          <div class="portfolio-printer-bar__guest">
            <div>
              <b>Вы мастер 3D-печати в Норильске?</b>
              <span class="muted" style="font-size:13px;display:block">
                Разместите свои лучшие работы в витрине 3ДСосед и получайте прямые заказы от жителей города.
              </span>
            </div>
            <button class="btn btn--ghost" id="btnJoinAsPrinter">Войти как исполнитель</button>
          </div>
        `;
        $("btnJoinAsPrinter")?.addEventListener("click", () => loginModal("printer"));
      }
    }
  }

  // Заполнение фильтра мастеров
  function populatePrinterFilter() {
    const select = $("filterPrinter");
    if (!select) return;
    const printers = DB.printers() || [];
    select.innerHTML = `<option value="all">👤 Все мастера (${printers.length})</option>` +
      printers.map((p) => `<option value="${p.id}">${esc(p.name)} (${esc(p.district)})</option>`).join("");
  }

  // Настройка интерактивных фильтров
  function setupFilters() {
    // Поиск
    const searchInput = $("portfolioSearch");
    const clearBtn = $("portfolioSearchClear");
    searchInput?.addEventListener("input", (e) => {
      currentSearch = (e.target.value || "").trim().toLowerCase();
      if (clearBtn) clearBtn.hidden = !currentSearch;
      renderGrid();
    });
    clearBtn?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      currentSearch = "";
      clearBtn.hidden = true;
      renderGrid();
    });

    // Район
    $("filterDistrict")?.addEventListener("change", (e) => {
      currentDistrict = e.target.value;
      renderGrid();
    });

    // Мастер
    $("filterPrinter")?.addEventListener("change", (e) => {
      currentPrinter = e.target.value;
      renderGrid();
    });

    // Категории (чипсы)
    $("categoryChips")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      $("categoryChips").querySelectorAll("[data-cat]").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.getAttribute("data-cat");
      renderGrid();
    });

    // Материалы (чипсы)
    $("materialChips")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mat]");
      if (!btn) return;
      $("materialChips").querySelectorAll("[data-mat]").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      currentMaterial = btn.getAttribute("data-mat");
      renderGrid();
    });

    // Чекбокс проверенных отзывов
    $("filterVerifiedOnly")?.addEventListener("change", (e) => {
      verifiedOnly = e.target.checked;
      renderGrid();
    });

    // Вкладки Мои/Все работы
    $("portfolioOwnerTabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-scope]");
      if (!btn) return;
      $("portfolioOwnerTabs").querySelectorAll("[data-scope]").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      currentScope = btn.getAttribute("data-scope");
      renderGrid();
    });

    // Кнопка сброса фильтров
    $("portfolioResetFiltersBtn")?.addEventListener("click", () => {
      currentCategory = "all";
      currentMaterial = "all";
      currentDistrict = "all";
      currentPrinter = "all";
      currentSearch = "";
      verifiedOnly = false;
      currentScope = "all";

      if (searchInput) searchInput.value = "";
      if (clearBtn) clearBtn.hidden = true;
      if ($("filterDistrict")) $("filterDistrict").value = "all";
      if ($("filterPrinter")) $("filterPrinter").value = "all";
      if ($("filterVerifiedOnly")) $("filterVerifiedOnly").checked = false;

      $("categoryChips")?.querySelectorAll("[data-cat]").forEach((el, i) => el.classList.toggle("active", i === 0));
      $("materialChips")?.querySelectorAll("[data-mat]").forEach((el, i) => el.classList.toggle("active", i === 0));
      $("portfolioOwnerTabs")?.querySelectorAll("[data-scope]").forEach((el, i) => el.classList.toggle("active", i === 0));

      renderGrid();
    });
  }

  // Поиск отзыва для работы по orderId
  function getLinkedReview(item) {
    if (!item || !item.orderId) return null;
    const allRevs = DB.reviews(item.printerId) || [];
    let r = allRevs.find((x) => x.orderId === item.orderId);
    if (!r) {
      const globalRevs = DB.reviews() || [];
      r = globalRevs.find((x) => x.orderId === item.orderId);
    }
    return r || null;
  }

  // Отрисовка карточек
  function renderGrid() {
    const grid = $("portfolioGrid");
    const countEl = $("portfolioCountText");
    const emptyBox = $("portfolioEmpty");
    if (!grid) return;

    const u = DB.user();
    let list = DB.portfolio() || [];

    // 1. Фильтр по области видимости (Все / Мои работы)
    if (currentScope === "my" && u) {
      list = list.filter((item) => item.printerId === u.id);
    }

    // 2. Фильтр по мастеру
    if (currentPrinter !== "all") {
      list = list.filter((item) => item.printerId === currentPrinter);
    }

    // 3. Фильтр по району
    if (currentDistrict !== "all") {
      list = list.filter((item) => item.district === currentDistrict);
    }

    // 4. Фильтр по категории
    if (currentCategory !== "all") {
      list = list.filter((item) => item.category === currentCategory);
    }

    // 5. Фильтр по материалу
    if (currentMaterial !== "all") {
      list = list.filter((item) => (item.material || "").toUpperCase() === currentMaterial.toUpperCase());
    }

    // 6. Фильтр: Только с подтверждённым отзывом
    if (verifiedOnly) {
      list = list.filter((item) => !!getLinkedReview(item));
    }

    // 7. Полнотекстовый поиск
    if (currentSearch) {
      list = list.filter((item) => {
        const text = `${item.title} ${item.description} ${item.material} ${item.category} ${item.printerName}`.toLowerCase();
        return text.includes(currentSearch);
      });
    }

    // Обновление счётчика
    if (countEl) {
      const total = list.length;
      countEl.innerHTML = `Показано: <b>${total}</b> ${N3DCards.plural(total, "работа", "работы", "работ")}`;
    }

    // Пустой результат
    if (list.length === 0) {
      grid.innerHTML = "";
      if (emptyBox) emptyBox.hidden = false;
      return;
    }
    if (emptyBox) emptyBox.hidden = true;

    // Рендер карточек
    grid.innerHTML = list.map((item) => renderCard(item, u)).join("");

    // Привязка действий на карточках
    grid.querySelectorAll("[data-action='delete-item']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (confirm("Удалить эту работу из портфолио?")) {
          DB.deletePortfolioItem(id);
          toast("Работа удалена из портфолио");
          renderGrid();
        }
      });
    });

    grid.querySelectorAll("[data-action='open-chat']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute("data-printer");
        const title = btn.getAttribute("data-title");
        const myId = u ? u.id : "c79990001122";
        N3D.Chat.openModal(myId, pid, null, `Здравствуйте! Интересует печать детали «${title}», как в вашем портфолио.`);
      });
    });

    grid.querySelectorAll("[data-action='open-master-profile']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute("data-printer");
        if (pid && N3DCards.openPrinterModal) N3DCards.openPrinterModal(pid);
      });
    });
  }

  // Рендер отдельной карточки портфолио
  function renderCard(item, currentUser) {
    const isOwner = currentUser && (currentUser.id === item.printerId || currentUser.role === "admin");
    const review = getLinkedReview(item);
    const hasVerifiedReview = !!review;
    const printer = DB.printer(item.printerId);
    const printerRating = printer ? printer.rating : 5.0;

    return `
      <article class="portfolio-card ${hasVerifiedReview ? 'portfolio-card--verified' : ''}">
        <!-- Фотография работы -->
        <div class="portfolio-card__img-wrap">
          <img src="${esc(item.photo || 'img/parts.jpg')}" alt="${esc(item.title)}" class="portfolio-card__img" loading="lazy" />
          
          <div class="portfolio-card__badges">
            <span class="chip chip--sm chip--${(item.material || 'petg').toLowerCase()}">
              ${esc(item.material || 'PETG')}
            </span>
            ${item.category ? `<span class="chip chip--sm chip--neutral">${esc(item.category)}</span>` : ''}
          </div>

          ${hasVerifiedReview ? `
            <div class="portfolio-card__verified-badge" title="Заказ выполнен через 3ДСосед со 100% безопасной сделкой">
              🛡️ Заказ с 3ДСосед
            </div>
          ` : ''}
        </div>

        <!-- Контент работы -->
        <div class="portfolio-card__body">
          <h3 class="portfolio-card__title">${esc(item.title)}</h3>
          
          <div class="portfolio-card__master-row">
            <div class="portfolio-card__master-info" role="button" data-action="open-master-profile" data-printer="${esc(item.printerId)}">
              <div class="portfolio-card__master-avatar">${(item.printerName || 'М').charAt(0).toUpperCase()}</div>
              <div>
                <b class="portfolio-card__master-name">${esc(item.printerName)}</b>
                <div class="muted" style="font-size:11.5px">📍 ${esc(item.district || 'Норильск')} · ⭐ ${printerRating.toFixed(1)}</div>
              </div>
            </div>
            ${Presence.badge(item.printerId)}
          </div>

          ${item.description ? `
            <p class="portfolio-card__desc">${esc(item.description)}</p>
          ` : ''}

          <!-- БЛОК ПОДТВЕРЖДЁННОГО ОТЗЫВА ЗАКАЗЧИКА (под фото выполненного через сайт заказа) -->
          ${hasVerifiedReview ? `
            <div class="portfolio-review-box">
              <div class="portfolio-review-box__header">
                <div class="portfolio-review-box__badge">
                  <span>🛡️</span>
                  <b>Проверенная сделка #${esc(item.orderId)}</b>
                </div>
                <div class="portfolio-review-box__stars">
                  ${stars(review.score || 5)}
                  <b>${(review.score || 5).toFixed(1)}</b>
                </div>
              </div>

              <div class="portfolio-review-box__customer">
                <div class="customer-avatar-mini">${(review.customerName || 'З').charAt(0).toUpperCase()}</div>
                <div>
                  <span class="customer-name">${esc(review.customerName || 'Заказчик')}</span>
                  <small class="muted">📍 ${esc(review.district || item.district || 'Норильск')} · ${ago(review.date || item.date)}</small>
                </div>
              </div>

              <div class="portfolio-review-box__comment">
                «${esc(review.comment)}»
              </div>

              ${(review.accuracyScore || review.speedScore) ? `
                <div class="portfolio-review-box__metrics">
                  <span>🎯 Точность: <b>${review.accuracyScore || 5}/5</b></span>
                  <span>⚡ Скорость: <b>${review.speedScore || 5}/5</b></span>
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="portfolio-card__independent-note">
              🛠️ Самостоятельный проект мастера
            </div>
          `}

          <!-- Кнопки действий -->
          <div class="portfolio-card__actions">
            <a href="order.html?printer=${encodeURIComponent(item.printerId)}&ref=${encodeURIComponent(item.title)}" class="btn btn--small btn--primary">
              🚀 Заказать похожее
            </a>
            <button class="btn btn--small btn--ghost" data-action="open-chat" data-printer="${esc(item.printerId)}" data-title="${esc(item.title)}" title="Обсудить детали в чате">
              💬 Чат
            </button>
            ${isOwner ? `
              <button class="btn btn--small btn--danger-ghost" data-action="delete-item" data-id="${esc(item.id)}" title="Удалить из портфолио" style="margin-left:auto">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }

  // Модальное окно добавления работы в портфолио
  function openAddModal() {
    const u = DB.user();
    if (!u || u.role !== "printer") {
      loginModal("printer");
      return;
    }

    // Собираем выполненные заказы этого мастера
    const allOrders = DB.orders() || [];
    const myDoneOrders = allOrders.filter((o) => o.printerId === u.id);

    let selectedPhoto = "img/parts.jpg";

    openModal(`
      <div class="portfolio-modal">
        <div class="portfolio-modal__head">
          <div class="portfolio-modal__icon">📸</div>
          <h2 class="portfolio-modal__title">Добавить работу в портфолио</h2>
          <p class="portfolio-modal__subtitle">
            Покажите напечатанные детали заказчикам Норильска. Вы можете привязать завершённый заказ с сайта для показа проверенного отзыва.
          </p>
        </div>

        <form id="addPortfolioForm" class="portfolio-modal__form">
          
          <!-- Связь с заказом на сайте -->
          <div class="portfolio-link-block">
            <div class="portfolio-link-block__header">
              <label for="portOrderSelect" class="portfolio-link-block__label">
                <span class="portfolio-link-block__icon">🛡️</span>
                <span>Привязать к заказу с сайта 3ДСосед</span>
              </label>
              <span class="badge" style="background:rgba(12,166,120,0.14);color:#0ca678;border:1px solid rgba(12,166,120,0.3);font-size:11.5px;font-weight:700">Официальный отзыв</span>
            </div>
            <p class="portfolio-link-block__desc">
              Выберите завершённую сделку — под фото работы автоматически появится официальный отзыв заказчика с оценкой.
            </p>
            <select id="portOrderSelect" class="portfolio-modal__select">
              <option value="">— Не привязывать (сторонняя работа вне сайта) —</option>
              ${myDoneOrders.map((o) => {
                const r = (DB.reviews(u.id) || []).find((x) => x.orderId === o.id);
                const scoreText = r ? ` · ⭐ ${r.score.toFixed(1)} от ${r.customerName}` : "";
                return `<option value="${esc(o.id)}" data-title="${esc(o.title)}" data-mat="${esc(o.material || 'PETG')}">
                  Заказ #${esc(o.id)}: ${esc(o.title)}${scoreText}
                </option>`;
              }).join("")}
            </select>
            <div id="linkedReviewPreviewBox" class="linked-review-preview" hidden></div>
          </div>

          <!-- Название работы -->
          <div class="portfolio-form-field">
            <label for="portTitle" class="portfolio-form-label">
              Название работы / детали <span class="required-star">*</span>
            </label>
            <input type="text" id="portTitle" class="portfolio-modal__input" placeholder="Например: Кронштейн фары для снегохода Буран" required />
          </div>

          <!-- Категория и пластик (в одну строчку) -->
          <div class="portfolio-form-row">
            <div class="portfolio-form-field">
              <label for="portCategory" class="portfolio-form-label">Категория</label>
              <select id="portCategory" class="portfolio-modal__select">
                <option value="Авто/мото и спецтехника">🚗 Авто/мото и спецтехника</option>
                <option value="Корпуса и приборы">📟 Корпуса и приборы</option>
                <option value="Фигурки и сувениры">🎭 Фигурки и сувениры</option>
                <option value="Архитектура и макеты">🏙️ Архитектура и макеты</option>
                <option value="Бытовые изделия">🏠 Бытовые изделия</option>
                <option value="Промышленные детали">⚙️ Промышленные детали</option>
              </select>
            </div>
            <div class="portfolio-form-field">
              <label for="portMaterial" class="portfolio-form-label">Материал печати</label>
              <select id="portMaterial" class="portfolio-modal__select">
                <option value="PETG">PETG</option>
                <option value="PLA">PLA</option>
                <option value="ABS">ABS</option>
                <option value="TPU">TPU (Flex)</option>
                <option value="RESIN">RESIN (Фотополимер)</option>
                <option value="NYLON">NYLON (Нейлон)</option>
                <option value="CARBON">CARBON (Углеволокно)</option>
                <option value="PC">PC (Поликарбонат)</option>
              </select>
            </div>
          </div>

          <!-- Фотография работы -->
          <div class="portfolio-form-field">
            <label class="portfolio-form-label">
              Фотография работы <span class="required-star">*</span>
            </label>
            
            <div class="portfolio-photo-uploader" id="portDropArea">
              <input type="file" id="portFileInput" accept="image/*" hidden />
              <div id="portPreviewWrapper" class="portfolio-photo-preview" style="display:none">
                <img id="portPreviewImg" src="" alt="Превью детали" class="portfolio-photo-preview__img" />
                <div class="portfolio-photo-preview__overlay">
                  <button type="button" class="btn btn--small btn--ghost" id="portChangePhotoBtn">
                    📷 Загрузить другое фото
                  </button>
                </div>
              </div>
              <div id="portUploadPlaceholder" class="portfolio-photo-placeholder">
                <div class="portfolio-photo-placeholder__icon">📸</div>
                <b>Нажмите или перетащите фото детали</b>
                <span class="muted" style="font-size:12px;margin-top:2px">JPG, PNG, WebP до 15 МБ</span>
              </div>
            </div>

            <!-- Быстрый выбор из фотобанка сайта -->
            <div class="portfolio-presets-section">
              <span class="portfolio-presets-label">Или выберите готовое фото из библиотеки сайта:</span>
              <div class="portfolio-preset-chips" id="portPresetList">
                ${PHOTO_PRESETS.map((p, i) => `
                  <button type="button" class="chip chip--preset ${i === 0 ? 'active' : ''}" data-src="${p.src}">
                    ${p.name}
                  </button>
                `).join("")}
              </div>
            </div>
          </div>

          <!-- Описание процесса печати -->
          <div class="portfolio-form-field" style="margin-bottom:0">
            <label for="portDescription" class="portfolio-form-label">
              Описание, настройки и нюансы (необязательно)
            </label>
            <textarea id="portDescription" class="portfolio-modal__textarea" rows="3" placeholder="Сопло 0.4 мм, 5 периметров, 40% заполнение, температура стола 85°C..."></textarea>
          </div>

          <!-- Кнопки футера -->
          <div class="portfolio-modal__footer">
            <button type="button" class="btn btn--ghost portfolio-modal__btn-cancel" onclick="N3D.closeModal()">Отмена</button>
            <button type="submit" class="btn btn--primary portfolio-modal__btn-submit" id="portSubmitBtn">💾 Сохранить в портфолио</button>
          </div>
        </form>
      </div>
    `, "modal__box--portfolio");

    // Обработка связки с заказом
    const orderSelect = $("portOrderSelect");
    const previewBox = $("linkedReviewPreviewBox");
    const titleInput = $("portTitle");
    const matSelect = $("portMaterial");

    function updateOrderLinkPreview() {
      const orderId = orderSelect.value;
      if (!orderId) {
        if (previewBox) { previewBox.hidden = true; previewBox.innerHTML = ""; }
        return;
      }
      const opt = orderSelect.selectedOptions[0];
      if (opt) {
        if (!titleInput.value && opt.getAttribute("data-title")) {
          titleInput.value = opt.getAttribute("data-title");
        }
        if (opt.getAttribute("data-mat")) {
          matSelect.value = opt.getAttribute("data-mat");
        }
      }

      // Поиск отзыва
      const rev = (DB.reviews(u.id) || []).find((x) => x.orderId === orderId) || (DB.reviews() || []).find((x) => x.orderId === orderId);
      if (previewBox) {
        previewBox.hidden = false;
        if (rev) {
          previewBox.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;color:#0ca678;font-size:12.5px;font-weight:700">
              <span>✓ Отзыв найден:</span>
              <span>${stars(rev.score)} (${rev.score.toFixed(1)}) от ${esc(rev.customerName)}</span>
            </div>
            <div style="font-size:12.5px;color:var(--text);font-style:italic">«${esc(rev.comment)}»</div>
          `;
        } else {
          previewBox.innerHTML = `
            <div class="muted" style="font-size:12px">
              ℹ️ Заказ найден. Отзыв заказчика появится автоматически после приёмки работы.
            </div>
          `;
        }
      }
    }

    orderSelect?.addEventListener("change", updateOrderLinkPreview);

    // Загрузка фото через input
    const fileInput = $("portFileInput");
    const dropArea = $("portDropArea");
    const previewWrap = $("portPreviewWrapper");
    const previewImg = $("portPreviewImg");
    const placeholder = $("portUploadPlaceholder");

    dropArea?.addEventListener("click", (e) => {
      if (e.target.id === "portChangePhotoBtn") {
        fileInput?.click();
      } else if (!previewWrap || previewWrap.style.display === "none") {
        fileInput?.click();
      }
    });

    fileInput?.addEventListener("change", () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        toast("Пожалуйста, выберите файл изображения (JPG, PNG)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        selectedPhoto = ev.target.result;
        if (previewImg) previewImg.src = selectedPhoto;
        if (previewWrap) previewWrap.style.display = "block";
        if (placeholder) placeholder.style.display = "none";
        // Снимаем активность с пресетов
        $("portPresetList")?.querySelectorAll(".chip--preset").forEach((c) => c.classList.remove("active"));
      };
      reader.readAsDataURL(f);
    });

    // Пресеты
    $("portPresetList")?.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip--preset");
      if (!chip) return;
      $("portPresetList").querySelectorAll(".chip--preset").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      selectedPhoto = chip.getAttribute("data-src");
      if (previewImg) previewImg.src = selectedPhoto;
      if (previewWrap) previewWrap.style.display = "block";
      if (placeholder) placeholder.style.display = "none";
    });

    // Установка начального пресета
    if (previewImg) previewImg.src = selectedPhoto;
    if (previewWrap) previewWrap.style.display = "block";
    if (placeholder) placeholder.style.display = "none";

    // Отправка формы
    $("addPortfolioForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        toast("Введите название работы");
        titleInput.focus();
        return;
      }

      const item = {
        printerId: u.id,
        printerName: u.name,
        district: u.district || "Норильск",
        title: title,
        category: $("portCategory").value,
        material: matSelect.value,
        photo: selectedPhoto,
        description: $("portDescription").value.trim(),
        orderId: orderSelect.value || null,
        date: Date.now()
      };

      DB.addPortfolioItem(item);
      closeModal();
      toast("✅ Работа успешно добавлена в ваше портфолио!");
      renderGrid();
    });
  }

  // Экспорт в глобальный scope
  window.N3DPortfolio = {
    init,
    openAddModal,
    renderGrid
  };

  // Автозапуск при загрузке DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
