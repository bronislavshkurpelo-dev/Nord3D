// NORD 3D — Модуль пользовательского интерфейса (core/ui.js)
// Модальные окна, тосты, темы оформления (Arctic Dark / Light), форматирование
(() => {
  "use strict";

  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stars(score) {
    const s = Math.max(0, Math.min(5, Math.round(Number(score) || 0)));
    return "★".repeat(s) + "☆".repeat(5 - s);
  }

  function formatCurrency(num) {
    return (Number(num) || 0).toLocaleString("ru-RU") + " ₽";
  }

  function toast(msg, duration = 3200) {
    let t = document.getElementById("n3d-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "n3d-toast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.innerHTML = esc(msg);
    t.classList.add("toast--visible");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.classList.remove("toast--visible");
    }, duration);
  }

  function openModal(contentHtml, boxClass = "") {
    let overlay = document.getElementById("n3d-modal-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "n3d-modal-overlay";
      overlay.className = "modal-overlay";
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="modal__box ${esc(boxClass)}">
        <button class="modal__close" onclick="N3D.closeModal()">&times;</button>
        ${contentHtml}
      </div>
    `;
    overlay.classList.add("modal-overlay--open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    const overlay = document.getElementById("n3d-modal-overlay");
    if (overlay) {
      overlay.classList.remove("modal-overlay--open");
      overlay.innerHTML = "";
    }
    document.body.style.overflow = "";
  }

  function confirmModal(title, text, confirmBtnText = "Подтвердить", isDestructive = false) {
    return new Promise((resolve) => {
      openModal(`
        <div class="modal-confirm-box">
          <div style="font-size:36px;margin-bottom:8px">${isDestructive ? "⚠️" : "❓"}</div>
          <h3 style="margin:0 0 8px">${esc(title)}</h3>
          <p class="muted" style="margin:0 0 20px;font-size:14px;line-height:1.45">${esc(text)}</p>
          <div style="display:flex;gap:10px;justify-content:center">
            <button class="btn btn--ghost" id="n3dModalCancel">Отмена</button>
            <button class="btn ${isDestructive ? 'btn--danger' : 'btn--primary'}" id="n3dModalConfirm">${esc(confirmBtnText)}</button>
          </div>
        </div>
      `, "modal__box--narrow");

      document.getElementById("n3dModalCancel")?.addEventListener("click", () => {
        closeModal();
        resolve(false);
      });
      document.getElementById("n3dModalConfirm")?.addEventListener("click", () => {
        closeModal();
        resolve(true);
      });
    });
  }

  // Тема оформления
  function applyTheme(theme) {
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("n3d_theme", t);
    } catch {}
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    return next;
  }

  const UI = {
    esc,
    stars,
    formatCurrency,
    toast,
    openModal,
    closeModal,
    confirmModal,
    applyTheme,
    toggleTheme
  };

  window.N3D_UI = UI;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { UI, esc, stars, formatCurrency, toast, openModal, closeModal, confirmModal, applyTheme, toggleTheme };
  }
})();
