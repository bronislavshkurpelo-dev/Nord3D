// NORD 3D — Модуль реального времени и чата (core/chat.js)
// Поддерживает двусторонний WebSocket (RFC 6455) с индикацией набора текста и fallback на SSE
(() => {
  "use strict";

  let ws = null;
  let wsConnected = false;
  let typingTimer = null;
  const messageListeners = new Set();
  const typingListeners = new Set();

  function getWsUrl() {
    if (typeof location === "undefined") return "ws://localhost:3000/ws";
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}/ws`;
  }

  function initWebSocket() {
    if (typeof WebSocket === "undefined") return;
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

    try {
      ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        wsConnected = true;
        // Регистрация активного пользователя
        const u = window.N3D_AUTH ? window.N3D_AUTH.user() : null;
        if (u) {
          ws.send(JSON.stringify({ type: "auth", userId: u.id, role: u.role, name: u.name }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "chat_message") {
            messageListeners.forEach((fn) => fn(data));
            window.dispatchEvent(new CustomEvent("n3d:chat-message", { detail: data }));
          } else if (data.type === "typing_start" || data.type === "typing_stop") {
            typingListeners.forEach((fn) => fn(data));
            window.dispatchEvent(new CustomEvent("n3d:typing", { detail: data }));
          }
        } catch (e) {
          console.warn("[N3D WS] Ошибка парсинга сообщения:", e);
        }
      };

      ws.onclose = () => {
        wsConnected = false;
        // Переподключение через 3 секунды
        setTimeout(initWebSocket, 3000);
      };

      ws.onerror = () => {
        wsConnected = false;
      };
    } catch {
      wsConnected = false;
    }
  }

  const CHAT = {
    connect: initWebSocket,

    isWebSocketConnected() {
      return wsConnected;
    },

    sendMessage(threadKey, text, sender = null) {
      const msg = {
        id: "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        time: Date.now(),
        from: sender ? sender.id : "user",
        senderRole: sender ? sender.role : "customer",
        senderName: sender ? sender.name : "Заказчик",
        text: text
      };

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "chat_message",
          threadKey: threadKey,
          message: msg
        }));
      }

      // Также сохраняем через локальную БД / REST API
      if (window.N3D && window.N3D.DB) {
        window.N3D.DB.addChatMessage(threadKey, msg);
      }

      return msg;
    },

    sendTyping(threadKey, isTyping = true) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const u = window.N3D_AUTH ? window.N3D_AUTH.user() : null;
      ws.send(JSON.stringify({
        type: isTyping ? "typing_start" : "typing_stop",
        threadKey: threadKey,
        userId: u ? u.id : "guest",
        userName: u ? u.name : "Собеседник"
      }));
    },

    handleInputTyping(threadKey) {
      this.sendTyping(threadKey, true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        this.sendTyping(threadKey, false);
      }, 2000);
    },

    onMessage(cb) {
      messageListeners.add(cb);
      return () => messageListeners.delete(cb);
    },

    onTyping(cb) {
      typingListeners.add(cb);
      return () => typingListeners.delete(cb);
    }
  };

  window.N3D_CHAT = CHAT;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { CHAT };
  }
})();
