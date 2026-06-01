import { apiGet, apiPost } from "../services/api.js";
import { API_BASE } from "../services/config.js";
import { encryptMessage, decryptMessage } from "../services/encryption.js";
import { showToast } from '../utils/toast.js';
import { langMap, currentLang } from '../modules/LanguageManager.js';
import { requestPresenceStatuses, formatLastSeen, getPresenceStatus } from '../modules/UserStatus.js';

let currentConversationId = null;
let selectedConversationId = null;
let currentFriendUsername = null;
let myUserId = null;
let activeChatTab = "all";
let oldestMessageId = null;
let hasMoreMessages = true;
let isLoadingOlderMessages = false;
let isLoadingConversations = false;
let isOpeningConversation = false;
let conversationRequestId = 0;
let currentFriendId = null;
let pendingVisibleMessages = [];

export function getCurrentFriendId() {
  return currentFriendId;
}

export function initMessagesPage() {
  const messagesBtn = document.getElementById("messagesBtn");
  const sendBtn = document.getElementById("sendMessageBtn");
  const input = document.getElementById("messageInput");

  if (messagesBtn) {
    messagesBtn.addEventListener("click", openMessagesPage);
  }

  const backBtn = document.getElementById("chatBackBtn");

  if (backBtn) {
    backBtn.addEventListener("click", closeMobileChat);
  }

  document.querySelectorAll(".chat-tab-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".chat-tab-btn").forEach((item) => {
        item.classList.remove("active");
      });

      btn.classList.add("active");
      activeChatTab = btn.dataset.tab;

      if (activeChatTab === "all") {
        await loadConversations();
      } else {
        selectedConversationId = null;
        currentConversationId = null;
        currentFriendUsername = null;

        setActiveChatItem(null);

        const messagesContainer = document.getElementById("messagesContainer");

        if (messagesContainer) {
          messagesContainer.innerHTML = "";
        }

        const input = document.getElementById("messageInput");
        if (input) {
          input.value = "";
        }

        const activeChatBox = document.getElementById("activeChatBox");
        const emptyChatState = document.getElementById("emptyChatState");

        if (activeChatBox) {
          activeChatBox.style.display = "none";
        }

        if (emptyChatState) {
          emptyChatState.style.display = "flex";
        }

        await loadApprovedFriends();
      }
    });
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    if (!pendingVisibleMessages.length) return;

    const messagesToRender = pendingVisibleMessages.filter((message) => {
      return Number(message.conversationId) === Number(currentConversationId);
    });

    pendingVisibleMessages = pendingVisibleMessages.filter((message) => {
      return Number(message.conversationId) !== Number(currentConversationId);
    });

    for (const message of messagesToRender) {
      await renderSingleMessage(message);
    }

    if (messagesToRender.length) {
      await apiPost("/conversation-messages", {
        conversationId: currentConversationId,
        markAsRead: true
      }, {
        showLoading: false
      });

      await loadConversations();
    }
  });

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendMessage();
      }
    });
  }
}

export async function openMessagesPage() {
  hideAllSections();

  document.getElementById("headerUsername").style.display = "block";
  document.getElementById("notificationBell").style.display = "block";
  document.getElementById("profileMenu").style.display = "block";

  localStorage.removeItem("lastActiveLeagueTab");
  localStorage.removeItem("lastActiveNationalLeagueTab");

  location.hash = "messages";

  const page = document.getElementById("messagesPage");
  if (page) page.style.display = "block";

  // reset selected chat
  currentConversationId = null;
  currentFriendUsername = null;
  currentFriendId = null;
  selectedConversationId = null;

  setActiveChatItem(null);

  const messagesContainer = document.getElementById("messagesContainer");
  if (messagesContainer) {
    messagesContainer.innerHTML = "";
  }

  const input = document.getElementById("messageInput");
  if (input) {
    input.value = "";
  }

  const emptyChatState = document.getElementById("emptyChatState");
  const activeChatBox = document.getElementById("activeChatBox");

  if (emptyChatState) {
    emptyChatState.style.display = "flex";
  }

  if (activeChatBox) {
    activeChatBox.style.display = "none";
  }

  const chatHeaderName = document.getElementById("chatHeaderName");
  if (chatHeaderName) {
    chatHeaderName.textContent = "";
  }

  const chatHeaderStatus = document.getElementById("chatHeaderStatus");
  if (chatHeaderStatus) {
    chatHeaderStatus.textContent = "";
  }

  const user = JSON.parse(localStorage.getItem("user"));

  if (user?.id) {
    myUserId = Number(user.id);
  }

  activeChatTab = "all";

  document.querySelectorAll(".chat-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === "all");
  });

  const layout = document.querySelector(".chat-layout");
  if (layout) layout.classList.remove("mobile-chat-open");

  await loadConversations();
  selectedConversationId = null;
}

