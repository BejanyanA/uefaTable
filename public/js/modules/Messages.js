import { apiGet, apiPost } from "../services/api.js";
import { API_BASE } from "../services/config.js";
import { encryptMessage, decryptMessage } from "../services/encryption.js";

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

export function initMessagesPage() {
  const messagesBtn = document.getElementById("messagesBtn");
  const sendBtn = document.getElementById("sendMessageBtn");
  const input = document.getElementById("messageInput");

  if (messagesBtn) {
    messagesBtn.addEventListener("click", openMessagesPage);
  }

  const messagesContainer = document.getElementById("messagesContainer");

  if (messagesContainer) {
    messagesContainer.addEventListener("scroll", async () => {
      if (messagesContainer.scrollTop <= 20) {
        await loadOlderMessages();
      }
    });
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
        await loadApprovedFriends();
      }
    });
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
  document.getElementById("homePageIcon").style.display = "block";

  localStorage.removeItem("lastActiveLeagueTab");
  localStorage.removeItem("lastActiveNationalLeagueTab");

  location.hash = "messages";

  const page = document.getElementById("messagesPage");
  if (page) page.style.display = "block";

  // reset selected chat
  currentConversationId = null;
  currentFriendUsername = null;

  const emptyState = document.getElementById("emptyChatState");
  const activeChatBox = document.getElementById("activeChatBox");

  if (emptyState) emptyState.style.display = "flex";
  if (activeChatBox) activeChatBox.style.display = "none";

  const user = JSON.parse(localStorage.getItem("user"));

  if (user?.id) {
    myUserId = Number(user.id);
  }

  // const me = await apiGet("/me");

  // if (me.success) {
  //   myUserId = Number(me.user?.id || me.id);

  //   connectChatSocket();

  //   await updateHeaderMessagesBadge();
  // }

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

    list.innerHTML = `<div class="empty-chat">Loading...</div>`;

    const data = await apiPost("/my-conversations", {}, {
      showLoading: false
    });

    const conversations = data.conversations || [];

    updateHeaderBadgeFromConversations(conversations);

    if (!data.success || !conversations.length) {
      list.innerHTML = `<div class="empty-chat">No conversations yet</div>`;
      return;
    }

    list.innerHTML = "";

    conversations.forEach((conversation) => {
      const item = document.createElement("div");
      item.className = "conversation-item";

      item.innerHTML = `
      <span>${conversation.friendUsername}</span>
      ${Number(conversation.unreadCount) > 0
          ? `<span class="unread-badge">${conversation.unreadCount}</span>`
          : ""
        }
    `;

      if (Number(conversation.conversationId) === Number(selectedConversationId)) {
        item.classList.add("active");
      }

      item.addEventListener("click", async () => {
        selectedConversationId = conversation.conversationId;
        setActiveChatItem(item);

        await openConversation(
          conversation.conversationId,
          conversation.friendUsername
        );

        removeUnreadBadgeFromItem(item);
        updateHeaderBadgeFromVisibleItems();
      });

      list.appendChild(item);
    });

  } finally {
    isLoadingConversations = false;
  }
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

  list.innerHTML = `<div class="empty-chat">Loading friends...</div>`;

  const data = await apiPost("/all-users", {}, {
    showLoading: false
  });

  const friends = (data.data?.friends || [])
    .filter(friend =>
      friend.status === "approved"
    );

  if (!data.success || !friends.length) {
    list.innerHTML = `<div class="empty-chat">No approved friends</div>`;
    return;
  }

  list.innerHTML = "";

  friends.forEach((friend) => {
    const item = document.createElement("div");
    item.className = "friend-chat-item";

    item.addEventListener("click", async () => {
      const clickedConversationId = Number(conversation.conversationId);

      if (isOpeningConversation) return;
      if (clickedConversationId === Number(selectedConversationId)) return;

      isOpeningConversation = true;

      try {
        selectedConversationId = clickedConversationId;
        setActiveChatItem(item);

        await openConversation(
          clickedConversationId,
          conversation.friendUsername
        );

        removeUnreadBadgeFromItem(item);
        updateHeaderBadgeFromVisibleItems();
      } finally {
        isOpeningConversation = false;
      }
    });

    const name = document.createElement("span");
    name.textContent = friend.username;

    const startBtn = document.createElement("button");
    startBtn.className = "start-chat-btn";
    startBtn.textContent = "+";
    startBtn.title = "Start chat";

    startBtn.addEventListener("click", async (e) => {
      e.stopPropagation();

      const response = await apiPost("/conversations", {
        friendId: friend.id
      });

      if (!response.success) return;

      selectedConversationId = response.conversationId;

      await switchToAllTab();

      await openConversation(
        response.conversationId,
        friend.username
      );
    });

    item.appendChild(name);
    item.appendChild(startBtn);

    list.appendChild(item);
  });
}

