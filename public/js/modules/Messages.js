import { apiGet, apiPost } from "../services/api.js";

let currentConversationId = null;
let selectedConversationId = null;
let currentFriendUsername = null;
let myUserId = null;
let activeChatTab = "all";

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

  const me = await apiGet("/me");
  if (me.success) {
    myUserId = Number(me.user?.id || me.id);
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
  const list = document.getElementById("conversationList");
  if (!list) return;

  list.innerHTML = `<div class="empty-chat">Loading...</div>`;

  const data = await apiPost("/my-conversations", {}, {
    showLoading: false
  });

  if (!data.success || !data.conversations?.length) {
    list.innerHTML = `<div class="empty-chat">No conversations yet</div>`;
    return;
  }

  list.innerHTML = "";

  data.conversations.forEach((conversation) => {
    const item = document.createElement("div");
    item.className = "conversation-item";
    item.textContent = conversation.friendUsername;

    if (Number(conversation.conversationId) === Number(selectedConversationId)) {
      item.classList.add("active");
    }

    item.addEventListener("click", () => {
      selectedConversationId = conversation.conversationId;
      setActiveChatItem(item);

      openConversation(
        conversation.conversationId,
        conversation.friendUsername
      );
    });

    list.appendChild(item);
  });
}

async function loadApprovedFriends() {
  const list = document.getElementById("conversationList");
  if (!list) return;

  list.innerHTML = `<div class="empty-chat">Loading friends...</div>`;

  const data = await apiPost("/all-users");

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

    item.addEventListener("click", () => {
      setActiveChatItem(item);
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
  currentConversationId = conversationId;
  currentFriendUsername = friendUsername;

  const emptyState = document.getElementById("emptyChatState");
  const activeChatBox = document.getElementById("activeChatBox");

  if (emptyState) emptyState.style.display = "none";
  if (activeChatBox) activeChatBox.style.display = "flex";

  const headerName = document.getElementById("chatHeaderName");
  if (headerName) headerName.textContent = friendUsername;

  const data = await apiPost("/conversation-messages", {
    conversationId
  });

  if (!data.success) return;

  renderMessages(data.messages || []);
  openMobileChatView();
}

function renderMessages(messages) {
  const container = document.getElementById("messagesContainer");
  if (!container) return;

  container.innerHTML = "";

  messages.forEach((message) => {
    const row = document.createElement("div");
    row.className = "message-row";

    if (Number(message.senderId) === Number(myUserId)) {
      row.classList.add("mine");
    }

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const text = document.createElement("div");
    text.textContent = message.encryptedMessage;

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = formatTime(message.createdAt);

    bubble.appendChild(text);
    bubble.appendChild(time);
    row.appendChild(bubble);

    container.appendChild(row);
  });

  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("messageInput");
  if (!input || !currentConversationId) return;

  const text = input.value.trim();
  if (!text) return;

  const sentConversationId = currentConversationId;

  const response = await apiPost(
    "/messages",
    {
      conversationId: sentConversationId,
      encryptedMessage: text
    },
    {
      showLoading: false
    }
  );

  if (!response.success) return;

  input.value = "";

  // add message immediately to UI
  renderSingleMessage({
    senderId: myUserId,
    encryptedMessage: text,
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

function renderSingleMessage(message) {
  const container = document.getElementById("messagesContainer");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "message-row mine";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const text = document.createElement("div");
  text.textContent = message.encryptedMessage;

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = formatTime(message.createdAt);

  bubble.appendChild(text);
  bubble.appendChild(time);

  row.appendChild(bubble);
  container.appendChild(row);

  container.scrollTop = container.scrollHeight;
}