function hideAllSections() {
  document.querySelectorAll("section").forEach((section) => {
    section.style.display = "none";
  });
}

async function loadConversations() {
  if (isLoadingConversations) return;

  isLoadingConversations = true;

  try {
    const list = document.getElementById("conversationList");
    if (!list) return;

    const data = await apiPost("/my-conversations", {}, {
      showLoading: false
    });

    const conversations = data.conversations || [];

    updateHeaderBadgeFromConversations(conversations);

    if (!data.success || !conversations.length) {
      const emptyChat =
        langMap[currentLang]?.chatEmptyConversation || "No conversations yet";

      list.innerHTML = `<div class="empty-chat" id="emptyChat">${emptyChat}</div>`;
      return;
    }

    list.innerHTML = "";

    conversations.forEach((conversation) => {
      const item = document.createElement("div");
      item.className = "conversation-item";
      item.dataset.friendId = conversation.friendId;

      const isOnline = false;
      const statusText = "Offline";

      item.innerHTML = `
        <div class="conversation-user">
          <span class="online-dot ${isOnline ? "online" : "offline"}"></span>

          <div class="conversation-user-info">
            <span class="conversation-name">${conversation.friendUsername}</span>
            <small class="conversation-status">${statusText}</small>
          </div>
        </div>

        ${Number(conversation.unreadCount) > 0
          ? `<span class="unread-badge">${conversation.unreadCount}</span>`
          : ""
        }
      `;

      if (Number(conversation.conversationId) === Number(selectedConversationId)) {
        item.classList.add("active");
      }

      item.addEventListener("click", async () => {
        if (isOpeningConversation) return;

        const clickedConversationId = Number(conversation.conversationId);

        if (clickedConversationId === Number(selectedConversationId)) {
          return;
        }

        isOpeningConversation = true;

        try {
          selectedConversationId = clickedConversationId;
          setActiveChatItem(item);

          const presence = getPresenceStatus(conversation.friendId);

          await openConversation(
            clickedConversationId,
            conversation.friendUsername,
            conversation.friendId,
            presence.isOnline,
            presence.lastSeen,
            conversation.friendshipStatus
          );

          removeUnreadBadgeFromItem(item);
          updateHeaderBadgeFromVisibleItems();
        } finally {
          isOpeningConversation = false;
        }
      });

      list.appendChild(item);
    });

    requestPresenceStatuses(
      conversations.map((conversation) => conversation.friendId)
    );
  } finally {
    isLoadingConversations = false;
  }
}

function bindVisibilityMessageHandlerOnce() {
  if (document.body.dataset.messageVisibilityBound === "1") return;
  document.body.dataset.messageVisibilityBound = "1";

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    if (!pendingVisibleMessages.length) return;

    const messagesToRender = pendingVisibleMessages.filter((message) => {
      return Number(message.conversationId) === Number(currentConversationId);
    });

    pendingVisibleMessages = pendingVisibleMessages.filter((message) => {
      return Number(message.conversationId) !== Number(currentConversationId);
    });

    for (const message of messagesToRender) {
      await renderSingleMessage(message);
    }

    if (messagesToRender.length) {
      await apiPost("/conversation-messages", {
        conversationId: currentConversationId,
        markAsRead: true
      }, {
        showLoading: false
      });

      await loadConversations();
    }
  });
}

