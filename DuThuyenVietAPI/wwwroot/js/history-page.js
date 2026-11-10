// @ts-nocheck
/* ==========================================================================
   DuThuyenViet - Booking History Page Logic
   ========================================================================== */

const API_URL = '/api';
const getToken = () => {
    if (typeof window.getAuthStatus === 'function') {
        const auth = window.getAuthStatus();
        return auth.isLoggedIn ? auth.token : null;
    }
    return localStorage.getItem('auth_token');
};
const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
};
const checkAuth = () => {
    if (!getToken()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
};

// Variable lưu tạm mã đơn hàng đang chọn hủy
let selectedBookingCodeToCancel = null;

// 1. Hàm mở Modal hỏi lý do hủy
window.openCancelModal = function (bookingCode) {
    selectedBookingCodeToCancel = bookingCode;
    const displayEl = document.getElementById('cancelBookingCodeDisplay');
    if (displayEl) displayEl.innerText = bookingCode;

    const selectEl = document.getElementById('cancelReasonSelect');
    if (selectEl) selectEl.value = 'Thay đổi kế hoạch / Lịch trình cá nhân';

    const otherGroup = document.getElementById('otherReasonGroup');
    if (otherGroup) otherGroup.classList.add('d-none');

    const customText = document.getElementById('customReasonText');
    if (customText) customText.value = '';

    const modalEl = document.getElementById('cancelReasonModal');
    if (modalEl) {
        var modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
};

// 2. Hàm bấm Xác nhận hủy vé từ Modal
window.submitCancelBookingWithReason = async function () {
    if (!selectedBookingCodeToCancel) return;

    const grp = window.customerGroupedBookings ? window.customerGroupedBookings[selectedBookingCodeToCancel] : null;
    if (!grp || !grp.items || grp.items.length === 0) return;

    // Lấy lý do hủy từ form Modal
    const selectVal = document.getElementById('cancelReasonSelect')?.value;
    const customText = document.getElementById('customReasonText')?.value.trim();
    const finalReason = selectVal === 'Other' ? (customText || 'Lý do khác') : selectVal;

    // Ẩn Modal
    const modalEl = document.getElementById('cancelReasonModal');
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
    }

    try {
        let successCount = 0;
        for (const item of grp.items) {
            // Thử gửi qua Query String trước, nếu Backend không nhận thì fallback về PUT chuẩn
            let res = await fetch(`${API_URL}/Bookings/${item.bookingId}/Cancel?reason=${encodeURIComponent(finalReason)}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            if (!res.ok) {
                res = await fetch(`${API_URL}/Bookings/${item.bookingId}/Cancel`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${getToken()}`
                    }
                });
            }

            if (res.ok) successCount++;
        }

        if (successCount > 0) {
            window.Popup.show('Thành công', `Đã hủy đơn thành công!`, 'success');
            initHistoryPage(); // Reload lại danh sách
        } else {
            window.Popup.show('Lỗi', 'Không thể hủy đơn. Đơn hàng có thể đã được Admin xác nhận hoặc xử lý.', 'error');
        }
    } catch (e) {
        window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ', 'error');
    }
};

