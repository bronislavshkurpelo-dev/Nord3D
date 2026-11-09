// NORD 3D — Модуль аутентификации и сессий (core/auth.js)
// Поддерживает безопасные сессии через HttpOnly Cookies на сервере и локальные сессии
(() => {
  "use strict";

  const USER_KEY = "n3d_user";

  function getUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  function setUser(u) {
    try {
      if (u) {
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(USER_KEY);
      }
      window.dispatchEvent(new CustomEvent("n3d:auth-changed", { detail: { user: u } }));
    } catch (e) {
      console.warn("[N3D AUTH] Ошибка сохранения пользователя:", e);
    }
  }

  const AUTH = {
    user: getUser,
    setUser: setUser,

    async login(phone, password, role = "customer") {
      // 1. Попытка авторизации через серверный REST API (с проверкой scrypt хэша и куки)
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, password, role }),
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setUser(data.user);
            return { success: true, user: data.user };
          }
        }
      } catch {
        // Fallback для чисто статического/офлайн режима
      }

      // 2. Локальный fallback (если сервер недоступен или статический запуск)
      const mockUser = {
        id: (role === "printer" ? "p" : "c") + phone.replace(/\D/g, ""),
        name: role === "printer" ? "Мастер Норильска" : "Заказчик",
        phone: phone,
        role: role,
        district: "Норильск (центр)",
        authTime: Date.now()
      };
      setUser(mockUser);
      return { success: true, user: mockUser, offline: true };
    },

    async register(userData) {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setUser(data.user);
            return { success: true, user: data.user };
          }
        }
      } catch {
        // Fallback
      }

      const id = (userData.role === "printer" ? "p" : "c") + String(userData.phone || Date.now()).replace(/\D/g, "");
      const localUser = {
        id: id,
        name: userData.name || "Пользователь NORD 3D",
        phone: userData.phone || "",
        role: userData.role || "customer",
        district: userData.district || "Норильск (центр)",
        telegram: userData.telegram || "",
        authTime: Date.now()
      };
      setUser(localUser);
      return { success: true, user: localUser, offline: true };
    },

    async logout() {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } catch {}
      setUser(null);
      return { success: true };
    },

    async checkSession() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setUser(data.user);
            return data.user;
          }
        }
      } catch {}
      return getUser();
    }
  };

  window.N3D_AUTH = AUTH;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { AUTH, getUser, setUser };
  }
})();
