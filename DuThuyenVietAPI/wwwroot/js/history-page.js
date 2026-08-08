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

window.cancelBooking = function(bookingCode) {
    const grp = window.customerGroupedBookings[bookingCode];
    if (!grp || !grp.items || grp.items.length === 0) return;

    window.Popup.confirm('Xác nhận hủy', 'Bạn có chắc chắn muốn hủy toàn bộ đơn đặt vé này không?', async () => {
        try {
            let successCount = 0;
            for (const item of grp.items) {
                const res = await fetch(`${API_URL}/Bookings/${item.bookingId}/Cancel`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                if (res.ok) successCount++;
            }
            if (successCount > 0) {
                window.Popup.show('Thành công', 'Hủy đơn thành công', 'success');
                initHistoryPage();
            } else {
                window.Popup.show('Lỗi', 'Không thể hủy đơn', 'error');
            }
        } catch (e) {
            window.Popup.show('Lỗi', 'Lỗi kết nối', 'error');
        }
    }, true, 'Đồng ý hủy');
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

        window.copyToClipboard = function(text) {
            navigator.clipboard.writeText(text).then(() => {
                window.Popup.show('Đã sao chép', 'Mã thanh toán đã được lưu vào bộ nhớ tạm!', 'success');
            });
        };

        container.innerHTML = Object.values(grouped).map(b => {
            const isPending = b.status === 'Pending';
            const statusText = isPending ? 'Chờ thanh toán' : (b.status === 'AwaitingConfirmation' ? 'Đang xử lý' : (b.status === 'Confirmed' ? 'Thành công' : 'Đã hủy'));
            
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
                            <p class="mb-1"><strong>Lịch đi:</strong> ${new Date(b.departureDate).toLocaleDateString('vi-VN')}</p>
                            ${b.note ? `<p class="mb-1" style="color: #4b5563; font-style: italic; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 4px;"><strong>📝 Ghi chú:</strong> ${b.note}</p>` : ''}
                        </div>
                        
                        ${isPending ? `<div class="pending-countdown" data-created="${b.createdAt}" style="color: #b91c1c; font-size: 0.85rem; font-weight: 600; margin-top: 10px;">⏰ Đang tính thời gian...</div>` : ''}
                        
                        ${paymentInfo}
                        
                        <p class="mt-3" style="font-size: 1.1rem;"><strong>Tổng tiền: <span class="text-danger">${formatPrice(b.totalPrice)}</span></strong></p>
                    </div>
                    <div class="text-right" style="text-align: right; min-width: 150px; margin-left: 20px; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between;">
                        <span class="status-badge status-${b.status}" style="display: inline-block;">${statusText}</span>
                        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
                            ${isPending ? `<a href="/checkout.html?bookingCode=${b.bookingCode}" class="btn-primary text-center" style="padding: 6px 15px; font-size: 13px; min-width: 120px; border-radius: 6px; text-decoration: none;">Thanh toán</a>` : ''}
                            ${isPending ? `<button onclick="cancelBooking('${b.bookingCode}')" class="btn-secondary" style="padding: 6px 15px; font-size: 13px; min-width: 120px; border-radius: 6px;">Hủy vé</button>` : ''}
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
    // Clear any existing intervals
    if (window.pendingCountdownInterval) clearInterval(window.pendingCountdownInterval);
    
    function tick() {
        document.querySelectorAll('.pending-countdown').forEach(el => {
            const createdStr = el.getAttribute('data-created');
            const createdTime = new Date(createdStr).getTime();
            const limitTime = createdTime + 30 * 60 * 1000; // 30 mins
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