function updateHeaderBadgeFromVisibleItems() {
  const headerBadge = document.getElementById("messagesUnreadBadge");
  if (!headerBadge) return;

  let totalUnread = 0;

  document.querySelectorAll(".conversation-item .unread-badge").forEach((badge) => {
    totalUnread += Number(badge.textContent || 0);
  });

  if (totalUnread > 0) {
    headerBadge.textContent = totalUnread > 99 ? "99+" : totalUnread;
    headerBadge.style.display = "inline-flex";
  } else {
    headerBadge.textContent = "0";
    headerBadge.style.display = "none";
  }
}

function removeUnreadBadgeFromItem(item) {
  const badge = item.querySelector(".unread-badge");
  if (badge) badge.remove();
}

async function loadApprovedFriends() {
  const list = document.getElementById("conversationList");
  if (!list) return;

  const data = await apiPost("/all-users", {}, { showLoading: false });

  const friends = (data.data?.friends || []).filter((friend) => {
    return String(friend.status).trim().toLowerCase() === "approved";
  });

  if (!data.success || !friends.length) {
    const emptyFriends =
      langMap[currentLang]?.chatEmptyFriends || "No friends yet";

    list.innerHTML = `<div class="empty-chat" id="emptyFriends">${emptyFriends}</div>`;
    return;
  }

  list.innerHTML = "";

  friends.forEach((friend) => {
    const item = document.createElement("div");
    item.className = "friend-chat-item";
    item.dataset.friendId = friend.id;

    const isOnline = false;
    const statusText = "Offline";

    const userInfo = document.createElement("div");
    userInfo.className = "conversation-user";

    userInfo.innerHTML = `
    <span class="online-dot ${isOnline ? "online" : "offline"}"></span>

    <div class="conversation-user-info">
    <span class="conversation-name">${friend.username}</span>
    <small class="conversation-status">${statusText}</small>
    </div>
    `;

    const startBtn = document.createElement("button");
    startBtn.className = "start-chat-btn";
    startBtn.innerHTML = '<i class="fa-regular fa-paper-plane"></i>';
    startBtn.title = "Start chat";

    startBtn.addEventListener("click", async (e) => {
      e.stopPropagation();

      if (isOpeningConversation) return;
      isOpeningConversation = true;

      try {
        const response = await apiPost(
          "/conversations",
          { friendId: friend.id },
          { showLoading: false }
        );

        if (!response.success) return;

        selectedConversationId = response.conversationId;

        await switchToAllTab();

        const presence = getPresenceStatus(friend.id);

        await openConversation(
          response.conversationId,
          friend.username,
          friend.id,
          presence.isOnline,
          presence.lastSeen,
          "approved"
        );

      } finally {
        isOpeningConversation = false;
      }
    });

    item.appendChild(userInfo);
    item.appendChild(startBtn);
    list.appendChild(item);
  });

  requestPresenceStatuses(
    friends.map((friend) => friend.id)
  );
}

async function switchToAllTab() {
  activeChatTab = "all";

  document.querySelectorAll(".chat-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === "all");
  });

  await loadConversations();
}

async function openConversation(
  conversationId,
  friendUsername,
  friendId,
  isOnline,
  lastSeen,
  friendshipStatus = "approved"
) {
  const input = document.getElementById("messageInput");
  if (input) {
    input.value = "";
  }

  const requestId = ++conversationRequestId;

  currentConversationId = conversationId;
  currentFriendUsername = friendUsername;
  currentFriendId = friendId;

  oldestMessageId = null;
  hasMoreMessages = true;
  isLoadingOlderMessages = false;
  updateChatHeaderStatus(isOnline, lastSeen);

  const container = document.getElementById("messagesContainer");
  if (container) container.innerHTML = "";

  const emptyState = document.getElementById("emptyChatState");
  const activeChatBox = document.getElementById("activeChatBox");

  if (emptyState) emptyState.style.display = "none";
  if (activeChatBox) activeChatBox.style.display = "flex";

  const headerName = document.getElementById("chatHeaderName");

  if (headerName) {
    let headerNameText = document.getElementById("chatHeaderNameText");
    let headerStatus = document.getElementById("chatHeaderStatus");

    if (!headerNameText) {
      headerNameText = document.createElement("span");
      headerNameText.id = "chatHeaderNameText";
      headerName.appendChild(headerNameText);
    }

    if (!headerStatus) {
      headerStatus = document.createElement("small");
      headerStatus.id = "chatHeaderStatus";
      headerName.appendChild(headerStatus);
    }

    headerNameText.textContent = friendUsername;
  }

  updateChatHeaderStatus(isOnline, lastSeen);
  updateMessageInputVisibility(friendshipStatus);
  bindMessagesScrollOnce();

  const data = await apiPost("/conversation-messages", {
    conversationId
  })

  if (requestId !== conversationRequestId) return;
  if (!data.success) return;

  await renderMessages(data.messages || []);
  oldestMessageId = data.messages?.[0]?.id || null;
  hasMoreMessages = data.hasMore;

  openMobileChatView();
}

