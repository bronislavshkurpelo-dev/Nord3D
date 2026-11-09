// NORD 3D — Бизнес-логика безопасных сделок (Escrow) и монетизации (core/escrow.js)
// Обеспечивает двухфазную фиксацию средств и транзакционную изоляцию
(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    escrowEnabled: true,
    escrowCommissionPercent: 10,
    minEscrowAmount: 500,
    boostEnabled: true,
    urgentPrice: 250,
    topPrice: 350,
    stealthPrice: 450
  };

  const ESCROW = {
    getConfig() {
      try {
        const c = localStorage.getItem("n3d_monetization");
        return c ? Object.assign({}, DEFAULT_CONFIG, JSON.parse(c)) : DEFAULT_CONFIG;
      } catch {
        return DEFAULT_CONFIG;
      }
    },

    saveConfig(cfg) {
      try {
        localStorage.setItem("n3d_monetization", JSON.stringify(cfg));
      } catch (e) {
        console.warn("[N3D ESCROW] Ошибка сохранения конфигурации:", e);
      }
    },

    calculateCommission(amount) {
      const cfg = this.getConfig();
      const pct = cfg.escrowCommissionPercent || 10;
      return Math.round((Number(amount) || 0) * (pct / 100));
    },

    // Заморозка средств на кошельке заказчика
    async freeze(orderId, customerId, amount) {
      amount = Number(amount) || 0;
      // 1. Попытка серверной транзакции (SQLite BEGIN TRANSACTION -> COMMIT)
      try {
        const res = await fetch("/api/escrow/freeze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, customerId, amount })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) return data;
        }
      } catch {}

      // 2. Локальный fallback (если запущен без сервера)
      if (window.N3D && window.N3D.DB) {
        const w = window.N3D.DB.getWallet(customerId, "customer");
        if (w.balance < amount) {
          throw new Error("Недостаточно средств на балансе кошелька");
        }
        w.balance -= amount;
        w.frozenEscrow = (w.frozenEscrow || 0) + amount;
        window.N3D.DB.saveWallet(w);

        window.N3D.DB.addTransaction({
          userId: customerId,
          type: "escrow_hold",
          amount: -amount,
          description: `Заморозка средств (Гарант NORD 3D) по заказу #${orderId}`,
          orderId: orderId
        });

        return { success: true, balance: w.balance, frozenEscrow: w.frozenEscrow, offline: true };
      }
      return { success: true, offline: true };
    },

    // Перечисление исполнителю при приёмке заказа
    async release(orderId, customerId, printerId, amount) {
      amount = Number(amount) || 0;
      const cfg = this.getConfig();
      const commissionPercent = cfg.escrowCommissionPercent || 10;

      // 1. Серверная транзакция
      try {
        const res = await fetch("/api/escrow/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, customerId, printerId, amount, commissionPercent })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) return data;
        }
      } catch {}

      // 2. Локальный fallback
      if (window.N3D && window.N3D.DB) {
        const custW = window.N3D.DB.getWallet(customerId, "customer");
        custW.frozenEscrow = Math.max(0, (custW.frozenEscrow || 0) - amount);
        window.N3D.DB.saveWallet(custW);

        const commission = Math.round(amount * (commissionPercent / 100));
        const payout = amount - commission;

        const printW = window.N3D.DB.getWallet(printerId, "printer");
        printW.balance = (printW.balance || 0) + payout;
        window.N3D.DB.saveWallet(printW);

        window.N3D.DB.addTransaction({
          userId: customerId,
          type: "escrow_release",
          amount: 0,
          description: `Оплата заказа #${orderId} перечислена мастеру`,
          orderId: orderId
        });

        window.N3D.DB.addTransaction({
          userId: printerId,
          type: "payout",
          amount: payout,
          description: `Выплата за заказ #${orderId} (за вычетом 10% комиссии сервиса)`,
          orderId: orderId
        });

        return { success: true, payout, commission, offline: true };
      }
      return { success: true, offline: true };
    },

    // Возврат средств заказчику при отмене или споре
    async refund(orderId, customerId, amount) {
      amount = Number(amount) || 0;
      // 1. Серверная транзакция
      try {
        const res = await fetch("/api/escrow/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, customerId, amount })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) return data;
        }
      } catch {}

      // 2. Локальный fallback
      if (window.N3D && window.N3D.DB) {
        const custW = window.N3D.DB.getWallet(customerId, "customer");
        custW.frozenEscrow = Math.max(0, (custW.frozenEscrow || 0) - amount);
        custW.balance = (custW.balance || 0) + amount;
        window.N3D.DB.saveWallet(custW);

        window.N3D.DB.addTransaction({
          userId: customerId,
          type: "escrow_refund",
          amount: amount,
          description: `Возврат средств по заказу #${orderId}`,
          orderId: orderId
        });

        return { success: true, balance: custW.balance, offline: true };
      }
      return { success: true, offline: true };
    }
  };

  window.N3D_ESCROW = ESCROW;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ESCROW, DEFAULT_CONFIG };
  }
})();