async function switchToAllTab() {
  activeChatTab = "all";

  document.querySelectorAll(".chat-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === "all");
  });

  await loadConversations();
}

function setActiveConversationItem(activeItem) {
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.classList.remove("active");
  });

  activeItem.classList.add("active");
}


const emptyState = document.getElementById("emptyChatState");
const activeChatBox = document.getElementById("activeChatBox");

if (emptyState) emptyState.style.display = "none";
if (activeChatBox) activeChatBox.style.display = "flex";

async function openConversation(conversationId, friendUsername) {
  const input = document.getElementById("messageInput");
  if (input) {
    input.value = "";
  }

  const requestId = ++conversationRequestId;

  currentConversationId = conversationId;
  currentFriendUsername = friendUsername;

  oldestMessageId = null;
  hasMoreMessages = true;
  isLoadingOlderMessages = false;

  const container = document.getElementById("messagesContainer");
  if (container) container.innerHTML = "";

  const emptyState = document.getElementById("emptyChatState");
  const activeChatBox = document.getElementById("activeChatBox");

  if (emptyState) emptyState.style.display = "none";
  if (activeChatBox) activeChatBox.style.display = "flex";

  const headerName = document.getElementById("chatHeaderName");
  if (headerName) headerName.textContent = friendUsername;

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

  for (const message of messages) {
    const row = await createMessageRow(message);
    container.appendChild(row);
  }

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

  // only refresh conversation order
  await loadConversations();
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

function openMobileChatView() {
  const layout = document.querySelector(".chat-layout");
  if (layout) layout.classList.add("mobile-chat-open");
}

function closeMobileChat() {
  const layout = document.querySelector(".chat-layout");
  if (layout) layout.classList.remove("mobile-chat-open");

  currentConversationId = null;
  currentFriendUsername = null;

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

  activeElement.classList.add("active");
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

export function connectChatSocket() {
  const token = localStorage.getItem("authToken");
  if (!token || chatSocket) return;

  const apiUrl = new URL(API_BASE);
  const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  const wsBase = `${wsProtocol}//${apiUrl.host}`;

  chatSocket = new WebSocket(`${wsBase}/chat-socket?token=${token}`);

  chatSocket.onopen = () => {
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

      await loadConversations();
      await updateHeaderMessagesBadge();
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

    if (Number(message.conversationId) === Number(currentConversationId)) {
      await renderSingleMessage(message);

      await apiPost("/conversation-messages", {
        conversationId: currentConversationId
      }, {
        showLoading: false
      });
    }

    await loadConversations();
  };

  chatSocket.onerror = (error) => {
    console.error("❌ Chat socket error:", error);
  };

  chatSocket.onclose = () => {
    console.warn("⚠️ Chat socket closed");
    chatSocket = null;

    setTimeout(connectChatSocket, 2000);
  };
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

  for (const message of messages) {
    const row = await createMessageRow(message);
    fragment.appendChild(row);
  }

  container.prepend(fragment);
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