async function renderMessages(messages) {
  const container = document.getElementById("messagesContainer");
  if (!container) return;

  container.innerHTML = "";

  const rows = await Promise.all(
    messages.map(createMessageRow)
  );

  rows.forEach((row) => {
    container.appendChild(row);
  });

  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

async function createMessageRow(message) {
  const row = document.createElement("div");
  row.className = "message-row";

  if (Number(message.senderId) === Number(myUserId)) {
    row.classList.add("mine");
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const text = document.createElement("div");
  text.className = "message-text";

  const decryptedText = await decryptMessage(
    message.encryptedMessage
  );

  text.textContent = decryptedText;

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = formatTime(message.createdAt);

  const footer = document.createElement("div");
  footer.className = "message-footer";

  footer.appendChild(time);

  if (Number(message.senderId) === Number(myUserId)) {
    const status = document.createElement("span");
    status.className = "message-status";
    status.textContent =
      Number(message.isRead) === 1 ? "✓✓" : "✓";

    footer.appendChild(status);
  }

  bubble.appendChild(text);
  bubble.appendChild(footer);

  row.appendChild(bubble);

  return row;
}

async function sendMessage() {
  const input = document.getElementById("messageInput");
  if (!input || !currentConversationId) return;

  const text = input.value.trim();
  if (!text) return;

  const sentConversationId = currentConversationId;
  const encryptedMessage = await encryptMessage(text);

  const response = await apiPost(
    "/messages",
    {
      conversationId: sentConversationId,
      encryptedMessage
    },
    {
      showLoading: false
    }
  );

  if (!response.success) return;

  input.value = "";

  // add message immediately to UI
  await renderSingleMessage({
    id: response.messageId,
    conversationId: sentConversationId,
    senderId: myUserId,
    encryptedMessage,
    isRead: 0,
    createdAt: new Date().toISOString()
  });

  selectedConversationId = sentConversationId;
}

export async function updateHeaderMessagesBadge() {
  const badge = document.getElementById("messagesUnreadBadge");
  if (!badge) return;

  const data = await apiPost("/my-conversations", {}, {
    showLoading: false
  });

  if (!data.success || !data.conversations?.length) {
    badge.style.display = "none";
    badge.textContent = "0";
    return;
  }

  const totalUnread = data.conversations.reduce((sum, conversation) => {
    return sum + Number(conversation.unreadCount || 0);
  }, 0);

  if (totalUnread > 0) {
    badge.textContent = totalUnread > 99 ? "99+" : totalUnread;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
    badge.textContent = "0";
  }
}

function getUserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatTime(dateValue) {
  if (!dateValue) return "";

  const userTimeZone = getUserTimeZone();

  const utcDateValue = dateValue.includes("T")
    ? dateValue
    : dateValue.replace(" ", "T") + "Z";

  return new Intl.DateTimeFormat(undefined, {
    timeZone: userTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(utcDateValue));
}

function updateMessageInputVisibility(friendshipStatus) {
  const inputRow = document.querySelector(".message-input-row");

  if (!inputRow) return;

  if (friendshipStatus === "approved") {
    inputRow.style.display = "flex";
  } else {
    inputRow.style.display = "none";
  }
}

function openMobileChatView() {
  const layout = document.querySelector(".chat-layout");
  if (layout) layout.classList.add("mobile-chat-open");
}

function closeMobileChat() {
  const layout = document.querySelector(".chat-layout");
  if (layout) layout.classList.remove("mobile-chat-open");

  currentConversationId = null;
  selectedConversationId = null;
  currentFriendUsername = null;
  currentFriendId = null;

  setActiveChatItem(null);

  const emptyState = document.getElementById("emptyChatState");
  const activeChatBox = document.getElementById("activeChatBox");

  if (emptyState) emptyState.style.display = "flex";
  if (activeChatBox) activeChatBox.style.display = "none";
}

function setActiveChatItem(activeElement) {
  document
    .querySelectorAll(".conversation-item, .friend-chat-item")
    .forEach((item) => {
      item.classList.remove("active");
    });

  if (activeElement) {
    activeElement.classList.add("active");
  }
}

async function renderSingleMessage(message) {
  const container = document.getElementById("messagesContainer");
  if (!container) return;

  const row = await createMessageRow(message);
  container.appendChild(row);

  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}



let chatSocket = null;
let chatPingTimer = null;


export function connectChatSocket() {
  const token = localStorage.getItem("authToken");
  if (!token || chatSocket) return;

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (user?.id) {
    myUserId = Number(user.id);
  }

  const apiUrl = new URL(API_BASE);
  const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  const wsBase = `${wsProtocol}//${apiUrl.host}`;

  chatSocket = new WebSocket(`${wsBase}/chat-socket?token=${token}`);

  chatSocket.onopen = () => {
    chatPingTimer = setInterval(() => {
      if (chatSocket?.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({ type: "ping" }));
      }
    }, 1000);
  };

  chatSocket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "messages_read") {
      if (Number(data.conversationId) === Number(currentConversationId)) {
        document
          .querySelectorAll(".message-row.mine .message-status")
          .forEach((status) => {
            status.textContent = "✓✓";
          });
      }

      if (activeChatTab === "all") {
        await loadConversations();
      } else {
        await updateHeaderMessagesBadge();
      }
      return;
    }

    if (data.type !== "new_message") return;

    const message = data.message || {
      id: data.messageId,
      conversationId: data.conversationId,
      senderId: data.senderId,
      encryptedMessage: data.encryptedMessage,
      isRead: data.isRead,
      createdAt: data.createdAt
    };

    if (!message?.conversationId) return;

    const isReceivedMessage = Number(message.senderId) !== Number(myUserId);

    const messageReceivedText =
      langMap[currentLang]?.message_received || "sent you a message";

    if (
      isReceivedMessage &&
      (
        document.visibilityState !== "visible" ||
        Number(message.conversationId) !== Number(currentConversationId)
      )
    ) {
      showToast(
        `${data.senderUsername || "Someone"} ${messageReceivedText}`,
        "info"
      );
    }

    if (Number(message.conversationId) === Number(currentConversationId)) {
      const shouldShowNow =
        isCurrentConversationReallyVisible(message.conversationId);

      if (shouldShowNow) {
        await renderSingleMessage(message);

        await apiPost("/conversation-messages", {
          conversationId: currentConversationId,
          markAsRead: true
        }, {
          showLoading: false
        });
      } else {
        pendingVisibleMessages.push(message);
      }
    }

    if (activeChatTab === "all") {
      await loadConversations();
    } else {
      await updateHeaderMessagesBadge();
    }
  };

  chatSocket.onerror = (error) => {
    console.error("❌ Chat socket error:", error);
  };

  chatSocket.onclose = () => {
    console.warn("⚠️ Chat socket closed");

    clearInterval(chatPingTimer);
    chatPingTimer = null;
    chatSocket = null;

    setTimeout(() => {
      if (localStorage.getItem("authToken")) {
        connectChatSocket();
      }
    }, 2000);
  };
}

