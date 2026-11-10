// @ts-nocheck
/* ==========================================================================
   DuThuyenViet - Customer Floating Live Chat Widget (Upgraded Professional)
   ========================================================================== */

(function initCustomerLiveChat() {
    // Only on customer-facing pages (skip admin area)
    if (window.location.pathname.toLowerCase().includes('/admin/')) return;

    function onReady(fn) {
        if (document.readyState !== 'loading') {
            fn();
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    }

    onReady(() => {
        // Prevent duplicate injection
        if (document.getElementById('dutuyen-live-chat-wrap')) return;

        // 1. Session ID persistence
        let sessionId = localStorage.getItem('dutuyen_chat_session_id');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('dutuyen_chat_session_id', sessionId);
        }

        let conversationId = null;
        let isChatOpen = false;
        let chatPollTimer = null;
        let backgroundPollTimer = null;
        let currentRating = 5;
        let isLeadCaptured = false;

        // Check user identity
        function getUserIdentity() {
            try {
                const token = localStorage.getItem('auth_token');
                if (token && token !== 'null') {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    const name = payload.unique_name || payload.name || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
                    const email = payload.email || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
                    if (name || email) {
                        return { isLoggedIn: true, name: name || 'Khách hàng', email: email || '' };
                    }
                }
            } catch {}

            try {
                const storedGuest = sessionStorage.getItem('dutuyen_guest_lead');
                if (storedGuest) {
                    const guest = JSON.parse(storedGuest);
                    if (guest.name && guest.email) {
                        return { isLoggedIn: false, isGuestSaved: true, name: guest.name, email: guest.email };
                    }
                }
            } catch {}

            return { isLoggedIn: false, isGuestSaved: false, name: '', email: '' };
        }

        // 2. Inject floating trigger button & chat container
        const chatWidgetWrap = document.createElement('div');
        chatWidgetWrap.id = 'dutuyen-live-chat-wrap';
        chatWidgetWrap.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99990;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        chatWidgetWrap.innerHTML = `
            <!-- FLOATING TOGGLE BUTTON -->
            <button id="btnChatToggle" type="button" style="
                background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
                color: #ffffff;
                border: none;
                border-radius: 30px;
                padding: 10px 18px 10px 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                box-shadow: 0 8px 24px rgba(13, 148, 136, 0.38);
                transition: all 0.25s ease;
                outline: none;
                user-select: none;
            ">
                <img src="/images/icons/review-chat.png" class="app-icon" alt="" style="width: 22px; height: 22px; object-fit: contain; filter: brightness(0) invert(1); margin: 0; display: block; flex-shrink: 0;">
                <span style="font-weight: 600; font-size: 13.5px; letter-spacing: 0.2px; white-space: nowrap;">Hỗ Trợ 24/7</span>
                <span id="chatUnreadBadge" style="
                    display: none;
                    background: #ef4444;
                    color: white;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 2px 7px;
                    border-radius: 12px;
                    line-height: 1.2;
                    box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
                ">1</span>
            </button>

            <!-- CHAT WINDOW CARD -->
            <div id="chatWindow" style="
                display: none;
                position: absolute;
                bottom: 64px;
                right: 0;
                width: 380px;
                max-width: calc(100vw - 32px);
                height: 520px;
                max-height: calc(100vh - 110px);
                background: #ffffff;
                border-radius: 20px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06);
                overflow: hidden;
                flex-direction: column;
                animation: chatSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
                    color: #ffffff;
                    padding: 14px 18px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: rgba(255,255,255,0.2); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <img src="/images/icons/staff.png" class="app-icon" alt="" style="width: 20px; height: 20px; filter: brightness(0) invert(1);">
                        </span>
                        <div>
                            <div id="chatStaffHeaderName" style="font-weight: 700; font-size: 14.5px; line-height: 1.2;">Tư Vấn Du Thuyền Việt</div>
                            <div id="chatStaffHeaderSub" style="font-size: 11px; opacity: 0.95; display: flex; align-items: center; gap: 5px; margin-top: 2px;">
                                <span style="width: 7px; height: 7px; background: #4ade80; border-radius: 50%; display: inline-block; box-shadow: 0 0 6px #4ade80;"></span>
                                Đang trực tuyến sẵn sàng hỗ trợ
                            </div>
                        </div>
                    </div>
                    <button id="btnCloseChat" type="button" style="
                        background: rgba(255,255,255,0.18);
                        border: none;
                        color: #ffffff;
                        width: 30px;
                        height: 30px;
                        border-radius: 50%;
                        font-size: 20px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s;
                        line-height: 1;
                    " title="Đóng">&times;</button>
                </div>

                <!-- PRE-CHAT LEAD FORM (Bắt buộc nhập Tên & Email nếu chưa đăng nhập) -->
                <div id="preChatLeadForm" style="display: none; padding: 24px; flex: 1; flex-direction: column; justify-content: center; background: #f8fafc;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="/images/icons/review-chat.png" class="app-icon-xl" alt="" style="margin-bottom: 8px;">
                        <h4 style="font-family: 'Playfair Display', serif; font-size: 18px; color: #0f172a; margin: 0 0 4px;">Tư Vấn Hải Trình 24/7</h4>
                        <p style="font-size: 12.5px; color: #64748b; margin: 0; line-height: 1.45;">Vui lòng nhập thông tin để chuyên viên Du Thuyền Việt kết nối và hỗ trợ chu đáo nhất:</p>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <label style="display: block; font-size: 12.5px; font-weight: 600; color: #334155; margin-bottom: 6px;">Họ và tên của bạn *</label>
                        <input id="guestNameInput" type="text" placeholder="VD: Nguyễn Văn A" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; outline: none; box-sizing: border-box;">
                    </div>

                    <div style="margin-bottom: 18px;">
                        <label style="display: block; font-size: 12.5px; font-weight: 600; color: #334155; margin-bottom: 6px;">Địa chỉ Email liên hệ *</label>
                        <input id="guestEmailInput" type="email" placeholder="VD: nguyen@gmail.com" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; outline: none; box-sizing: border-box;">
                    </div>

                    <div id="guestLeadError" style="display: none; color: #dc2626; font-size: 12px; margin-bottom: 12px; text-align: center;"></div>

                    <button id="btnStartGuestChat" type="button" style="
                        width: 100%;
                        background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
                        color: white;
                        border: none;
                        padding: 12px;
                        border-radius: 10px;
                        font-weight: 600;
                        font-size: 14px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
                        transition: all 0.2s;
                    ">
                        Bắt Đầu Trò Chuyện Ngay
                    </button>
                </div>

                <!-- CHAT STREAM VIEW (Hiển thị khi đã có thông tin khách) -->
                <div id="chatStreamWrap" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                    <!-- Status / Inactivity Notice -->
                    <div id="chatStatusNotice" style="display: none; background: #f0fdf4; border-bottom: 1px solid #bbf7d0; color: #15803d; font-size: 11.5px; padding: 7px 14px; text-align: center; font-weight: 500;">
                        ✨ Phiên tư vấn đã được đánh dấu Giải quyết thành công.
                    </div>

                    <!-- Messages Stream -->
                    <div id="chatClientMessages" style="
                        flex: 1;
                        padding: 16px;
                        overflow-y: auto;
                        background: #f8fafc;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    ">
                        <div style="text-align: center; color: #94a3b8; font-size: 12.5px; margin: auto;">Đang kết nối trung tâm hỗ trợ...</div>
                    </div>

                    <!-- RATING WIDGET (Hiện ra sau khi phiên chat giải quyết) -->
                    <div id="chatRatingWidget" style="display: none; background: #ffffff; border-top: 1px solid #e2e8f0; padding: 12px 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 12.5px; font-weight: 700; color: #0f172a;">Đánh giá chất lượng phục vụ:</span>
                            <span id="starRatingLabel" style="font-size: 11.5px; color: #0d9488; font-weight: 600;">Xuất sắc (5★)</span>
                        </div>
                        <div id="starContainer" style="display: flex; gap: 8px; margin-bottom: 8px; font-size: 22px; cursor: pointer;">
                            <span class="star-item" data-value="1" style="color: #f59e0b;">★</span>
                            <span class="star-item" data-value="2" style="color: #f59e0b;">★</span>
                            <span class="star-item" data-value="3" style="color: #f59e0b;">★</span>
                            <span class="star-item" data-value="4" style="color: #f59e0b;">★</span>
                            <span class="star-item" data-value="5" style="color: #f59e0b;">★</span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <input id="ratingCommentInput" type="text" placeholder="Góp ý thêm (không bắt buộc)..." style="flex: 1; padding: 7px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12.5px; outline: none;">
                            <button id="btnSubmitRating" type="button" style="background: #0d9488; color: white; border: none; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">Gửi</button>
                        </div>
                    </div>

                    <!-- Input Footer -->
                    <div id="chatInputBar" style="
                        padding: 12px 14px;
                        background: #ffffff;
                        border-top: 1px solid #f1f5f9;
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        flex-shrink: 0;
                    ">
                        <input id="chatClientInput" type="text" placeholder="Nhập câu hỏi cần tư vấn..." style="
                            flex: 1;
                            padding: 10px 16px;
                            border: 1.5px solid #cbd5e1;
                            border-radius: 22px;
                            font-size: 13.5px;
                            outline: none;
                            background: #ffffff;
                            color: #0f172a;
                            transition: border-color 0.2s;
                            box-sizing: border-box;
                        ">
                        <button id="btnClientSend" type="button" style="
                            background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
                            color: white;
                            border: none;
                            border-radius: 50%;
                            width: 40px;
                            height: 40px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            flex-shrink: 0;
                            box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3);
                            transition: all 0.2s;
                        " title="Gửi tin nhắn">
                            <img src="/images/icons/arrow-right.png" class="app-icon-sm" alt="" style="filter: brightness(0) invert(1); width: 14px; height: 14px;">
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(chatWidgetWrap);

        const btnToggle = document.getElementById('btnChatToggle');
        const chatWindow = document.getElementById('chatWindow');
        const btnClose = document.getElementById('btnCloseChat');
        const preChatLeadForm = document.getElementById('preChatLeadForm');
        const chatStreamWrap = document.getElementById('chatStreamWrap');
        const guestNameInput = document.getElementById('guestNameInput');
        const guestEmailInput = document.getElementById('guestEmailInput');
        const btnStartGuestChat = document.getElementById('btnStartGuestChat');
        const guestLeadError = document.getElementById('guestLeadError');

        const staffHeaderName = document.getElementById('chatStaffHeaderName');
        const staffHeaderSub = document.getElementById('chatStaffHeaderSub');
        const messagesBox = document.getElementById('chatClientMessages');
        const inputField = document.getElementById('chatClientInput');
        const btnSend = document.getElementById('btnClientSend');
        const unreadBadge = document.getElementById('chatUnreadBadge');
        const statusNotice = document.getElementById('chatStatusNotice');

        const ratingWidget = document.getElementById('chatRatingWidget');
        const starItems = document.querySelectorAll('.star-item');
        const starRatingLabel = document.getElementById('starRatingLabel');
        const ratingCommentInput = document.getElementById('ratingCommentInput');
        const btnSubmitRating = document.getElementById('btnSubmitRating');

        const starLabels = {
            1: 'Chưa hài lòng (1★)',
            2: 'Tạm được (2★)',
            3: 'Bình thường (3★)',
            4: 'Hài lòng (4★)',
            5: 'Rất hài lòng & Xuất sắc (5★)'
        };

        // Star rating picker
        function updateStarUI(val) {
            currentRating = val;
            starRatingLabel.innerText = starLabels[val] || `${val}★`;
            starItems.forEach(star => {
                const sVal = parseInt(star.dataset.value);
                star.style.color = sVal <= val ? '#f59e0b' : '#cbd5e1';
            });
        }

        starItems.forEach(star => {
            star.addEventListener('click', () => {
                updateStarUI(parseInt(star.dataset.value));
            });
            star.addEventListener('mouseenter', () => {
                const hoverVal = parseInt(star.dataset.value);
                starItems.forEach(s => {
                    const sVal = parseInt(s.dataset.value);
                    s.style.color = sVal <= hoverVal ? '#fbbf24' : '#cbd5e1';
                });
            });
            star.addEventListener('mouseleave', () => {
                updateStarUI(currentRating);
            });
        });

        // Submit Rating
        btnSubmitRating.addEventListener('click', async () => {
            if (!conversationId) return;
            const comment = ratingCommentInput.value.trim();

            try {
                btnSubmitRating.disabled = true;
                const res = await fetch('/api/Chat/Rate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversationId: conversationId,
                        rating: currentRating,
                        comment: comment || 'Rất hài lòng'
                    })
                });

                if (res.ok) {
                    ratingWidget.innerHTML = `
                        <div style="text-align: center; color: #15803d; font-size: 13px; font-weight: 600; padding: 6px 0;">
                            ✨ Cảm ơn bạn đã đánh giá dịch vụ ${currentRating}★!
                        </div>
                    `;
                    await fetchMessages();
                }
            } catch (err) {
                console.warn('Error rating chat:', err);
            } finally {
                btnSubmitRating.disabled = false;
            }
        });

        // Toggle Chat
        btnToggle.addEventListener('click', async () => {
            isChatOpen = !isChatOpen;
            chatWindow.style.display = isChatOpen ? 'flex' : 'none';
            if (isChatOpen) {
                unreadBadge.style.display = 'none';

                const identity = getUserIdentity();
                if (identity.isLoggedIn || identity.isGuestSaved) {
                    // Đã đăng nhập hoặc đã từng điền tên email -> Vào thẳng cuộc trò chuyện
                    preChatLeadForm.style.display = 'none';
                    chatStreamWrap.style.display = 'flex';
                    if (!conversationId) {
                        await startOrGetChat(identity.name, identity.email);
                    } else {
                        await fetchMessages();
                    }
                    messagesBox.scrollTop = messagesBox.scrollHeight;
                    inputField.focus();
                    startPolling();
                } else {
                    // Chưa đăng nhập -> Hiện Form bắt buộc nhập Họ và tên & Email
                    preChatLeadForm.style.display = 'flex';
                    chatStreamWrap.style.display = 'none';
                    guestNameInput.focus();
                }
            } else {
                stopPolling();
            }
        });

        btnClose.addEventListener('click', () => {
            isChatOpen = false;
            chatWindow.style.display = 'none';
            stopPolling();
        });

        // Guest Submit Lead Form
        btnStartGuestChat.addEventListener('click', async () => {
            const name = guestNameInput.value.trim();
            const email = guestEmailInput.value.trim();

            if (!name) {
                guestLeadError.innerText = 'Vui lòng nhập Họ và tên của bạn.';
                guestLeadError.style.display = 'block';
                guestNameInput.focus();
                return;
            }
            if (!email || !email.includes('@')) {
                guestLeadError.innerText = 'Vui lòng nhập địa chỉ Email hợp lệ.';
                guestLeadError.style.display = 'block';
                guestEmailInput.focus();
                return;
            }

            guestLeadError.style.display = 'none';
            sessionStorage.setItem('dutuyen_guest_lead', JSON.stringify({ name, email }));

            preChatLeadForm.style.display = 'none';
            chatStreamWrap.style.display = 'flex';

            await startOrGetChat(name, email);
            messagesBox.scrollTop = messagesBox.scrollHeight;
            inputField.focus();
            startPolling();
        });

        // Initialize Chat Session
        async function startOrGetChat(customerName, customerEmail) {
            try {
                const res = await fetch('/api/Chat/StartOrGet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        customerName: customerName,
                        customerEmail: customerEmail
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    conversationId = data.conversationId;
                    updateStaffHeader(data.assignedStaffName);
                    updateResolutionState(data);
                    renderMessages(data.messages || []);
                }
            } catch (err) {
                messagesBox.innerHTML = '<div style="color: #ef4444; text-align: center; font-size: 12px; margin: auto;">Không thể kết nối Live Chat.</div>';
            }
        }

        function updateStaffHeader(assignedStaffName) {
            if (assignedStaffName) {
                staffHeaderName.innerText = assignedStaffName;
                staffHeaderSub.innerHTML = `
                    <span style="width: 7px; height: 7px; background: #4ade80; border-radius: 50%; display: inline-block; box-shadow: 0 0 6px #4ade80;"></span>
                    Chuyên viên tư vấn phụ trách · Đang hỗ trợ
                `;
            } else {
                staffHeaderName.innerText = 'Tư Vấn Du Thuyền Việt';
                staffHeaderSub.innerHTML = `
                    <span style="width: 7px; height: 7px; background: #4ade80; border-radius: 50%; display: inline-block; box-shadow: 0 0 6px #4ade80;"></span>
                    Đang trực tuyến sẵn sàng hỗ trợ
                `;
            }
        }

        function updateResolutionState(data) {
            if (data.status === 'Resolved') {
                statusNotice.style.display = 'block';
                if (!data.rating) {
                    ratingWidget.style.display = 'block';
                    updateStarUI(5);
                } else {
                    ratingWidget.style.display = 'none';
                    statusNotice.innerHTML = `✨ Phiên hỗ trợ đã hoàn tất · Bạn đã đánh giá ${data.rating}★ dịch vụ.`;
                }
            } else {
                statusNotice.style.display = 'none';
                ratingWidget.style.display = 'none';
            }
        }

        // Fetch Messages
        async function fetchMessages() {
            if (!conversationId) return;
            try {
                const res = await fetch(`/api/Chat/Messages/${conversationId}`);
                if (res.ok) {
                    const data = await res.json();
                    updateStaffHeader(data.assignedStaffName);
                    updateResolutionState(data);
                    renderMessages(data.messages || []);
                }
            } catch {}
        }

        function renderMessages(messages) {
            if (!messages || messages.length === 0) {
                messagesBox.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 12px; margin: auto;">Chưa có tin nhắn nào. Hãy gửi câu hỏi đầu tiên!</div>';
                return;
            }

            messagesBox.innerHTML = messages.map(m => {
                const isStaff = m.senderType === 'Staff';
                const time = new Date(m.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                if (m.senderName === 'Hệ Thống') {
                    return `
                        <div style="align-self: center; background: #e2e8f0; color: #475569; font-size: 11px; padding: 5px 14px; border-radius: 12px; text-align: center; margin: 4px 0; max-width: 90%; line-height: 1.4;">
                            ${escapeHtml(m.messageText)}
                        </div>
                    `;
                }

                return `
                    <div style="
                        align-self: ${isStaff ? 'flex-start' : 'flex-end'};
                        max-width: 82%;
                        background: ${isStaff ? '#ffffff' : '#0d9488'};
                        color: ${isStaff ? '#1e293b' : '#ffffff'};
                        border: ${isStaff ? '1px solid #e2e8f0' : 'none'};
                        border-radius: 14px;
                        ${isStaff ? 'border-bottom-left-radius: 3px;' : 'border-bottom-right-radius: 3px;'}
                        padding: 9px 13px;
                        font-size: 13.5px;
                        line-height: 1.45;
                        box-shadow: ${isStaff ? '0 1px 4px rgba(0,0,0,0.04)' : '0 2px 6px rgba(13,148,136,0.25)'};
                        word-break: break-word;
                    ">
                        <div style="font-size: 10.5px; opacity: ${isStaff ? '0.85' : '0.9'}; margin-bottom: 3px; font-weight: 700; color: ${isStaff ? '#0d9488' : '#ffffff'};">
                            ${isStaff ? '👨‍💼 ' : ''}${escapeHtml(m.senderName)}
                        </div>
                        <div>${escapeHtml(m.messageText)}</div>
                        <div style="font-size: 9.5px; opacity: 0.65; margin-top: 4px; text-align: right;">${time}</div>
                    </div>
                `;
            }).join('');
        }

        function escapeHtml(t) {
            if (!t) return '';
            const d = document.createElement('div');
            d.innerText = t;
            return d.innerHTML;
        }

        // Send Message
        async function sendClientMessage() {
            const text = inputField.value.trim();
            if (!text) return;

            const identity = getUserIdentity();
            if (!conversationId) {
                await startOrGetChat(identity.name || 'Khách hàng', identity.email || '');
                if (!conversationId) return;
            }

            inputField.value = '';
            inputField.disabled = true;

            try {
                const res = await fetch('/api/Chat/SendMessage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversationId: conversationId,
                        senderType: 'Customer',
                        messageText: text
                    })
                });

                if (res.ok) {
                    await fetchMessages();
                    messagesBox.scrollTop = messagesBox.scrollHeight;
                }
            } catch (err) {
                console.warn('Error sending message:', err);
            } finally {
                inputField.disabled = false;
                inputField.focus();
            }
        }

        btnSend.addEventListener('click', sendClientMessage);
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendClientMessage();
            }
        });

        // Polling loop
        function startPolling() {
            if (chatPollTimer) clearInterval(chatPollTimer);
            chatPollTimer = setInterval(async () => {
                if (isChatOpen && conversationId) {
                    const isAtBottom = messagesBox.scrollHeight - messagesBox.clientHeight <= messagesBox.scrollTop + 50;
                    await fetchMessages();
                    if (isAtBottom) messagesBox.scrollTop = messagesBox.scrollHeight;
                }
            }, 3500);
        }

        function stopPolling() {
            if (chatPollTimer) clearInterval(chatPollTimer);
        }

        // Background unread checker
        backgroundPollTimer = setInterval(async () => {
            if (isChatOpen || !conversationId) return;
            try {
                const res = await fetch(`/api/Chat/Messages/${conversationId}`);
                if (res.ok) {
                    const data = await res.json();
                    const messages = data.messages || [];
                    const unreadCount = messages.filter(m => m.senderType === 'Staff' && !m.isRead).length;
                    if (unreadCount > 0) {
                        unreadBadge.innerText = unreadCount > 9 ? '9+' : unreadCount;
                        unreadBadge.style.display = 'inline-block';
                    } else {
                        unreadBadge.style.display = 'none';
                    }
                }
            } catch {}
        }, 12000);
    });

    // Keyframe animations & Responsive Styles
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
        @keyframes chatSlideIn {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        #btnChatToggle:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 28px rgba(13, 148, 136, 0.45);
        }
        .star-item:hover {
            transform: scale(1.2);
        }
        @media (max-width: 640px) {
            #dutuyen-live-chat-wrap {
                right: 16px !important;
                bottom: 16px !important;
            }
            #chatWindow {
                position: fixed !important;
                bottom: 80px !important;
                right: 16px !important;
                left: 16px !important;
                width: auto !important;
                max-width: none !important;
                height: 72vh !important;
                border-radius: 18px !important;
            }
        }
    `;
    document.head.appendChild(styleEl);
})();
