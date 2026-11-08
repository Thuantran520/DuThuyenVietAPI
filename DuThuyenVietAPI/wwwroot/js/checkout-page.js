/* ==========================================================================
   DuThuyenViet - Checkout Page Logic
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

window.generateSlug = window.generateSlug || function(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
};

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!checkAuth()) return;

    // Checkout page logic
    const urlParams = new URLSearchParams(window.location.search);
    const bookingCode = urlParams.get('bookingCode');
    if (!bookingCode) {
        window.location.href = '/history.html';
        return;
    }

    let selectedMethod = 'VNPAY';
    let firstBookingId = null;

    document.querySelectorAll('.payment-method').forEach(el => {
        el.addEventListener('click', (e) => {
            document.querySelectorAll('.payment-method').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            selectedMethod = e.target.getAttribute('data-method');
        });
    });

    try {
        const res = await fetch(`${API_URL}/Bookings/MyBookings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            window.location.href = '/history.html';
            return;
        }

        const allBookings = await res.json();
        const groupItems = allBookings.filter(b => b.bookingCode === bookingCode);
        
        if (groupItems.length === 0) {
            window.location.href = '/history.html';
            return;
        }

        const firstBooking = groupItems[0];
        firstBookingId = firstBooking.bookingId;

        if (firstBooking.status !== 'Pending') {
            window.Popup.show('Thông báo', 'Đơn hàng này không ở trạng thái chờ thanh toán.', 'info');
            setTimeout(() => window.location.href = '/history.html', 2000);
            return;
        }

        const totalGroupPrice = groupItems.reduce((sum, b) => sum + b.totalPrice, 0);

        document.getElementById('checkoutBookingCode').innerText = `Mã đơn: ${bookingCode}`;
        document.getElementById('checkoutTotal').innerText = formatPrice(totalGroupPrice);
        
        const roomsDetail = groupItems.map(b => `${b.cabinName} (x${b.numberOfRooms})`).join(', ');

        // Build detailed room breakdown
        let roomDetailsHtml = groupItems.map(b => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <div>
                    <span style="font-weight:600;">🛏️ ${b.cabinName}</span>
                    <span style="color:#64748b; font-size:0.9rem; margin-left:8px;">x${b.numberOfRooms} phòng</span>
                </div>
                <span style="font-weight:600; color:#0d9488;">${formatPrice(b.totalPrice)}</span>
            </div>
        `).join('');

        const noteHtml = firstBooking.note ? `<p class="mb-2"><strong>📝 Ghi chú:</strong> <span style="font-style: italic; color: #475569;">${firstBooking.note}</span></p>` : '';

        document.getElementById('checkoutDetails').innerHTML = `
            <p class="mb-2"><strong>🚢 Du thuyền:</strong> ${firstBooking.cruiseName}</p>
            <p class="mb-2"><strong>Ngày đi:</strong> ${new Date(firstBooking.departureDate).toLocaleDateString('vi-VN')}</p>
            <p class="mb-2"><strong>Khách hàng:</strong> ${firstBooking.contactName} — ${firstBooking.contactPhone}</p>
            ${noteHtml}
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-top:8px;">
                <div style="font-weight:700; margin-bottom:10px; color:#0f172a;">Chi tiết phòng đã đặt (${groupItems.length} loại):</div>
                ${roomDetailsHtml}
                <div style="display:flex; justify-content:space-between; padding-top:10px; margin-top:4px; font-size:1.05rem; font-weight:700;">
                    <span>Tổng cộng:</span>
                    <span style="color:#ef4444;">${formatPrice(totalGroupPrice)}</span>
                </div>
            </div>
        `;
        // Update breadcrumbs dynamically if elements exist
        const bcCruiseLink = document.getElementById('bc-cruise-link');
        const bcCruiseActive = document.getElementById('bc-cruise-active');
        if (bcCruiseLink && bcCruiseActive) {
            if (firstBooking.cruiseId) {
                bcCruiseLink.href = `/du-thuyen/${firstBooking.cruiseId}-${window.generateSlug(firstBooking.cruiseName)}`;
            } else {
                bcCruiseLink.removeAttribute('href');
            }
            bcCruiseLink.innerText = firstBooking.cruiseName || 'Chi tiết du thuyền';
            bcCruiseActive.innerText = 'Thanh toán';
        }

        // Payment Countdown Timer (30 minutes limit from CreatedAt)
        const limitTime = new Date(new Date(firstBooking.createdAt).getTime() + 30 * 60 * 1000);
        const timerEl = document.getElementById('countdownTimer');
        if (timerEl) {
            timerEl.style.display = 'flex';
            function updateTimer() {
                const now = new Date();
                const diff = limitTime - now;
                if (diff <= 0) {
                    timerEl.innerHTML = '⚠️ Đơn đặt phòng đã quá hạn thanh toán 30 phút. Vui lòng đặt lại.';
                    document.getElementById('btnPay').disabled = true;
                    document.getElementById('btnPay').innerText = 'Đơn đặt phòng đã hết hạn';
                    return;
                }
                const mins = Math.floor(diff / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                timerEl.innerHTML = `⏰ Hạn thanh toán còn lại: <span style="font-size: 1.15rem; font-family: monospace; font-weight: 700; color: #ef4444; margin-left: 5px; margin-right: 5px;">${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}</span> (Quá thời gian, chỗ của bạn sẽ tự động giải phóng)`;
            }
            updateTimer();
            const timerInterval = setInterval(() => {
                updateTimer();
                const diff = limitTime - new Date();
                if (diff <= 0) clearInterval(timerInterval);
            }, 1000);
        }

        const updateInstructions = () => {
            const instructions = document.getElementById('paymentInstructions');
            instructions.style.display = 'block';
            const btn = document.getElementById('btnPay');
            const bCode = bookingCode;
            const bTotal = formatPrice(totalGroupPrice);
            
            if (selectedMethod === 'VNPAY') {
                instructions.innerHTML = `
                    <h4 style="color: #005baa; margin-bottom: 12px; font-weight: 700;">💳 Cổng thanh toán VNPAY Sandbox</h4>
                    <p class="mb-2">Bạn sẽ được chuyển hướng sang cổng thanh toán bảo mật của <strong>VNPAY</strong> để quét mã QR hoặc nhập thẻ ATM ngân hàng.</p>
                    <div style="background:#f1f5f9; padding:12px; border-radius:8px; font-size:13px; line-height:1.6; margin-bottom:12px; border-left:4px solid #005baa;">
                        <strong>Thông tin thẻ TEST Sandbox để nộp đồ án:</strong><br/>
                        • Ngân hàng: <b>NCB</b><br/>
                        • Số thẻ: <b>9704198526191432198</b><br/>
                        • Tên chủ thẻ: <b>NGUYEN VAN A</b><br/>
                        • Ngày phát hành: <b>07/15</b><br/>
                        • Mật khẩu OTP: <b>123456</b>
                    </div>
                    <p style="font-size:12px; color:#64748b; font-style:italic;">Hệ thống VNPAY Sandbox tự động xử lý và xác nhận kết quả thanh toán ngay lập tức.</p>
                `;
                btn.innerText = 'Chuyển sang Cổng VNPAY ➔';
            } else if (selectedMethod === 'PayPal') {
                instructions.innerHTML = `
                    <h4 style="color: #003087; margin-bottom: 12px; font-weight: 700;">🌍 Cổng thanh toán Quốc tế PayPal Sandbox</h4>
                    <p class="mb-2">Thanh toán an toàn dành cho khách du lịch quốc tế bằng thẻ <strong>Visa / MasterCard</strong> hoặc tài khoản <strong>PayPal</strong>.</p>
                    <p style="font-size:13px; color:#0d9488; font-weight:600;">Đơn hàng tự động quy đổi tỷ giá USD khi thanh toán.</p>
                `;
                btn.innerText = 'Thanh toán qua PayPal ➔';
            } else if (selectedMethod === 'BankTransfer') {
                // Generate real dynamic VietQR code
                const bankId = 'Techcombank';
                const accountNo = '17118899999';
                const accountName = encodeURIComponent('Demo DuThuyenViet');
                const amount = totalGroupPrice;
                const description = encodeURIComponent(bCode);
                const vietQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${amount}&addInfo=${description}&accountName=${accountName}`;

                instructions.innerHTML = `
                    <h4 style="color: var(--primary); margin-bottom: 15px; font-weight: 600;">Thông tin chuyển khoản qua mã ngân hàng VietQR</h4>
                    <div style="display: flex; gap: 20px; align-items: center; justify-content: center; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 200px;">
                            <p class="mb-2"><strong>Ngân hàng:</strong> Techcombank (VCB)</p>
                            <p class="mb-2"><strong>Chủ tài khoản:</strong> Minh Thuan</p>
                            <p class="mb-2"><strong>Số tài khoản:</strong> <span style="font-size: 1.2rem; font-weight: bold; color: #ef4444;">17118899999</span></p>
                            <p class="mb-2"><strong>Nội dung chuyển khoản:</strong> <span style="font-weight: bold; color: var(--primary);">${bCode}</span></p>
                            <p class="mb-2"><strong>Số tiền:</strong> <span style="font-weight: bold; color: #ef4444;">${bTotal}</span></p>
                        </div>
                        <div style="text-align: center; border: 1px solid #cbd5e1; padding: 12px; border-radius: 12px; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                            <img src="${vietQrUrl}" alt="Real Bank QR Code via VietQR" style="width: 200px; height: auto; display: block; margin: 0 auto; border-radius: 6px;">
                            <p style="font-size: 11px; margin-top: 8px; color: #64748b; font-weight: 500;">Quét bằng App Ngân hàng (VCB, MB, Techcom...)</p>
                        </div>
                    </div>
                    <div style="margin-top: 15px; font-size: 14px; color: #64748b; font-style: italic; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                        Hệ thống sẽ tự động ghi nhận giao dịch của bạn. Vui lòng giữ nguyên nội dung chuyển khoản là <b style="color:var(--primary);">${bCode}</b> để giao dịch được xử lý chính xác.
                    </div>
                `;
                btn.innerText = 'Xác nhận đã chuyển khoản';
            } else if (selectedMethod === 'Cash') {
                instructions.innerHTML = `
                    <h4 style="color: var(--primary); margin-bottom: 15px; font-weight: 600;">Hướng dẫn thanh toán Tiền mặt</h4>
                    <p class="mb-2">Bạn có thể thanh toán trực tiếp tại văn phòng của chúng tôi hoặc yêu cầu nhân viên đến thu hộ tại nhà (chỉ áp dụng trong nội thành).</p>
                    <ul style="padding-left: 20px; color: #475569; margin-bottom: 15px; line-height: 1.6;">
                        <li><strong>Văn phòng:</strong> Viện song ngữ quốc tế NIIE</li>
                        <li><strong>Hotline thu hộ:</strong> 1900 1234</li>
                    </ul>
                    <div style="font-size: 14px; color: #64748b; font-style: italic;">
                        Bấm <b>"Xác nhận đặt phòng"</b> để chúng tôi ghi nhận yêu cầu và xếp lịch thu tiền hoặc hẹn tại văn phòng.
                    </div>
                `;
                btn.innerText = 'Xác nhận đặt phòng';
            }
        };
        
        updateInstructions();
        
        // Overwrite the previous click listeners to update instructions
        document.querySelectorAll('.payment-method').forEach(el => {
            // clone node to remove old listeners
            const clone = el.cloneNode(true);
            el.parentNode.replaceChild(clone, el);
        });
        
        document.querySelectorAll('.payment-method').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.payment-method').forEach(btn => btn.classList.remove('selected'));
                el.classList.add('selected');
                selectedMethod = el.getAttribute('data-method');
                updateInstructions();
            });
        });

        document.getElementById('btnPay').addEventListener('click', async () => {
            const btn = document.getElementById('btnPay');
            btn.disabled = true;
            btn.innerText = 'Đang xử lý...';

            if (selectedMethod === 'VNPAY') {
                btn.innerText = 'Đang chuyển hướng sang VNPAY...';
                try {
                    const bId = firstBookingId || 0;
                    const vnpRes = await fetch(`${API_URL}/Payments/create-vnpay-url?bookingId=${bId}&bookingCode=${encodeURIComponent(bookingCode)}`, {
                        headers: { 
                            'Authorization': `Bearer ${token}` 
                        }
                    });
                    
                    let vnpData = {};
                    try {
                        vnpData = await vnpRes.json();
                    } catch (parseErr) {
                        console.error('Failed to parse response JSON:', parseErr);
                    }
                    
                    if (vnpRes.ok && vnpData.paymentUrl) {
                        window.location.href = vnpData.paymentUrl;
                        return;
                    } else {
                        const errMsg = vnpData.message || (vnpRes.status === 401 ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' : `Không thể tạo cổng VNPAY (Mã lỗi HTTP: ${vnpRes.status})`);
                        window.Popup.show('Lỗi', errMsg, 'error');
                        btn.disabled = false;
                        updateInstructions();
                        return;
                    }
                } catch (e) {
                    console.error('VNPAY Error:', e);
                    window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ: ' + e.message, 'error');
                    btn.disabled = false;
                    updateInstructions();
                    return;
                }
            } else if (selectedMethod === 'PayPal') {
                btn.innerText = 'Đang xác thực PayPal...';
                try {
                    const ppRes = await fetch(`${API_URL}/Payments/capture-paypal-order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ bookingCode: bookingCode, paymentMethod: 'PayPal' })
                    });
                    const ppData = await ppRes.json();
                    if (ppRes.ok) {
                        window.Popup.show('Thành công', 'Thanh toán PayPal thành công!', 'success');
                        setTimeout(() => window.location.href = '/history.html?payment=success', 2000);
                        return;
                    } else {
                        window.Popup.show('Lỗi', ppData.message || 'Thanh toán thất bại', 'error');
                        btn.disabled = false;
                        updateInstructions();
                        return;
                    }
                } catch (e) {
                    window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ PayPal', 'error');
                    btn.disabled = false;
                    updateInstructions();
                    return;
                }
            }

            try {
                // Thanh toán 1 lần duy nhất cho toàn bộ đơn hàng qua endpoint ProcessByCode
                const payRes = await fetch(`${API_URL}/Payments/ProcessByCode`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ bookingCode: bookingCode, paymentMethod: selectedMethod })
                });

                const payData = await payRes.json();

                if (payRes.ok) {
                    const txnMsg = payData.transactionCode ? ` (Mã GD: ${payData.transactionCode})` : '';
                    window.Popup.show('Thành công', (payData.message || 'Thành công!') + txnMsg, 'success');
                    setTimeout(() => window.location.href = '/history.html', 3000);
                } else {
                    window.Popup.show('Lỗi', payData.message || 'Thanh toán thất bại', 'error');
                    btn.disabled = false;
                    updateInstructions();
                }
            } catch (error) {
                window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ', 'error');
                btn.disabled = false;
                updateInstructions();
            }
        });

        // Add hover and click event listeners for cancel button in JS dynamically
        const btnCancel = document.getElementById('btnCancelCheckout');
        console.log("btnCancelCheckout element in DOM:", btnCancel);
        if (btnCancel) {
            btnCancel.addEventListener('mouseenter', () => {
                btnCancel.style.background = '#fef2f2';
                btnCancel.style.borderColor = '#ef4444';
            });
            btnCancel.addEventListener('mouseleave', () => {
                btnCancel.style.background = 'transparent';
                btnCancel.style.borderColor = '#fecaca';
            });
            btnCancel.addEventListener('click', () => {
                console.log("btnCancelCheckout clicked, opening confirm popup. Group items:", groupItems);
                window.Popup.confirm('Xác nhận hủy', 'Bạn có chắc chắn muốn hủy đơn đặt phòng này không?', async () => {
                    console.log("Confirm callback execution started. Disabling cancel button...");
                    btnCancel.disabled = true;
                    btnCancel.innerText = 'Đang xử lý...';

                    try {
                        let successCount = 0;
                        for (const item of groupItems) {
                            console.log(`Sending PUT request to cancel booking ID: ${item.bookingId}`);
                            const res = await fetch(`${API_URL}/Bookings/${item.bookingId}/Cancel`, {
                                method: 'PUT',
                                headers: { 
                                    'Authorization': `Bearer ${token}` 
                                }
                            });
                            console.log(`Cancel response status for ID ${item.bookingId}:`, res.status);
                            if (res.ok) successCount++;
                        }
                        console.log("Successfully cancelled bookings count:", successCount);
                        if (successCount > 0) {
                            window.Popup.show('Thành công', 'Hủy đơn hàng thành công', 'success');
                            setTimeout(() => window.location.href = '/history.html', 2000);
                        } else {
                            window.Popup.show('Lỗi', 'Không thể hủy đơn hàng', 'error');
                            btnCancel.disabled = false;
                            btnCancel.innerText = 'Hủy đơn đặt phòng';
                        }
                    } catch (e) {
                        console.error("Error occurred during cancel API requests:", e);
                        window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ', 'error');
                        btnCancel.disabled = false;
                        btnCancel.innerText = 'Hủy đơn đặt phòng';
                    }
                }, true, 'Đồng ý hủy');
            });
        }

    } catch (error) {
        console.error("Error loading MyBookings on checkout page load:", error);
    }
});