async function initHistoryPage() {
    if (!checkAuth()) return;

    const container = document.getElementById('historyList');

    try {
        const res = await fetch(`${API_URL}/Bookings/MyBookings`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!res.ok) throw new Error('Failed to load');

        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; max-width: 480px; margin: 0 auto;">
                    <div id="lottie-empty-trips" style="width: 280px; height: 153px; margin: 0 auto 16px; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 20px rgba(13,148,136,0.08);"></div>
                    <h3 style="font-family: 'Playfair Display', serif; font-size: 24px; margin-bottom: 8px; color: #0f172a;">Chưa Có Chuyến Đi Nào</h3>
                    <p style="color: #64748b; margin-bottom: 24px; font-size: 15px;">Bạn chưa có đặt phòng du thuyền nào trên hệ thống. Hãy bắt đầu chuyến hải trình tuyệt vời của bạn ngay hôm nay!</p>
                    <a href="/search.html" class="btn btn-primary" style="text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; background: #f0fdfa; border: 1.5px solid #2dd4bf; color: #0f766e; box-shadow: 0 2px 8px rgba(20,184,166,0.12);">
                        <img src="/images/icons/ship-front.png" class="app-icon" style="width: 18px; height: 18px; object-fit: contain;" alt=""> Khám Phá Du Thuyền
                    </a>
                </div>
            `;
            if (window.LottieEffects) {
                window.LottieEffects.play('lottie-empty-trips', 'empty-trips');
            }
            return;
        }

        // Group by bookingCode
        const grouped = {};
        data.forEach(b => {
            if (!grouped[b.bookingCode]) {
                grouped[b.bookingCode] = { ...b, items: [], totalPrice: 0 };
            }
            grouped[b.bookingCode].items.push(b);
            grouped[b.bookingCode].totalPrice += b.totalPrice;
        });
        window.customerGroupedBookings = grouped;

        window.copyToClipboard = function (text) {
            navigator.clipboard.writeText(text).then(() => {
                window.Popup.show('Đã sao chép', 'Mã thanh toán đã được lưu vào bộ nhớ tạm!', 'success');
            });
        };

        container.innerHTML = Object.values(grouped).map(b => {
            const isPending = b.status === 'Pending';
            const isAwaiting = b.status === 'AwaitingConfirmation';
            const isConfirmed = b.status === 'Confirmed';
            const isCancelled = b.status === 'Cancelled';

            // Điều kiện cho phép hủy vé: Chỉ khi chưa bị hủy và CHƯA được Admin xác nhận (Confirmed)
            const canCancel = (isPending || isAwaiting) && !isConfirmed && !isCancelled;

            const statusText = isPending ? 'Chờ thanh toán' : (isAwaiting ? 'Chờ đối soát' : (isConfirmed ? 'Thành công' : 'Đã hủy'));

            // Thu thập và ưu tiên phương thức thanh toán chuẩn xác nhất cho toàn bộ nhóm phòng
            const allPay = (b.items || []).reduce((acc, it) => acc.concat(it.payments || []), b.payments || [])
                .filter(p => p.status !== 'Superseded');

            // Sắp xếp: Giao dịch thành công trước, sau đó ưu tiên giao dịch mới nhất (paymentId giảm dần)
            allPay.sort((p1, p2) => {
                if (p1.status === 'Success' && p2.status !== 'Success') return -1;
                if (p2.status === 'Success' && p1.status !== 'Success') return 1;
                return (p2.paymentId || 0) - (p1.paymentId || 0);
            });

            let pMethodRaw = '';
            let pTxn = '';
            if (allPay.length > 0) {
                pMethodRaw = allPay[0].paymentMethod || '';
                pTxn = allPay[0].transactionCode || '';
            } else {
                pMethodRaw = sessionStorage.getItem('last_payment_method_' + b.bookingCode) || '';
            }

            let paymentInfo = '';
            if (pMethodRaw) {
                let pIcon = '/images/icons/credit-card.png';
                let pDisplay = pMethodRaw;
                if (pMethodRaw === 'VNPAY') {
                    pIcon = '/images/icons/vnpay.png';
                    pDisplay = 'Cổng VNPAY';
                } else if (pMethodRaw === 'VietQR' || pMethodRaw === 'BankTransfer') {
                    pIcon = '/images/icons/vietqr.png';
                    pDisplay = 'Chuyển khoản VietQR';
                } else if (pMethodRaw === 'PayPal') {
                    pIcon = '/images/icons/paypal.png';
                    pDisplay = 'PayPal Quốc tế';
                } else if (pMethodRaw === 'Cash') {
                    pIcon = '/images/icons/cash-vnd.png';
                    pDisplay = 'Tiền mặt tại quầy';
                }

                paymentInfo = `<p class="mt-2 text-muted" style="font-size: 0.9rem; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <strong>Thanh toán:</strong> 
                    <span style="font-weight:600; color:#0d9488; display: inline-flex; align-items: center; gap: 5px;">
                        <img src="${pIcon}" class="app-icon" alt="" style="width: 18px; height: 18px; object-fit: contain;"> ${pDisplay}
                    </span> 
                    ${pTxn ? `(Mã GD: ${pTxn})` : ''}
                </p>`;
            }

            const roomsSummary = b.items.map(i => `${i.cabinName} (x${i.numberOfRooms})`).join(', ');

            return `
                <div class="history-card" style="align-items: stretch;">
                    <div style="flex: 1;">
                        <h4 class="mb-1" style="color: var(--primary);">${b.cruiseName}</h4>
                        <p class="text-muted mb-2" style="font-size: 0.9rem;">
                            Mã đơn: <strong style="color:#0f172a; font-size:1.05rem;">${b.bookingCode}</strong> 
                            <button onclick="copyToClipboard('${b.bookingCode}')" style="background:none; border:none; cursor:pointer; padding:0 5px;" title="Sao chép"><img src="/images/icons/clipboard.png" class="app-icon" alt="📋"></button>
                            | Ngày tạo: ${new Date(b.createdAt).toLocaleString('vi-VN')}
                        </p>
                        
                        <div style="background: var(--bg-light); padding: 12px; border-radius: 8px; margin-top: 10px; font-size: 0.95rem;">
                            <p class="mb-1"><strong>Khách hàng:</strong> ${b.contactName} - ${b.contactPhone}</p>
                            <p class="mb-1"><strong>Phòng:</strong> ${roomsSummary}</p>
                            <p class="mb-1"><strong>Lịch trình:</strong> ${new Date(b.departureDate).toLocaleDateString('vi-VN')}${b.returnDate ? ` <img src="/images/icons/arrow-right.png" class="app-icon-sm" alt="➔"> ${new Date(b.returnDate).toLocaleDateString('vi-VN')}` : ''}</p>
                            ${b.note ? `<p class="mb-1" style="color: #4b5563; font-style: italic; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 4px;"><strong><img src="/images/icons/note-edit.png" class="app-icon" alt=""> Ghi chú:</strong> ${b.note}</p>` : ''}
                        </div>
                        
                        ${isPending ? `<div class="pending-countdown" data-created="${b.createdAt}" style="color: #b91c1c; font-size: 0.85rem; font-weight: 600; margin-top: 10px;"><img src="/images/icons/alarm-clock.png" class="app-icon" alt=""> Đang tính thời gian...</div>` : ''}
                        
                        ${paymentInfo}
                        
                        <p class="mt-3" style="font-size: 1.1rem;"><strong>Tổng tiền: <span class="text-danger">${formatPrice(b.totalPrice)}</span></strong></p>
                    </div>
                    <div class="text-right" style="text-align: right; min-width: 170px; margin-left: 20px; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between;">
                        <span class="status-badge status-${b.status}" style="display: inline-block;">${statusText}</span>
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 15px; align-items: flex-end;">
                            ${isPending ? `<a href="/checkout.html?bookingCode=${b.bookingCode}" class="btn-action-sm btn-act-pay"><img src="/images/icons/credit-card.png" class="app-icon" alt=""> Thanh toán</a>` : ''}
                            
                            ${canCancel ? `
                                <button onclick="openCancelModal('${b.bookingCode}')" class="btn-action-sm btn-act-cancel"><img src="/images/icons/cancel-booking.png" class="app-icon" alt=""> Hủy vé</button>
                            ` : ''}

                            ${isAwaiting ? `
                                <div style="text-align: right; margin-top: 4px;">
                                    <span style="background: #e0e7ff; color: #4338ca; border: 1.5px solid #c7d2fe; padding: 5px 12px; border-radius: 20px; font-size: 12.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                                        <img src="/images/icons/pending-hourglass.png" class="app-icon-sm" alt=""> Chờ đối soát
                                    </span>
                                    <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic;">Vé sẽ sẵn sàng sau khi Admin duyệt</div>
                                </div>
                            ` : ''}

                            ${isConfirmed ? `
                                <button onclick="openTicketModal('${b.bookingCode}')" class="btn-action-sm btn-act-ticket"><img src="/images/icons/ticket.png" class="app-icon" alt=""> Xem vé</button>
                                <button onclick="openReviewModalForCruise(${b.cruiseId}, '${(b.cruiseName||'Du thuyền').replace(/'/g, "\\'")}', '${b.bookingCode}')" class="btn-action-sm btn-act-review"><img src="/images/icons/rating-star.png" class="app-icon" alt=""> Đánh giá tour</button>
                                <span class="text-success small" style="font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;"><img src="/images/icons/check.png" class="app-icon-sm" alt="✓"> Đã xác nhận</span>
                            ` : ''}

                            ${isCancelled ? `
                                <span class="text-muted small" style="font-style: italic;">Đơn đã hủy</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Start active countdown timer ticking
        startPendingCountdowns();

    } catch (error) {
        container.innerHTML = '<p class="text-danger">Có lỗi xảy ra khi tải lịch sử.</p>';
    }
}

function startPendingCountdowns() {
    if (window.pendingCountdownInterval) clearInterval(window.pendingCountdownInterval);

    function tick() {
        document.querySelectorAll('.pending-countdown').forEach(el => {
            const createdStr = el.getAttribute('data-created');
            const createdTime = new Date(createdStr).getTime();
            const limitTime = createdTime + 30 * 60 * 1000;
            const now = new Date().getTime();
            const diff = limitTime - now;
            if (diff <= 0) {
                el.innerHTML = '<img src="/images/icons/warning.png" class="app-icon" alt=""> Hết hạn thanh toán';
                el.style.color = '#ef4444';
                const parentCard = el.closest('.history-card');
                if (parentCard) {
                    const payBtn = parentCard.querySelector('a[href*="checkout.html"]');
                    if (payBtn) {
                        payBtn.style.pointerEvents = 'none';
                        payBtn.style.opacity = '0.5';
                        payBtn.innerText = 'Đã hết hạn';
                    }
                }
            } else {
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                el.innerHTML = `<img src="/images/icons/alarm-clock.png" class="app-icon" alt=""> Hạn thanh toán còn: <span style="font-family:monospace;font-weight:700;">${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}</span>`;
            }
        });
    }
    tick();
    window.pendingCountdownInterval = setInterval(tick, 1000);

    // Tự động mở Modal Vé điện tử CHỈ KHI đơn đã được xác nhận (Confirmed)
    if (window.autoOpenTicketCode && window.customerGroupedBookings && window.customerGroupedBookings[window.autoOpenTicketCode]) {
        const targetBooking = window.customerGroupedBookings[window.autoOpenTicketCode];
        if (targetBooking.status === 'Confirmed') {
            setTimeout(() => {
                window.openTicketModal(window.autoOpenTicketCode);
                window.autoOpenTicketCode = null;
            }, 800);
        } else {
            window.autoOpenTicketCode = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Xử lý thông báo thanh toán trả về từ VNPAY hoặc PayPal hoặc VietQR/Tiền mặt
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const paymentCode = urlParams.get('code');
    if (paymentStatus === 'success') {
        window.autoOpenTicketCode = paymentCode;
        window.Popup.show('Thành công', `Thanh toán thành công cho đơn đặt vé ${paymentCode || ''}!`, 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'awaiting') {
        window.Popup.show('Đang chờ đối soát', `Đơn đặt vé ${paymentCode || ''} đã được tiếp nhận! Quản trị viên đang đối soát thanh toán và sẽ cấp Vé điện tử ngay sau khi duyệt.`, 'info');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
        window.Popup.show('Đã hủy giao dịch VNPAY', `Bạn đã hủy giao dịch trên cổng VNPAY cho đơn đặt vé ${paymentCode || ''}. Đơn vé vẫn được giữ ở trạng thái Chờ thanh toán để bạn có thể thử lại bất kỳ lúc nào.`, 'info');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'failed') {
        const vnpCode = urlParams.get('vnp_code') || '';
        window.Popup.show('Thanh toán chưa hoàn tất', `Giao dịch chưa hoàn tất hoặc khách hàng đã hủy (Mã phản hồi: ${vnpCode}).`, 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'error') {
        const msg = urlParams.get('message') || 'Có lỗi xảy ra khi xử lý kết quả thanh toán.';
        window.Popup.show('Lỗi thanh toán', msg, 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    initHistoryPage();
});
// TICKET FUNCTIONS
window.openTicketModal = function(bookingCode) {
    if (!window.customerGroupedBookings) return;
    const booking = window.customerGroupedBookings[bookingCode];
    if (!booking) return;

    if (booking.status !== 'Confirmed') {
        window.Popup.show('Chưa thể xuất vé', 'Đơn đặt phòng đang chờ Admin đối soát thanh toán. Vé điện tử sẽ sẵn sàng tải về ngay sau khi quản trị viên duyệt đơn!', 'info');
        return;
    }

    window.currentTicketCode = bookingCode;

    const container = document.getElementById('ticketContainer');
    if (!container) return;

    const b = booking.items[0]; // Thông tin chung
    const roomsSummary = booking.items.map(i => `${i.cabinName} (x${i.numberOfRooms})`).join(', ');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(b.bookingCode)}`;

    container.innerHTML = `
        <div class="ticket-main">
            <div class="ticket-stamp">CONFIRMED</div>
            <div class="ticket-header">
                <img src="/images/icons/ship-front.png" class="app-icon-xl" style="margin-right: 15px;" alt="🚢">
                <h2>Du Thuyền Việt</h2>
            </div>
            
            <div class="ticket-info-grid">
                <div>
                    <div class="ticket-label">Tên hành khách</div>
                    <div class="ticket-value">${b.contactName}</div>
                </div>
                <div>
                    <div class="ticket-label">Số điện thoại</div>
                    <div class="ticket-value">${b.contactPhone}</div>
                </div>
                <div style="grid-column: 1 / -1;">
                    <div class="ticket-label">Du thuyền</div>
                    <div class="ticket-value" style="color: #0d9488; font-size: 1.2rem;">${b.cruiseName}</div>
                </div>
                <div style="grid-column: 1 / -1;">
                    <div class="ticket-label">Hạng phòng</div>
                    <div class="ticket-value">${roomsSummary}</div>
                </div>
                <div>
                    <div class="ticket-label">Ngày khởi hành</div>
                    <div class="ticket-value">${new Date(b.departureDate).toLocaleDateString('vi-VN')}</div>
                </div>
                <div>
                    <div class="ticket-label">Ngày về</div>
                    <div class="ticket-value">${new Date(b.returnDate).toLocaleDateString('vi-VN')}</div>
                </div>
            </div>
        </div>
        
        <div class="ticket-stub">
            <div class="ticket-label" style="color: #94a3b8; margin-bottom: 5px;">Scan để Check-in</div>
            <img src="${qrUrl}" alt="QR Code" class="qr-code-img">
            
            <div class="ticket-label" style="color: #94a3b8; margin-top: 10px;">Booking Code</div>
            <div class="ticket-stub-code">${b.bookingCode}</div>
            
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 15px; font-style: italic;">
                Chúc quý khách<br>chuyến đi vui vẻ!
            </div>
        </div>
    `;

    const ticketModal = new bootstrap.Modal(document.getElementById('ticketModal'));
    ticketModal.show();
};

window.printTicket = function() {
    const code = window.currentTicketCode;
    if (!code) return;

    const container = document.getElementById('ticketContainer');
    if (!container) { alert('Không tìm thấy thông tin vé.'); return; }

    if (typeof html2canvas === 'undefined') {
        alert('Thư viện tải ảnh chưa sẵn sàng. Vui lòng tải lại trang.');
        return;
    }

    html2canvas(container, { scale: 2, useCORS: true, backgroundColor: null, logging: false })
        .then(canvas => {
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const a = document.createElement('a');
            a.href = imgData;
            a.download = `Ve_${code}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        })
        .catch(err => {
            console.error('Lỗi tải vé:', err);
            alert('Lỗi tải vé: ' + err.message);
        });
};

// ==========================================
// REVIEW MODAL FUNCTIONS (ĐÁNH GIÁ DU THUYỀN)
// ==========================================
let currentHistoryRatingValue = 5;

window.setStarRating = function(stars) {
    currentHistoryRatingValue = stars;
    const starLabels = {
        1: '1 sao - Kém',
        2: '2 sao - Tạm được',
        3: '3 sao - Bình thường',
        4: '4 sao - Tốt & Hài lòng',
        5: '5 sao - Tuyệt vời & Đáng nhớ'
    };
    const labelEl = document.getElementById('starRatingText');
    if (labelEl) labelEl.innerText = starLabels[stars] || `${stars} sao`;
    document.querySelectorAll('#starRatingSelect span').forEach(el => {
        const s = parseInt(el.getAttribute('data-star'));
        el.style.color = s <= stars ? '#fbbf24' : '#cbd5e1';
    });
};

window.openReviewModalForCruise = function(cruiseId, cruiseName, bookingCode) {
    const booking = window.customerGroupedBookings ? window.customerGroupedBookings[bookingCode] : null;
    const bId = (booking && booking.items && booking.items.length > 0) ? booking.items[0].bookingId : null;

    const idEl = document.getElementById('reviewCruiseId');
    const bIdEl = document.getElementById('reviewBookingId');
    const nameEl = document.getElementById('reviewCruiseNameDisplay');
    const textEl = document.getElementById('reviewCommentText');

    if (idEl) idEl.value = cruiseId;
    if (bIdEl) bIdEl.value = bId || '';
    if (nameEl) nameEl.innerHTML = '<img src="/images/icons/rating-star.png" class="app-icon" alt=""> Đánh giá: ' + cruiseName;
    if (textEl) textEl.value = '';

    window.setStarRating(5);

    const modalEl = document.getElementById('reviewModal');
    if (modalEl) {
        const m = new bootstrap.Modal(modalEl);
        m.show();
    }
};

window.submitCruiseReview = async function() {
    const cruiseId = parseInt(document.getElementById('reviewCruiseId')?.value);
    const bookingIdVal = document.getElementById('reviewBookingId')?.value;
    const bookingId = bookingIdVal ? parseInt(bookingIdVal) : null;
    const comment = document.getElementById('reviewCommentText')?.value.trim();

    if (!comment) {
        window.Popup.show('Lỗi', 'Vui lòng nhập nội dung nhận xét của bạn.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/Reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                cruiseId: cruiseId,
                bookingId: bookingId,
                rating: currentHistoryRatingValue,
                comment: comment
            })
        });

        if (res.ok) {
            const modalEl = document.getElementById('reviewModal');
            if (modalEl) {
                const m = bootstrap.Modal.getInstance(modalEl);
                if (m) m.hide();
            }
            window.Popup.show('Thành công', 'Cảm ơn bạn đã gửi đánh giá cho chuyến du thuyền!', 'success');
        } else {
            const err = await res.text();
            window.Popup.show('Thông báo', err || 'Không thể gửi đánh giá.', 'info');
        }
    } catch (e) {
        window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ khi gửi đánh giá.', 'error');
    }
};

// Gắn click cho các ngôi sao đánh giá
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#starRatingSelect span').forEach(el => {
        el.addEventListener('click', (e) => {
            const s = parseInt(e.target.getAttribute('data-star'));
            if (!isNaN(s)) window.setStarRating(s);
        });
    });
});