export function disconnectChatSocket() {
  if (chatPingTimer) {
    clearInterval(chatPingTimer);
    chatPingTimer = null;
  }

  if (chatSocket) {
    chatSocket.onclose = null;
    chatSocket.close();
    chatSocket = null;
  }
}

async function loadOlderMessages() {

  if (!currentConversationId || !oldestMessageId) return;
  if (!hasMoreMessages || isLoadingOlderMessages) return;

  isLoadingOlderMessages = true;

  const container = document.getElementById("messagesContainer");
  const previousScrollHeight = container.scrollHeight;

  const data = await apiPost("/conversation-messages", {
    conversationId: currentConversationId,
    beforeId: oldestMessageId
  }, {
    showLoading: false
  });

  if (data.success && data.messages?.length) {
    await prependMessages(data.messages);

    oldestMessageId = data.messages[0].id;
    hasMoreMessages = data.hasMore;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight - previousScrollHeight;
    });
  } else {
    hasMoreMessages = false;
  }

  isLoadingOlderMessages = false;
}

async function prependMessages(messages) {
  const container = document.getElementById("messagesContainer");
  if (!container) return;

  const fragment = document.createDocumentFragment();

  const rows = await Promise.all(
    messages.map(createMessageRow)
  );

  rows.forEach((row) => {
    fragment.appendChild(row);
  });

  container.prepend(fragment);
}

