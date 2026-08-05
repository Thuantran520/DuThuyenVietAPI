const API_URL = '/api';

const getToken = () => localStorage.getItem('token');

const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
};

// Check auth on load
const checkAuth = () => {
    if (!getToken()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
};

// ================= BOOKING PAGE ================= //
async function initBookingPage() {
    if (!checkAuth()) return;

    const urlParams = new URLSearchParams(window.location.search);
    const scheduleId = urlParams.get('scheduleId');
    const cabinTypeId = urlParams.get('cabinTypeId');
    const cruiseId = urlParams.get('cruiseId');

    if (!scheduleId || !cabinTypeId) {
        window.Popup.show('Lỗi', 'Thông tin không hợp lệ.', 'error');
        return;
    }

    // Load summary
    try {
        const response = await fetch(`${API_URL}/Cruises/${cruiseId}`);
        const cruise = await response.json();
        
        const schedule = cruise.schedules.find(s => s.scheduleId == scheduleId);
        const cabin = cruise.cabins.find(c => c.cabinTypeId == cabinTypeId);

        if (!schedule || !cabin) throw new Error('Data mismatch');

        const updateSummary = () => {
            const rooms = parseInt(document.getElementById('b_rooms').value) || 1;
            const total = cabin.basePrice * rooms;
            const summaryHtml = `
                <h4 class="mb-2">${cruise.name}</h4>
                <p><strong>Loại phòng:</strong> ${cabin.name}</p>
                <p><strong>Khởi hành:</strong> ${new Date(schedule.departureDate).toLocaleDateString('vi-VN')}</p>
                <p><strong>Thời gian:</strong> ${schedule.durationLabel}</p>
                <hr class="my-3">
                <p><strong>Đơn giá:</strong> <span class="text-danger">${formatPrice(cabin.basePrice)}</span> / phòng</p>
                <p><strong>Số lượng phòng:</strong> ${rooms}</p>
                <h4 class="mt-3">Tổng cộng: <span class="text-danger">${formatPrice(total)}</span></h4>
            `;
            document.getElementById('bookingSummary').innerHTML = summaryHtml;
        };

        updateSummary();
        document.getElementById('b_rooms').addEventListener('input', updateSummary);
    } catch (e) {
        document.getElementById('bookingSummary').innerHTML = '<p class="text-danger">Không thể tải thông tin chuyến đi.</p>';
    }

    // Handle submit
    document.getElementById('bookingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            scheduleId: parseInt(scheduleId),
            cabinTypeId: parseInt(cabinTypeId),
            numberOfRooms: parseInt(document.getElementById('b_rooms').value),
            numberOfGuests: parseInt(document.getElementById('b_guests').value),
            contactName: document.getElementById('b_name').value,
            contactPhone: document.getElementById('b_phone').value,
            contactEmail: document.getElementById('b_email').value,
            note: document.getElementById('b_note').value
        };

        try {
            const res = await fetch(`${API_URL}/Bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            if (res.ok) {
                window.location.href = `/checkout.html?bookingId=${data.bookingId}`;
            } else {
                window.Popup.show('Lỗi', data.message || 'Lỗi đặt phòng', 'error');
            }
        } catch (error) {
            window.Popup.show('Lỗi', 'Không thể kết nối máy chủ.', 'error');
        }
    });
}

// ================= CHECKOUT PAGE ================= //
async function initCheckoutPage() {
    if (!checkAuth()) return;

    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('bookingId');
    if (!bookingId) {
        window.location.href = '/history.html';
        return;
    }

    let selectedMethod = 'BankTransfer';

    // Payment method selection
    document.querySelectorAll('.payment-method').forEach(el => {
        el.addEventListener('click', (e) => {
            document.querySelectorAll('.payment-method').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            selectedMethod = e.target.getAttribute('data-method');
        });
    });

    // Load booking detail
    try {
        const res = await fetch(`${API_URL}/Bookings/${bookingId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (!res.ok) {
            window.location.href = '/history.html';
            return;
        }

        const booking = await res.json();
        
        if (booking.status !== 'Pending') {
            window.Popup.show('Thông báo', 'Đơn hàng này không ở trạng thái chờ thanh toán.', 'info');
            setTimeout(() => window.location.href = '/history.html', 2000);
            return;
        }

        document.getElementById('checkoutBookingCode').innerText = `Mã đơn: ${booking.bookingCode}`;
        document.getElementById('checkoutTotal').innerText = formatPrice(booking.totalPrice);
        
        document.getElementById('checkoutDetails').innerHTML = `
            <p><strong>Du thuyền:</strong> ${booking.cruiseName}</p>
            <p><strong>Loại phòng:</strong> ${booking.cabinName} (x${booking.numberOfRooms})</p>
            <p><strong>Ngày đi:</strong> ${new Date(booking.departureDate).toLocaleDateString('vi-VN')}</p>
            <p><strong>Khách hàng:</strong> ${booking.contactName} - ${booking.contactPhone}</p>
        `;

        document.getElementById('btnPay').addEventListener('click', async () => {
            const btn = document.getElementById('btnPay');
            btn.disabled = true;
            btn.innerText = 'Đang xử lý...';

            try {
                const payRes = await fetch(`${API_URL}/Payments/Process`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getToken()}`
                    },
                    body: JSON.stringify({ bookingId: parseInt(bookingId), paymentMethod: selectedMethod })
                });

                const payData = await payRes.json();
                if (payRes.ok) {
                    window.Popup.show('Thành công', 'Thanh toán thành công! Mã GD: ' + payData.transactionCode, 'success');
                    setTimeout(() => window.location.href = '/history.html', 3000);
                } else {
                    window.Popup.show('Lỗi', payData.message || 'Thanh toán thất bại', 'error');
                    btn.disabled = false;
                    btn.innerText = 'Thanh Toán Ngay';
                }
            } catch (error) {
                window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ', 'error');
                btn.disabled = false;
                btn.innerText = 'Thanh Toán Ngay';
            }
        });

    } catch (error) {
        console.error(error);
    }
}

// ================= HISTORY PAGE ================= //
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

        container.innerHTML = data.map(b => {
            const isPending = b.status === 'Pending';
            const statusText = isPending ? 'Chờ thanh toán' : (b.status === 'Confirmed' ? 'Thành công' : 'Đã hủy');
            
            return `
                <div class="history-card">
                    <div>
                        <h4 class="mb-1">${b.cruiseName}</h4>
                        <p class="text-muted mb-2">Mã đơn: ${b.bookingCode} | Đặt ngày: ${new Date(b.createdAt).toLocaleDateString('vi-VN')}</p>
                        <p><strong>Loại phòng:</strong> ${b.cabinName} (x${b.numberOfRooms})</p>
                        <p><strong>Khởi hành:</strong> ${new Date(b.departureDate).toLocaleDateString('vi-VN')}</p>
                        <p class="mt-2"><strong>Tổng tiền: <span class="text-danger">${formatPrice(b.totalPrice)}</span></strong></p>
                    </div>
                    <div class="text-right" style="text-align: right;">
                        <span class="status-badge status-${b.status} mb-3" style="display: inline-block;">${statusText}</span>
                        ${isPending ? `<br><a href="/checkout.html?bookingId=${b.bookingId}" class="btn-primary mt-2" style="padding: 8px 15px; font-size: 14px;">Thanh toán ngay</a>` : ''}
                        ${isPending ? `<button onclick="cancelBooking(${b.bookingId})" class="btn-secondary mt-2" style="padding: 8px 15px; font-size: 14px; margin-left: 10px;">Hủy vé</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        container.innerHTML = '<p class="text-danger">Có lỗi xảy ra khi tải lịch sử.</p>';
    }
}

window.cancelBooking = function(id) {
    window.Popup.confirm('Xác nhận hủy', 'Bạn có chắc chắn muốn hủy đơn đặt vé này không?', async () => {
        try {
            const res = await fetch(`${API_URL}/Bookings/${id}/Cancel`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                window.Popup.show('Thành công', 'Hủy vé thành công', 'success');
                initHistoryPage();
            } else {
                const data = await res.json();
                window.Popup.show('Lỗi', data.message || 'Không thể hủy vé', 'error');
            }
        } catch (e) {
            window.Popup.show('Lỗi', 'Lỗi kết nối', 'error');
        }
    });
};
