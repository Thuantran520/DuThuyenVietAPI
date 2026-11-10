// @ts-nocheck
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    let staffName = 'Chuyên viên hỗ trợ';
    try {
        if (token) {
            const p = JSON.parse(atob(token.split('.')[1]));
            staffName = p.fullname || p.unique_name || p.name || 'Chuyên viên hỗ trợ';
        }
    } catch {}

    const conversationList = document.getElementById('conversationList');
    const chatSearch = document.getElementById('chatSearch');
    const filterBtns = document.querySelectorAll('.chat-filter-btn');

    const chatHeader = document.getElementById('chatHeader');
    const chatEmptyState = document.getElementById('chatEmptyState');
    const chatMessages = document.getElementById('chatMessages');
    const chatInputBar = document.getElementById('chatInputBar');
    const chatInput = document.getElementById('chatInput');
    const btnSendMsg = document.getElementById('btnSendMsg');

    const activeCustomerName = document.getElementById('activeCustomerName');
    const activeCustomerStatus = document.getElementById('activeCustomerStatus');
    const countdownBox = document.getElementById('countdownBox');
    const countdownTimer = document.getElementById('countdownTimer');
    const btnMarkResolved = document.getElementById('btnMarkResolved');

    let allConversations = [];
    let currentFilter = 'all';
    let currentConversationId = null;
    let countdownInterval = null;
    let pollInterval = null;

    // Filter switching
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderConversations();
        });
    });

    if (chatSearch) {
        chatSearch.addEventListener('input', () => {
            renderConversations();
        });
    }

    // Load Conversations
    window.loadConversations = async function(isSilent = false) {
        if (!conversationList) return;
        try {
            const res = await fetch('/api/Chat/Admin/Conversations', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return;

            allConversations = await res.json();
            renderConversations();

            // If an active conversation is open, refresh its messages too
            if (currentConversationId) {
                const activeConv = allConversations.find(c => c.conversationId === currentConversationId);
                if (activeConv) {
                    updateHeaderStatus(activeConv);
                }
                loadMessages(currentConversationId, isSilent);
            }
        } catch (e) {
            console.warn('Error loading conversations:', e);
        }
    };

    function renderConversations() {
        if (!conversationList) return;
        const query = chatSearch ? chatSearch.value.trim().toLowerCase() : '';
        let filtered = allConversations;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(c => c.status.toLowerCase() === currentFilter.toLowerCase());
        }

        if (query) {
            filtered = filtered.filter(c => 
                (c.customerName && c.customerName.toLowerCase().includes(query)) ||
                (c.customerEmail && c.customerEmail.toLowerCase().includes(query)) ||
                (c.assignedStaffName && c.assignedStaffName.toLowerCase().includes(query)) ||
                (c.lastMessageSnippet && c.lastMessageSnippet.toLowerCase().includes(query))
            );
        }

        if (filtered.length === 0) {
            conversationList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 13px;">
                    Không tìm thấy cuộc trò chuyện nào.
                </div>
            `;
            return;
        }

        conversationList.innerHTML = filtered.map(c => {
            const isActive = c.conversationId === currentConversationId;
            let statusBadge = '<span class="status-badge-chat badge-open">Chờ hỗ trợ</span>';
            if (c.status === 'StaffReplied') {
                statusBadge = '<span class="status-badge-chat badge-staff">Đã trả lời (5p)</span>';
            } else if (c.status === 'Resolved') {
                statusBadge = '<span class="status-badge-chat badge-resolved">Đã giải quyết</span>';
            }

            const timeStr = new Date(c.lastMessageAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="conversation-item ${isActive ? 'active' : ''}" onclick="window.selectConversation(${c.conversationId})">
                    <div class="conv-top-row">
                        <span class="conv-name">
                            ${c.customerName || 'Khách hàng'}
                            ${c.unreadStaffCount > 0 ? `<span class="unread-badge">${c.unreadStaffCount}</span>` : ''}
                        </span>
                        <span class="conv-time">${timeStr}</span>
                    </div>
                    <div style="font-size: 11.5px; color: #64748b; margin-bottom: 3px;">
                        ${c.customerEmail ? `<span style="color:#0284c7;"><img src="/images/icons/envelope.png" class="app-icon-sm" alt=""> ${c.customerEmail}</span> · ` : ''}
                        <span style="color: #0f766e; font-weight: 600;"><img src="/images/icons/staff.png" class="app-icon-sm" alt=""> ${c.assignedStaffName || 'Chưa phân công'}</span>
                    </div>
                    <div class="conv-snippet">${c.lastMessageSnippet || 'Chưa có tin nhắn...'}</div>
                    <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <div>${statusBadge}</div>
                        ${c.rating ? `<span style="font-size: 11px; font-weight: 700; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 4px;">⭐ ${c.rating}★</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Select conversation
    window.selectConversation = async (conversationId) => {
        currentConversationId = conversationId;
        const conv = allConversations.find(c => c.conversationId === conversationId);
        if (!conv) return;

        chatEmptyState.style.display = 'none';
        chatHeader.style.display = 'flex';
        chatMessages.style.display = 'flex';
        chatInputBar.style.display = 'flex';

        activeCustomerName.innerHTML = `
            ${conv.customerName || 'Khách hàng'}
            ${conv.customerEmail ? `<span style="font-size: 12.5px; font-weight: 400; color: #64748b; margin-left: 8px;">(Email: ${conv.customerEmail})</span>` : ''}
        `;
        updateHeaderStatus(conv);

        // Mark as read on backend
        fetch(`/api/Chat/MarkAsRead/${conversationId}?viewerType=Staff`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        renderConversations();
        await loadMessages(conversationId, false);
    };

    function updateHeaderStatus(conv) {
        if (conv.status === 'Resolved') {
            activeCustomerStatus.innerHTML = `
                <span style="color: #15803d; font-weight: 600;">✨ Đã giải quyết ${conv.resolvedBy ? `bởi ${conv.resolvedBy}` : ''}</span>
                ${conv.rating ? `<span style="margin-left: 10px; color: #b45309; font-weight: 700; background: #fef3c7; padding: 2px 8px; border-radius: 4px;">⭐ Đánh giá: ${conv.rating}★ ${conv.ratingComment ? `(${conv.ratingComment})` : ''}</span>` : '<span style="margin-left: 8px; color: #94a3b8; font-size: 12px;">(Khách chưa đánh giá)</span>'}
            `;
            btnMarkResolved.style.display = 'none';
            countdownBox.style.display = 'none';
            if (countdownInterval) clearInterval(countdownInterval);
        } else if (conv.status === 'StaffReplied') {
            activeCustomerStatus.innerHTML = `
                <span style="color: #0369a1; font-weight: 600;"><img src="/images/icons/staff.png" class="app-icon-sm" alt=""> Chuyên viên phụ trách: <strong>${conv.assignedStaffName || staffName}</strong></span>
                <span style="color: #64748b; font-size: 12px; margin-left: 8px;">· Đang chờ khách phản hồi</span>
            `;
            btnMarkResolved.style.display = 'inline-flex';
            countdownBox.style.display = 'inline-flex';
            startCountdown(conv.autoResolveRemainingSeconds);
        } else {
            activeCustomerStatus.innerHTML = `
                <span style="color: #b45309; font-weight: 600;">⚡ Khách đang chờ tư vấn</span>
                <span style="color: #0f766e; font-size: 12px; margin-left: 8px;">(Bạn sẽ là chuyên viên phụ trách khi gửi phản hồi)</span>
            `;
            btnMarkResolved.style.display = 'inline-flex';
            countdownBox.style.display = 'none';
            if (countdownInterval) clearInterval(countdownInterval);
        }
    }

    // Countdown 5 minutes timer
    function startCountdown(initialSeconds) {
        if (countdownInterval) clearInterval(countdownInterval);
        if (initialSeconds === null || initialSeconds === undefined) {
            countdownBox.style.display = 'none';
            return;
        }

        let remaining = Math.max(0, initialSeconds);

        const tick = () => {
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            countdownTimer.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

            if (remaining <= 0) {
                clearInterval(countdownInterval);
                window.loadConversations(true);
            }
            remaining--;
        };

        tick();
        countdownInterval = setInterval(tick, 1000);
    }

    // Load messages
    async function loadMessages(conversationId, isSilent = false) {
        try {
            const res = await fetch(`/api/Chat/Messages/${conversationId}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return;

            const data = await res.json();
            const messages = data.messages || [];

            const isScrolledToBottom = chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 50;

            chatMessages.innerHTML = messages.map(m => {
                const isStaff = m.senderType === 'Staff';
                const time = new Date(m.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                if (m.senderName === 'Hệ Thống') {
                    return `
                        <div class="message-bubble system">
                            ${m.messageText}
                        </div>
                    `;
                }

                return `
                    <div class="message-bubble ${isStaff ? 'staff' : 'customer'}">
                        <div style="font-size: 11px; font-weight: 700; margin-bottom: 2px; opacity: 0.9;">
                            ${isStaff ? '👨‍💼 ' : ''}${m.senderName}
                        </div>
                        <div>${escapeHtml(m.messageText)}</div>
                        <div class="msg-meta">${time}</div>
                    </div>
                `;
            }).join('');

            if (!isSilent || isScrolledToBottom) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } catch (e) {
            console.warn('Error loading messages:', e);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    }

    // Send Message
    async function handleSendMessage() {
        const text = chatInput.value.trim();
        if (!text || !currentConversationId) return;

        chatInput.value = '';

        try {
            const res = await fetch('/api/Chat/SendMessage', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationId: currentConversationId,
                    senderType: 'Staff',
                    senderName: staffName,
                    messageText: text
                })
            });

            if (res.ok) {
                await loadMessages(currentConversationId, false);
                await window.loadConversations(true);
            } else {
                Popup.show('Lỗi', 'Không thể gửi tin nhắn.', 'error');
            }
        } catch {
            Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
        }
    }

    if (btnSendMsg) btnSendMsg.addEventListener('click', handleSendMessage);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    // Mark Resolved
    if (btnMarkResolved) {
        btnMarkResolved.addEventListener('click', async () => {
            if (!currentConversationId) return;

            Popup.confirm('Giải Quyết Cuộc Trò Chuyện', 'Đánh dấu yêu cầu của khách hàng đã được tư vấn giải quyết thành công?', async () => {
                try {
                    const res = await fetch(`/api/Chat/Admin/Resolve/${currentConversationId}`, {
                        method: 'PUT',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });

                    if (res.ok) {
                        Popup.show('Thành công', 'Đã đánh dấu cuộc trò chuyện Giải quyết thành công!', 'success');
                        await window.loadConversations(true);
                    } else {
                        Popup.show('Lỗi', 'Không thể cập nhật trạng thái.', 'error');
                    }
                } catch {
                    Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
                }
            });
        });
    }

    // Initial load & Polling every 3.5s
    window.loadConversations();
    pollInterval = setInterval(() => {
        window.loadConversations(true);
    }, 3500);
});
