/* ==========================================================================
   DuThuyenViet - Booking History Page Logic
   ========================================================================== */

const API_URL = '/api';
const getToken = () => localStorage.getItem('auth_token');
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
            container.innerHTML = '<p>Bạn chưa có lịch sử đặt vé nào.</p>';
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

            const statusText = isPending ? 'Chờ thanh toán' : (isAwaiting ? 'Đang xử lý' : (isConfirmed ? 'Thành công' : 'Đã hủy'));

            let paymentInfo = '';
            if (b.payments && b.payments.length > 0) {
                const p = b.payments[0];
                const pMethod = p.paymentMethod === 'BankTransfer' ? 'Chuyển khoản NH' : (p.paymentMethod === 'Cash' ? 'Tiền mặt' : p.paymentMethod);
                paymentInfo = `<p class="mt-2 text-muted" style="font-size: 0.9rem;">
                    <strong>Thanh toán:</strong> ${pMethod} 
                    ${p.transactionCode ? `(Mã: ${p.transactionCode})` : ''}
                </p>`;
            }

            const roomsSummary = b.items.map(i => `${i.cabinName} (x${i.numberOfRooms})`).join(', ');

            return `
                <div class="history-card" style="align-items: stretch;">
                    <div style="flex: 1;">
                        <h4 class="mb-1" style="color: var(--primary);">${b.cruiseName}</h4>
                        <p class="text-muted mb-2" style="font-size: 0.9rem;">
                            Mã đơn: <strong style="color:#0f172a; font-size:1.05rem;">${b.bookingCode}</strong> 
                            <button onclick="copyToClipboard('${b.bookingCode}')" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:0 5px;" title="Sao chép">📋</button>
                            | Ngày tạo: ${new Date(b.createdAt).toLocaleString('vi-VN')}
                        </p>
                        
                        <div style="background: var(--bg-light); padding: 12px; border-radius: 8px; margin-top: 10px; font-size: 0.95rem;">
                            <p class="mb-1"><strong>Khách hàng:</strong> ${b.contactName} - ${b.contactPhone}</p>
                            <p class="mb-1"><strong>Phòng:</strong> ${roomsSummary}</p>
                            <p class="mb-1"><strong>Lịch trình:</strong> ${new Date(b.departureDate).toLocaleDateString('vi-VN')}${b.returnDate ? ` ➔ ${new Date(b.returnDate).toLocaleDateString('vi-VN')}` : ''}</p>
                            ${b.note ? `<p class="mb-1" style="color: #4b5563; font-style: italic; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 4px;"><strong>📝 Ghi chú:</strong> ${b.note}</p>` : ''}
                        </div>
                        
                        ${isPending ? `<div class="pending-countdown" data-created="${b.createdAt}" style="color: #b91c1c; font-size: 0.85rem; font-weight: 600; margin-top: 10px;">⏰ Đang tính thời gian...</div>` : ''}
                        
                        ${paymentInfo}
                        
                        <p class="mt-3" style="font-size: 1.1rem;"><strong>Tổng tiền: <span class="text-danger">${formatPrice(b.totalPrice)}</span></strong></p>
                    </div>
                    <div class="text-right" style="text-align: right; min-width: 150px; margin-left: 20px; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between;">
                        <span class="status-badge status-${b.status}" style="display: inline-block;">${statusText}</span>
                        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px; align-items: flex-end;">
                            ${isPending ? `<a href="/checkout.html?bookingCode=${b.bookingCode}" class="btn-primary text-center" style="padding: 6px 15px; font-size: 13px; min-width: 120px; border-radius: 6px; text-decoration: none;">Thanh toán</a>` : ''}
                            
                            ${canCancel ? `
                                <button onclick="openCancelModal('${b.bookingCode}')" class="btn-secondary" style="padding: 6px 15px; font-size: 13px; min-width: 120px; border-radius: 6px; border: 1px solid #dc2626; color: #dc2626; background: transparent;">🚫 Hủy vé</button>
                            ` : (isConfirmed ? `
                                <button onclick="openTicketModal('${b.bookingCode}')" class="btn-primary" style="padding: 6px 15px; font-size: 13px; min-width: 120px; border-radius: 6px; background: #0f172a; border: none; color: white;">🎫 Xem vé</button>
                                <span class="text-success small" style="font-weight: 500; display: block; text-align: center; margin-top: 5px;">✓ Đã xác nhận</span>
                            ` : `
                                <span class="text-muted small">Đơn đã hủy</span>
                            `)}
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
                el.innerHTML = '⚠️ Hết hạn thanh toán';
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
                el.innerHTML = `⏰ Hạn thanh toán còn: <span style="font-family:monospace;font-weight:700;">${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}</span>`;
            }
        });
    }
    tick();
    window.pendingCountdownInterval = setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    initHistoryPage();
});
// TICKET FUNCTIONS
window.openTicketModal = function(bookingCode) {
    if (!window.customerGroupedBookings) return;
    const booking = window.customerGroupedBookings[bookingCode];
    if (!booking) return;

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
                <span style="font-size: 2rem; margin-right: 15px;">🚢</span>
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
