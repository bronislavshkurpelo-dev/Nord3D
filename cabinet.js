// NORD 3D — Личный кабинет в стиле FunPay (диалоги, активные заказы, смена статусов, профиль)
(() => {
  "use strict";

  const { DB, MATERIALS, MAT_KEYS, SPEC_MATERIALS, SPEC_MAT_KEYS, DISTRICTS, STATUS, Presence, Chat, esc, money, date, ago, avatar, stars, statusBadge, qs, toast, loginModal, openProfileSettingsModal, openModal, closeModal } = N3D;

  const $ = (id) => document.getElementById(id);
  let currentUser = DB.user();
  let activeThreadKey = null;

  // Инициализация при загрузке
  function init() {
    currentUser = DB.user();
    if (!currentUser) {
      renderGuestState();
      return;
    }
    renderUserCard();
    setupTabs();
    selectInitialThread();
    renderSidebar();
    renderMain();
  }

  // Если не авторизован — показываем приветственный экран для быстрого входа
  function renderGuestState() {
    $("cabUserCard").innerHTML = `
      <div class="cab-guest-box">
        <b>Вы не вошли в кабинет</b>
        <p class="muted" style="font-size:12px;margin:6px 0 12px">Войдите, чтобы просматривать переписку с мастерами и статусы заказов.</p>
        <button class="btn btn--small btn--primary btn--wide" id="guestLoginBtn">Войти или создать профиль</button>
      </div>
    `;
    $("guestLoginBtn")?.addEventListener("click", () => loginModal("customer", () => location.reload()));

    $("cabDialogList").innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">
        Диалоги доступны после авторизации.
      </div>
    `;

    $("cabMain").innerHTML = `
      <div class="cab-empty-state">
        <div style="font-size:44px;margin-bottom:12px">💬</div>
        <h2>Личный кабинет и сообщения</h2>
        <p class="muted" style="max-width:480px;margin-bottom:24px">
          Здесь заказчики и исполнители Норильска ведут диалог, уточняют параметры 3D-печати, согласовывают стоимость и подтверждают готовность изделий в реальном времени.
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn--primary" id="btnQuickCust">Войти как Заказчик «Сергей»</button>
          <button class="btn btn--ghost" id="btnQuickPrint">Войти как Мастер «Алексей К.»</button>
        </div>
      </div>
    `;

    $("btnQuickCust")?.addEventListener("click", () => {
      DB.setUser({ id: "c79990001122", name: "Сергей", phone: "+7 999 000-11-22", role: "customer" });
      location.reload();
    });
    $("btnQuickPrint")?.addEventListener("click", () => {
      DB.setUser({ id: "p79001112233", name: "Алексей К.", phone: "+7 900 111-22-33", role: "printer" });
      location.reload();
    });
  }

  // Карточка пользователя в левой колонке
  function renderUserCard() {
    const isP = currentUser.role === "printer";
    const wallet = DB.wallet(currentUser.id);
    const printerObj = isP ? DB.printer(currentUser.id) : null;

    $("cabUserCard").innerHTML = `
      <div class="cab-user-header">
        <div class="avatar-editable" id="btnEditUserAvatar" style="cursor:pointer" title="Нажмите, чтобы открыть настройки профиля и изменить аватар">
          ${avatar(currentUser, 48)}
          <span class="avatar-editable__badge">📷</span>
        </div>
        <div class="cab-user-meta">
          <div style="display:flex;align-items:center;gap:6px">
            <b>${esc(currentUser.name)}</b>
            ${Presence.badge(currentUser.id)}
          </div>
          <small class="cab-role-badge ${isP ? "cab-role--printer" : "cab-role--customer"}">
            ${isP ? "🖨️ Мастер 3D-печати" : "🧑 Заказчик"}
          </small>
        </div>
      </div>

      <div class="cab-wallet-quick">
        <a href="wallet.html" class="cab-wallet-pill" title="Открыть кошелёк">
          <span class="cab-wallet-pill__label">💳 Баланс:</span>
          <b class="cab-wallet-pill__val">${money(wallet.balance)}</b>
        </a>
        ${isP ? `
          <a href="rating.html" class="cab-wallet-pill cab-wallet-pill--rating" title="Рейтинг и репутация мастера">
            <span class="cab-wallet-pill__label">⭐ Рейтинг:</span>
            <b class="cab-wallet-pill__val">${printerObj?.rating || 4.9} ★</b>
          </a>
        ` : `
          <a href="wallet.html" class="cab-wallet-pill cab-wallet-pill--hold" title="Средства на гарантийном счёте">
            <span class="cab-wallet-pill__label">🔒 Холд:</span>
            <b class="cab-wallet-pill__val">${money(wallet.hold)}</b>
          </a>
        `}
      </div>

      <button type="button" class="btn btn--ghost btn--small btn--wide" id="btnOpenProfileSettings" style="margin-top:10px;font-size:12.5px;font-weight:700">
        ⚙️ Настройки профиля
      </button>
      <div class="cab-demo-switch">
        <span>Быстро сменить аккаунт:</span>
        <button class="link" id="switchDemoAccount">
          ${isP ? "Заказчик Сергей" : "Мастер Алексей К."}
        </button>
      </div>
    `;

    const openProfile = () => {
      openProfileSettingsModal((updatedUser) => {
        currentUser = updatedUser;
        renderUserCard();
      });
    };

    $("btnEditUserAvatar")?.addEventListener("click", openProfile);
    $("btnOpenProfileSettings")?.addEventListener("click", openProfile);

    $("switchDemoAccount")?.addEventListener("click", () => {
      if (isP) {
        DB.setUser({ id: "c79990001122", name: "Сергей", phone: "+7 999 000-11-22", role: "customer" });
      } else {
        DB.setUser({ id: "p79001112233", name: "Алексей К.", phone: "+7 900 111-22-33", role: "printer" });
      }
      location.reload();
    });
  }

  // Поиск по диалогам
  function setupTabs() {
    $("chatSearch")?.addEventListener("input", renderSidebar);
  }

  // Выбор начального треда из URL или самого свежего
  function selectInitialThread() {
    if (!currentUser) return;
    const pCust = qs("customer");
    const pPrint = qs("printer");
    const pOrder = qs("order");

    if (pCust && pPrint) {
      const { key } = Chat.getThread(pCust, pPrint, pOrder);
      activeThreadKey = key;
      Chat.markThreadRead(key, currentUser.id);
      return;
    }

    const threads = Chat.getAllUserThreads(currentUser.id);
    if (threads.length > 0) {
      activeThreadKey = threads[0].key;
      Chat.markThreadRead(activeThreadKey, currentUser.id);
    }
  }

  // Вспомогательная функция: гарантированное получение реального имени и аватара собеседника
  function getOtherParty(thread) {
    if (!thread || !currentUser) return { id: "", name: "Собеседник", avatar: null, isOnline: false };
    const parts = (thread.key || "").split("__");
    const isCustomer = currentUser.role === "customer";
    const otherId = isCustomer
      ? (thread.printerId || parts[1])
      : (thread.customerId || parts[0]);

    let otherName = "";
    let otherAvatar = null;

    if (isCustomer) {
      const printer = DB.printer(otherId);
      otherName = printer?.name || thread.printerName;
      if (!otherName || otherName === "Мастер" || otherName === "Мастер 3D-печати") {
        if (otherId === "p79001112233") otherName = "Алексей К.";
        else if (otherId === "p79003334455") otherName = "Дарья М.";
        else if (otherId === "p79002223344") otherName = "Мастерская «Полярный слой»";
        else if (otherId === "p79004445566") otherName = "Игорь С.";
        else if (otherId === "p79005556677") otherName = "Тимур Р.";
        else otherName = "Алексей К.";
      }
      otherAvatar = printer?.avatar || thread.printerAvatar || null;
    } else {
      const order = thread.orderId ? DB.order(thread.orderId) : null;
      otherName = (thread.customerName && thread.customerName !== "Заказчик")
        ? thread.customerName
        : (order?.customerName && order.customerName !== "Заказчик"
          ? order.customerName
          : (DB.orders().find(o => o.customerId === otherId && o.customerName && o.customerName !== "Заказчик")?.customerName || ""));
      if (!otherName || otherName === "Заказчик") {
        if (otherId === "c79990001122") otherName = "Сергей";
        else if (otherId === "c79991112233") otherName = "Ольга";
        else if (otherId === "c79992223344") otherName = "Максим";
        else if (otherId === "c79993334455") otherName = "Анна";
        else otherName = "Сергей";
      }
      otherAvatar = thread.customerAvatar || order?.customerAvatar || null;
    }

    const isOnline = Presence.isOnline(otherId);
    return { id: otherId, name: otherName, avatar: otherAvatar, isOnline };
  }

  // Отрисовка списка диалогов (Левая панель как на FunPay)
  function renderSidebar() {
    if (!currentUser) return;
    const query = ($("chatSearch")?.value || "").toLowerCase().trim();
    let threads = Chat.getAllUserThreads(currentUser.id);

    if (query) {
      threads = threads.filter((t) => {
        const other = getOtherParty(t);
        const order = t.orderId ? DB.order(t.orderId) : null;
        return other.name.toLowerCase().includes(query) ||
               (order && order.title.toLowerCase().includes(query));
      });
    }

    if (!threads.length) {
      const isP = currentUser.role === "printer";
      $("cabDialogList").innerHTML = `
        <div class="cab-no-dialogs">
          <p class="muted">Пока нет сообщений</p>
          <small>${isP ? "Откликнитесь на заказ на бирже или дождитесь персонального заказа от клиента." : "Нажмите «💬 Чат» в карточке любого мастера или заказа, чтобы начать общение."}</small>
        </div>
      `;
      return;
    }

    $("cabDialogList").innerHTML = threads.map((t) => {
      const other = getOtherParty(t);
      const otherName = other.name;
      const order = t.orderId ? DB.order(t.orderId) : null;
      const validMsgs = (t.messages || []).filter(m => m && m.text !== "Hello");
      const lastMsg = validMsgs[validMsgs.length - 1];
      const isActive = t.key === activeThreadKey;
      const unreadCount = Chat.getThreadUnreadCount(t.key, currentUser.id);

      const otherObj = { name: otherName, avatar: other.avatar };

      return `
        <div class="cab-dialog-item ${isActive ? "active" : ""}" data-thread-key="${t.key}">
          <div class="cab-dialog-avatar-wrap">
            ${avatar(otherObj, 40)}
            <span class="cab-online-dot ${other.isOnline ? "online" : ""}" title="${other.isOnline ? "В сети" : "Офлайн"}"></span>
          </div>
          <div class="cab-dialog-info">
            <div class="cab-dialog-row">
              <span class="cab-dialog-name">${esc(otherName)}</span>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="cab-dialog-time muted">${lastMsg ? ago(lastMsg.t) : ""}</span>
                ${unreadCount > 0 ? `<span class="cab-dialog-unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ""}
                <button class="cab-dialog-delete-btn" data-delete-key="${t.key}" data-delete-name="${esc(otherName)}" title="Удалить диалог" aria-label="Удалить диалог">🗑️</button>
              </div>
            </div>
            ${order ? `
              <div class="cab-dialog-order-pill">
                <span class="cab-order-mini-tag">${esc(order.title)}</span>
                <span class="status ${STATUS[order.status]?.cls || ""} cab-status-badge">${STATUS[order.status]?.label || ""}</span>
              </div>
            ` : ""}
            <p class="cab-dialog-snippet">
              ${lastMsg ? (lastMsg.from === currentUser.id ? "<b>Вы:</b> " : `<b>${esc(otherName)}:</b> `) + (lastMsg.text ? esc(lastMsg.text) : "📷 Фотография") : "<i>Диалог открыт</i>"}
            </p>
          </div>
        </div>
      `;
    }).join("");

    $("cabDialogList").querySelectorAll(".cab-dialog-item").forEach((el) => {
      el.onclick = () => {
        activeThreadKey = el.dataset.threadKey;
        Chat.markThreadRead(activeThreadKey, currentUser.id);
        renderSidebar();
        renderMain();
      };
    });

    $("cabDialogList").querySelectorAll(".cab-dialog-delete-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const key = btn.dataset.deleteKey;
        const name = btn.dataset.deleteName || "собеседником";
        confirmDeleteChat(key, name);
      };
    });
  }

  // Отрисовка правой рабочей зоны: Чат
  function renderMain() {
    renderActiveChat();
  }

  // Отрисовка активного чата с блоком информации о сделке FunPay
  function renderActiveChat() {
    if (activeThreadKey) {
      Chat.markThreadRead(activeThreadKey, currentUser.id);
    }
    if (!activeThreadKey) {
      const isP = currentUser.role === "printer";
      $("cabMain").innerHTML = `
        <div class="cab-empty-state">
          <div style="font-size:42px;margin-bottom:12px">💬</div>
          <h3>${isP ? "Сообщения мастера" : "Выберите диалог слева"}</h3>
          <p class="muted" style="max-width:440px;margin-bottom:16px">
            ${isP ? "Здесь отображаются входящие сообщения, вопросы клиентов и обсуждение деталей печати." : "Или найдите мастера в каталоге и задайте вопрос по вашей 3D-модели."}
          </p>
          ${isP ? `<a href="orders.html" class="btn btn--primary btn--small">📋 Перейти к ленте заказов</a>` : ""}
        </div>
      `;
      return;
    }

    const chats = DB.chats();
    const thread = chats[activeThreadKey];
    if (!thread) {
      $("cabMain").innerHTML = `<div class="cab-empty-state"><p class="muted">Диалог не найден</p></div>`;
      return;
    }

    const isCustomer = currentUser.role === "customer";
    const other = getOtherParty(thread);
    const otherName = other.name;
    const printer = DB.printer(thread.printerId);
    const order = thread.orderId ? DB.order(thread.orderId) : null;
    const otherObj = isCustomer
      ? (printer || { name: otherName })
      : { name: otherName, avatar: other.avatar || thread.customerAvatar || (order ? order.customerAvatar : null) };
    const messages = (Array.isArray(thread.messages) ? thread.messages : (Array.isArray(thread) ? thread : []))
      .filter(m => m && m.text !== "Hello");

    // Сборка верстки чата
    $("cabMain").innerHTML = `
      <div class="cab-chat-box">

        <!-- Шапка диалога -->
        <div class="cab-chat-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="position:relative">
              ${avatar(otherObj, 42)}
              <span class="cab-online-dot ${other.isOnline ? "online" : ""}"></span>
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <h3 style="margin:0">${esc(otherName)}</h3>
                ${Presence.badge(other.id)}
              </div>
              <small class="muted">
                ${isCustomer ? `📍 ${esc(printer?.district || "Норильск")} · ${esc(printer?.equipment || "3D-принтер")}` : `Заказчик (${esc(otherName)})`}
              </small>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${order ? `<a href="my-orders.html?id=${encodeURIComponent(order.id)}" class="btn btn--small btn--ghost" style="font-size:12.5px;text-decoration:none">📋 Сделка #${esc(order.id)} (${money(order.budget)}) · ${STATUS[order.status]?.label || ""} →</a>` : ""}
            <button class="btn btn--small btn--ghost btn--delete-chat" id="btnDeleteCurrentChat" title="Удалить диалог">🗑️ Удалить диалог</button>
          </div>
        </div>

        <!-- Сообщения -->
        <div class="cab-messages-stream" id="cabMsgs">
          ${renderMessageList(messages, otherName)}
        </div>

        <!-- Превью прикрепленного фото перед отправкой -->
        <div class="cab-photo-preview" id="cabPhotoPreview" style="display:none">
          <div class="cab-photo-preview-left">
            <div class="cab-photo-thumb-wrap">
              <img id="cabPhotoThumb" src="" alt="Прикрепленное фото" />
            </div>
            <div class="cab-photo-meta">
              <b id="cabPhotoName">Фотография прикреплена</b>
              <small>Готово к отправке в чат</small>
            </div>
          </div>
          <button type="button" class="cab-photo-remove" id="btnRemovePhoto" title="Удалить фото">✕</button>
        </div>

        <!-- Поле ввода сообщения и кнопка прикрепления фото -->
        <form class="cab-composer" id="cabForm">
          <label class="cab-attach-btn" for="cabPhotoInput" title="Прикрепить фото детали (PNG, JPG, WEBP)">
            📷
          </label>
          <input type="file" id="cabPhotoInput" accept="image/*" style="display:none" />
          <input type="text" id="cabInput" placeholder="Напишите сообщение или прикрепите фото..." autocomplete="off" />
          <button class="btn btn--primary" type="submit">Отправить</button>
        </form>

      </div>
    `;

    // Скролл вниз к последним сообщениям
    const stream = $("cabMsgs");
    if (stream) stream.scrollTop = stream.scrollHeight;

    // Обработка прикрепления фото (файл, буфер обмена)
    let currentAttachedImage = null;
    const fileInput = $("cabPhotoInput");
    const previewBox = $("cabPhotoPreview");
    const thumbImg = $("cabPhotoThumb");
    const nameEl = $("cabPhotoName");
    const removeBtn = $("btnRemovePhoto");

    async function handleFile(file) {
      if (!file || !file.type.startsWith("image/")) {
        toast("Пожалуйста, выберите файл изображения (PNG, JPG, WEBP)");
        return;
      }
      try {
        const compressed = await N3D.compressImage(file);
        currentAttachedImage = compressed;
        if (thumbImg) thumbImg.src = compressed;
        if (nameEl) nameEl.textContent = file.name || "Фотография детали";
        if (previewBox) previewBox.style.display = "flex";
        $("cabInput")?.focus();
      } catch (err) {
        toast("Не удалось обработать изображение");
      }
    }

    if (fileInput) {
      fileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        fileInput.value = "";
      };
    }

    if (removeBtn) {
      removeBtn.onclick = () => {
        currentAttachedImage = null;
        if (thumbImg) thumbImg.src = "";
        if (previewBox) previewBox.style.display = "none";
      };
    }

    // Поддержка быстрой вставки скриншота из буфера обмена (Ctrl + V)
    $("cabInput")?.addEventListener("paste", (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
            break;
          }
        }
      }
    });

    // Отправка формы (текст, фото или оба)
    let isSendingMsg = false;
    $("cabForm").onsubmit = (e) => {
      e.preventDefault();
      if (isSendingMsg) return;
      const inp = $("cabInput");
      const text = inp.value.trim();
      if (!text && !currentAttachedImage) return;

      const submitBtn = $("cabForm")?.querySelector('button[type="submit"]');
      isSendingMsg = true;
      if (submitBtn) submitBtn.disabled = true;

      const keyParts = (activeThreadKey || "").split("__");
      const custId = thread.customerId || keyParts[0];
      const printId = thread.printerId || keyParts[1];
      const ordId = thread.orderId || (keyParts[2] !== "direct" ? keyParts[2] : null);

      const attachedImage = currentAttachedImage;
      inp.value = "";
      currentAttachedImage = null;
      if (previewBox) previewBox.style.display = "none";

      Chat.sendMessage(custId, printId, ordId, text, attachedImage);

      renderSidebar();
      renderActiveChat();
      setTimeout(() => {
        isSendingMsg = false;
        if (submitBtn) submitBtn.disabled = false;
      }, 300);
    };

    // Кнопка удаления текущего диалога
    $("btnDeleteCurrentChat")?.addEventListener("click", () => {
      confirmDeleteChat(activeThreadKey, otherName);
    });
  }

  function confirmDeleteChat(threadKey, name) {
    if (!threadKey) return;
    openModal(`
      <div class="modal-confirm-box">
        <div style="font-size:38px;margin-bottom:12px">🗑️</div>
        <h3 style="font-size:20px;font-weight:800;margin-bottom:8px">Удалить диалог?</h3>
        <p class="muted" style="font-size:14px;margin-bottom:24px;line-height:1.5">
          Вы уверены, что хотите удалить диалог с <b>${esc(name)}</b>?<br>Вся история сообщений в этом чате будет удалена.
        </p>
        <div class="modal-confirm-actions">
          <button class="btn btn--ghost" id="cancelDeleteChatBtn" type="button" style="min-width:110px;height:48px">Отмена</button>
          <button class="btn" id="confirmDeleteChatBtn" type="button" style="background:#ef4444;color:#fff;border-color:#ef4444;font-weight:700;min-width:110px;height:48px">Удалить</button>
        </div>
      </div>
    `, "modal__box--narrow");
    $("cancelDeleteChatBtn")?.addEventListener("click", closeModal);
    $("confirmDeleteChatBtn")?.addEventListener("click", () => {
      closeModal();
      Chat.deleteThread(threadKey, currentUser.id);
      toast("Диалог успешно удалён");
      if (activeThreadKey === threadKey) {
        const remaining = Chat.getAllUserThreads(currentUser.id);
        activeThreadKey = remaining[0]?.key || null;
      }
      renderSidebar();
      renderActiveChat();
    });
  }

  // Список сообщений
  function renderMessageList(messages, otherName) {
    const valid = (messages || []).filter(m => m && (m.text || m.image) && m.text !== "Hello");
    if (!valid.length) {
      return `<div class="chat-empty">Диалог пуст. Задайте вопрос по заказу или подтвердите печать.</div>`;
    }

    return valid.map((m) => {
      const isMe = m.from === currentUser.id;
      const senderName = isMe ? "Вы" : (otherName || "Собеседник");
      const timeStr = m.t ? new Date(m.t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
      return `
        <div class="cab-msg-row ${isMe ? "me" : "them"}">
          <div class="cab-msg-bubble">
            <span class="cab-msg-author" style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:3px">${esc(senderName)}</span>
            ${m.image ? `
              <div class="cab-msg-image-wrap" onclick="N3D.openPhotoModal('${esc(m.image)}')" title="Нажмите для увеличения">
                <img src="${esc(m.image)}" class="cab-msg-img" alt="Фото детали" />
              </div>
            ` : ""}
            ${m.text ? `<p>${esc(m.text)}</p>` : ""}
            <time>${timeStr}</time>
          </div>
        </div>
      `;
    }).join("");
  }

  // Настройки профиля теперь открываются модально по клику на аватар пользователя
  function renderSettings() {
    openProfileSettingsModal((updatedUser) => {
      currentUser = updatedUser;
      renderUserCard();
    });
  }

  // Живая синхронизация между окнами/вкладками
  window.addEventListener("n3d:chat-updated", () => {
    renderSidebar();
    if (activeThreadKey) renderActiveChat();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "n3d_chats" || e.key === "n3d_orders" || e.key === "n3d_presence") {
      renderSidebar();
      if (activeThreadKey) renderActiveChat();
    }
  });

  document.addEventListener("DOMContentLoaded", init);
})();
