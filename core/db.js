// NORD 3D — Модуль доступа к данным (core/db.js)
// Поддерживает работу с сервером (SQLite REST API), IndexedDB (для 3D-моделей и фото) и LocalStorage
(() => {
  "use strict";

  // ==========================================================================
  // 1. INDEXEDDB ДЛЯ БОЛЬШИХ БИНАРНЫХ ФАЙЛОВ (STL, 3MF, ФОТОГРАФИИ)
  // ==========================================================================
  const IDB_NAME = "nord3d_storage";
  const IDB_VERSION = 1;
  let dbPromise = null;

  function openIndexedDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        return resolve(null); // Fallback для сред без IndexedDB
      }
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains("models")) {
          idb.createObjectStore("models", { keyPath: "id" });
        }
        if (!idb.objectStoreNames.contains("photos")) {
          idb.createObjectStore("photos", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn("[N3D IDB] Ошибка открытия IndexedDB:", req.error);
        resolve(null);
      };
    });
    return dbPromise;
  }

  const IDB = {
    async putModel(id, data, metadata = {}) {
      const idb = await openIndexedDB();
      if (!idb) return false;
      return new Promise((resolve) => {
        try {
          const tx = idb.transaction("models", "readwrite");
          const store = tx.objectStore("models");
          store.put({ id, data, metadata, updatedAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    },

    async getModel(id) {
      const idb = await openIndexedDB();
      if (!idb) return null;
      return new Promise((resolve) => {
        try {
          const tx = idb.transaction("models", "readonly");
          const store = tx.objectStore("models");
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result ? req.result.data : null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    },

    async putPhoto(id, data, metadata = {}) {
      const idb = await openIndexedDB();
      if (!idb) return false;
      return new Promise((resolve) => {
        try {
          const tx = idb.transaction("photos", "readwrite");
          const store = tx.objectStore("photos");
          store.put({ id, data, metadata, updatedAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    },

    async getPhoto(id) {
      const idb = await openIndexedDB();
      if (!idb) return null;
      return new Promise((resolve) => {
        try {
          const tx = idb.transaction("photos", "readonly");
          const store = tx.objectStore("photos");
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result ? req.result.data : null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
  };

  // ==========================================================================
  // 2. БАЗА ДАННЫХ ПЛАТФОРМЫ (КЛЮЧИ И СИНХРОНИЗАЦИЯ)
  // ==========================================================================
  const K = {
    ver: "n3d_ver",
    printers: "n3d_printers",
    orders: "n3d_orders",
    chats: "n3d_chats",
    presence: "n3d_presence",
    user: "n3d_user",
    monetization: "n3d_monetization",
    wallets: "n3d_wallets",
    transactions: "n3d_transactions",
    reviews: "n3d_reviews",
    portfolio: "n3d_portfolio"
  };

  function getLocal(k, fallback = null) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }

  function setLocal(k, val) {
    try {
      localStorage.setItem(k, JSON.stringify(val));
      window.dispatchEvent(new CustomEvent("n3d:db-changed", { detail: { key: k } }));
    } catch (e) {
      console.warn("[N3D DB] LocalStorage quota exceeded, storing in memory:", e);
    }
  }

  // Экспорт в глобальный контекст N3D
  window.N3D_IDB = IDB;
  window.N3D_K = K;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { IDB, K, getLocal, setLocal };
  }
})();