function isCurrentConversationReallyVisible(conversationId) {
  const messagesPage = document.getElementById("messagesPage");
  const activeChatBox = document.getElementById("activeChatBox");
  const layout = document.querySelector(".chat-layout");

  const isMessagesPageVisible =
    messagesPage && messagesPage.style.display !== "none";

  const isChatBoxVisible =
    activeChatBox && activeChatBox.style.display !== "none";

  const isSameConversation =
    Number(conversationId) === Number(currentConversationId);

  const isBrowserTabVisible =
    document.visibilityState === "visible";

  const isMobileChatOpen =
    !layout || window.innerWidth > 480 || layout.classList.contains("mobile-chat-open");

  return (
    isBrowserTabVisible &&
    isMessagesPageVisible &&
    isChatBoxVisible &&
    isSameConversation &&
    isMobileChatOpen
  );
}

function bindMessagesScrollOnce() {
  const container = document.getElementById("messagesContainer");
  if (!container) return;

  if (container.dataset.scrollBound === "1") return;
  container.dataset.scrollBound = "1";

  container.addEventListener("scroll", async () => {
    if (container.scrollTop <= 30) {
      await loadOlderMessages();
    }
  });
}

function updateHeaderBadgeFromConversations(conversations = []) {
  const badge = document.getElementById("messagesUnreadBadge");
  if (!badge) return;

  const totalUnread = conversations.reduce((sum, conversation) => {
    return sum + Number(conversation.unreadCount || 0);
  }, 0);

  if (totalUnread > 0) {
    badge.textContent = totalUnread > 99 ? "99+" : totalUnread;
    badge.style.display = "inline-flex";
  } else {
    badge.textContent = "0";
    badge.style.display = "none";
  }
}

export function updateChatHeaderStatus(isOnline, lastSeen) {
  const status = document.getElementById("chatHeaderStatus");
  if (!status) return;

  if (Number(isOnline) === 1 || isOnline === true) {
    status.textContent = "Online";
    return;
  }

  if (!lastSeen) {
    status.textContent = "Offline";
    return;
  }

  status.textContent = `Last seen ${formatLastSeenDateTime(lastSeen)}`;
}

export function formatLastSeenDateTime(lastSeen) {
  const userTimeZone = getUserTimeZone();

  const dateValue = lastSeen.includes("T")
    ? lastSeen
    : lastSeen.replace(" ", "T") + "Z";

  const date = new Date(dateValue);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    const time = new Intl.DateTimeFormat(undefined, {
      timeZone: userTimeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);

    return `today at ${time}`;
  }

  const datePart = new Intl.DateTimeFormat(undefined, {
    timeZone: userTimeZone,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }).format(date);

  const timePart = new Intl.DateTimeFormat(undefined, {
    timeZone: userTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);

  return `${datePart} ${timePart}`;
}