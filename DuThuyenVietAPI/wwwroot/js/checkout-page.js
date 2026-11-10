// @ts-nocheck
document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = '/api';
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.replace('/login.html?returnUrl=' + encodeURIComponent(window.location.pathname + window.location.search));
        return;
    }

    const formatPrice = (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

    // Checkout page logic
    const urlParams = new URLSearchParams(window.location.search);
    const bookingCode = urlParams.get('bookingCode') || urlParams.get('code');
    if (!bookingCode) {
        window.location.href = '/history.html';
        return;
    }

    let selectedMethod = 'VietQR';
    let firstBookingId = null;
    let isProcessingPayment = false;
    let paypalButtonsRendered = false;

    // Load booking details
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
            window.Popup.show('Thông báo', 'Đơn đặt phòng này không ở trạng thái chờ thanh toán.', 'info');
            setTimeout(() => window.location.href = '/history.html', 1800);
            return;
        }

        const totalGroupPrice = groupItems.reduce((sum, b) => sum + b.totalPrice, 0);

        document.getElementById('checkoutBookingCode').innerHTML = `Mã đơn: <strong style="color: #0d9488; font-family: monospace; font-size: 15px;">${bookingCode}</strong> · Ngày tạo: ${new Date(firstBooking.createdAt).toLocaleString('vi-VN')}`;
        document.getElementById('checkoutTotal').innerText = formatPrice(totalGroupPrice);

        // Fetch Cruise Image & Amenities if possible
        let cruiseThumb = '/images/icons/cruise-yacht.png';
        try {
            if (firstBooking.cruiseId) {
                const cruiseRes = await fetch(`${API_URL}/Cruises/${firstBooking.cruiseId}`);
                if (cruiseRes.ok) {
                    const cruiseData = await cruiseRes.json();
                    if (cruiseData.mainImage) cruiseThumb = cruiseData.mainImage;
                }
            }
        } catch {}

        // Build detailed room breakdown
        const roomDetailsHtml = groupItems.map(b => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="background: #f0fdfa; border: 1px solid #ccfbf1; padding: 6px; border-radius: 8px;">
                        <img src="/images/icons/cabin-bed.png" class="app-icon" alt="">
                    </div>
                    <div>
                        <div style="font-weight: 700; color: #0f172a; font-size: 14.5px;">${b.cabinName}</div>
                        <div style="color: #64748b; font-size: 12.5px;">Số lượng: <strong>x${b.numberOfRooms} phòng</strong></div>
                    </div>
                </div>
                <span style="font-weight: 700; color: #0f766e; font-size: 15px;">${formatPrice(b.totalPrice)}</span>
            </div>
        `).join('');

        const noteHtml = firstBooking.note 
            ? `<div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 10px 14px; margin-top: 12px; font-size: 13.5px; color: #92400e;">
                 <strong><img src="/images/icons/note-edit.png" class="app-icon-sm" alt=""> Ghi chú của khách:</strong> ${firstBooking.note}
               </div>` 
            : '';

        const returnDateStr = firstBooking.returnDate 
            ? ` <img src="/images/icons/arrow-right.png" class="app-icon-sm" alt="➔"> Ngày về: <strong>${new Date(firstBooking.returnDate).toLocaleDateString('vi-VN')}</strong>` 
            : '';

        document.getElementById('checkoutDetails').innerHTML = `
            <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap;">
                <img src="${cruiseThumb}" alt="${firstBooking.cruiseName}" style="width: 80px; height: 60px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); flex-shrink: 0;" onerror="this.src='/images/icons/cruise-yacht.png'; this.style.objectFit='contain';">
                <div style="flex: 1; min-width: 200px;">
                    <h3 style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px;">${firstBooking.cruiseName}</h3>
                    <div style="font-size: 13.5px; color: #475569;">
                        <img src="/images/icons/departure-calendar.png" class="app-icon-sm" alt=""> Ngày đi: <strong>${new Date(firstBooking.departureDate).toLocaleDateString('vi-VN')}</strong>${returnDateStr}
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 14px; background: #ffffff; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div>
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Hành khách đại diện:</span>
                    <div style="font-weight: 700; color: #0f172a; font-size: 14px; margin-top: 2px;">${firstBooking.contactName}</div>
                </div>
                <div>
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Số điện thoại:</span>
                    <div style="font-weight: 700; color: #0f172a; font-size: 14px; margin-top: 2px;">${firstBooking.contactPhone}</div>
                </div>
            </div>

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 8px;">Danh sách phòng đặt:</div>
                ${roomDetailsHtml}
            </div>

            <!-- Gói quyền lợi bao gồm -->
            <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px;">
                <span style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 4px 10px; border-radius: 20px; font-weight: 600;">✓ Bao gồm bữa ăn hải sản</span>
                <span style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 4px 10px; border-radius: 20px; font-weight: 600;">✓ Vé tham quan thắng cảnh vịnh</span>
                <span style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 4px 10px; border-radius: 20px; font-weight: 600;">✓ Thuyền Kayak / Thuyền nan</span>
                <span style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 4px 10px; border-radius: 20px; font-weight: 600;">✓ Bảo hiểm du lịch trọn tour</span>
            </div>

            ${noteHtml}
        `;

        // Update breadcrumb
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

        // Countdown Timer (30 minutes)
        const limitTime = new Date(new Date(firstBooking.createdAt).getTime() + 30 * 60 * 1000);
        const timerEl = document.getElementById('countdownTimer');
        if (timerEl) {
            timerEl.style.display = 'flex';
            function updateTimer() {
                const now = new Date();
                const diff = limitTime - now;
                if (diff <= 0) {
                    timerEl.innerHTML = '<img src="/images/icons/warning.png" class="app-icon" alt=""> Đơn đặt phòng đã quá hạn thanh toán 30 phút. Vui lòng đặt lại.';
                    document.getElementById('btnPay').disabled = true;
                    document.getElementById('btnPay').innerText = 'Đơn đặt phòng đã hết hạn';
                    return;
                }
                const mins = Math.floor(diff / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                timerEl.innerHTML = `<img src="/images/icons/alarm-clock.png" class="app-icon" alt=""> Hạn thanh toán còn lại: <span style="font-size: 1.15rem; font-family: monospace; font-weight: 700; color: #ef4444; margin: 0 4px;">${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}</span> (Sau thời gian này phòng sẽ tự động giải phóng)`;
            }
            updateTimer();
            const timerInterval = setInterval(() => {
                updateTimer();
                if (limitTime - new Date() <= 0) clearInterval(timerInterval);
            }, 1000);
        }

        // PayPal SDK loader
        function loadPayPalSdk(clientId) {
            return new Promise((resolve, reject) => {
                const existingScript = document.getElementById('paypal-sdk-script');
                if (existingScript) {
                    if (window.paypal) { resolve(); return; }
                    existingScript.remove();
                }
                const script = document.createElement('script');
                script.id = 'paypal-sdk-script';
                script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Không thể tải thư viện thanh toán PayPal.'));
                document.head.appendChild(script);
            });
        }

        async function setupPayPal() {
            const ppWrapper = document.getElementById('paypalButtonWrapper');
            const ppSpinner = document.getElementById('paypalLoadingSpinner');
            const ppContainer = document.getElementById('paypal-button-container');
            const btnPay = document.getElementById('btnPay');

            if (ppWrapper) ppWrapper.style.display = 'block';
            if (btnPay) btnPay.style.display = 'none';

            if (paypalButtonsRendered) return;

            if (ppSpinner) {
                ppSpinner.style.display = 'block';
                ppSpinner.innerHTML = '<img src="/images/icons/pending-hourglass.png" class="app-icon" alt=""> Đang kết nối máy chủ PayPal Sandbox...';
            }
            if (ppContainer) ppContainer.innerHTML = '';

            try {
                const res = await fetch(`${API_URL}/Payments/create-paypal-order`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ bookingCode: bookingCode, bookingId: firstBookingId })
                });

                if (!res.ok) throw new Error('Không thể khởi tạo giao dịch PayPal.');

                const data = await res.json();
                const usdAmount = data.usdAmount || '10.00';
                const clientId = data.paypalClientId || 'test';
                const rate = data.exchangeRate || 25400;

                const rateBox = document.getElementById('paypalExchangeInfo');
                if (rateBox) {
                    rateBox.innerHTML = `
                        <span style="font-size:14px; color:#0d9488; font-weight:600;">Tổng tiền: ${formatPrice(totalGroupPrice)} quy đổi ≈ $${usdAmount} USD</span>
                        <span style="font-size:12px; color:#64748b; margin-left:8px;">(Tỷ giá quy đổi: 1 USD = ${Number(rate).toLocaleString('vi-VN')} VND)</span>
                    `;
                }

                await loadPayPalSdk(clientId);

                if (ppSpinner) ppSpinner.style.display = 'none';

                if (window.paypal && window.paypal.Buttons) {
                    window.paypal.Buttons({
                        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
                        createOrder: function(data, actions) {
                            return actions.order.create({
                                purchase_units: [{
                                    amount: { value: usdAmount },
                                    description: `Du Thuyen Viet - ${bookingCode}`
                                }]
                            });
                        },
                        onApprove: async function(data, actions) {
                            window.Popup.show('Đang xử lý', 'Đang xác thực thanh toán từ PayPal...', 'info');
                            try {
                                const details = await actions.order.capture();
                                const txnId = details.id || data.orderID;

                                const capRes = await fetch(`${API_URL}/Payments/capture-paypal-order`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                        bookingCode: bookingCode,
                                        orderID: txnId,
                                        transactionCode: txnId
                                    })
                                });

                                if (capRes.ok) {
                                    window.Popup.show('Thành công', 'Thanh toán PayPal thành công!', 'success');
                                    sessionStorage.setItem('last_payment_method_' + bookingCode, 'PayPal');
                                    setTimeout(() => window.location.href = `/order-success.html?code=${bookingCode}&method=PayPal`, 1500);
                                } else {
                                    const errData = await capRes.json();
                                    window.Popup.show('Lỗi', errData.message || 'Xác thực thanh toán thất bại.', 'error');
                                }
                            } catch (err) {
                                window.Popup.show('Lỗi', 'Không thể hoàn tất giao dịch PayPal: ' + err.message, 'error');
                            }
                        },
                        onError: function(err) {
                            window.Popup.show('Lỗi PayPal', 'Giao dịch bị gián đoạn hoặc bị hủy.', 'error');
                        }
                    }).render('#paypal-button-container');

                    paypalButtonsRendered = true;
                }
            } catch (err) {
                if (ppSpinner) {
                    ppSpinner.innerHTML = `<span style="color:#ef4444;"><img src="/images/icons/warning.png" class="app-icon" alt=""> ${err.message || 'Không thể kết nối PayPal.'}</span>`;
                }
            }
        }

        // Method instructions updater
        function updateInstructions() {
            const instructions = document.getElementById('paymentInstructions');
            const btn = document.getElementById('btnPay');
            const ppWrapper = document.getElementById('paypalButtonWrapper');
            const bCode = bookingCode;
            const bTotal = formatPrice(totalGroupPrice);

            instructions.style.display = 'block';

            if (selectedMethod === 'VietQR' || selectedMethod === 'BankTransfer') {
                if (ppWrapper) ppWrapper.style.display = 'none';
                if (btn) btn.style.display = 'inline-flex';
                btn.disabled = false;

                const bankId = 'Techcombank';
                const accountNo = '17118899999';
                const accountName = encodeURIComponent('Du Thuyen Viet');
                const amount = totalGroupPrice;
                const description = encodeURIComponent(bCode);
                const vietQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${amount}&addInfo=${description}&accountName=${accountName}`;

                instructions.innerHTML = `
                    <h4 style="color: #0d9488; margin-bottom: 12px; font-weight: 700; display:flex; align-items:center; gap:8px;">
                        <img src="/images/icons/vietqr.png" class="app-icon" alt=""> Hướng dẫn Chuyển khoản VietQR 24/7
                    </h4>
                    <div style="display: flex; gap: 20px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 220px; font-size: 14px; line-height: 1.7;">
                            <p class="mb-1"><strong>Ngân hàng thụ hưởng:</strong> Techcombank</p>
                            <p class="mb-1"><strong>Chủ tài khoản:</strong> DU THUYEN VIET</p>
                            <p class="mb-1"><strong>Số tài khoản:</strong> <span style="font-size: 1.15rem; font-weight: 800; color: #ef4444; font-family: monospace;">17118899999</span></p>
                            <p class="mb-1"><strong>Số tiền:</strong> <span style="font-weight: 800; color: #ef4444; font-size: 1.1rem;">${bTotal}</span></p>
                            <p class="mb-1"><strong>Nội dung bắt buộc:</strong> <span style="font-weight: 800; color: #0d9488; background: #f0fdfa; padding: 2px 8px; border-radius: 4px; border: 1px dashed #0d9488; font-family: monospace;">${bCode}</span></p>
                        </div>
                        <div style="text-align: center; border: 1.5px solid #ccfbf1; padding: 12px; border-radius: 12px; background: #ffffff; box-shadow: 0 4px 12px rgba(13,148,136,0.08);">
                            <img src="${vietQrUrl}" alt="VietQR Code" style="width: 190px; height: auto; display: block; margin: 0 auto; border-radius: 6px;">
                            <p style="font-size: 12px; margin-top: 8px; color: #0d9488; font-weight: 600;">Quét bằng mọi ứng dụng Ngân hàng</p>
                        </div>
                    </div>
                    <div style="margin-top: 14px; font-size: 13px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
                        <em>Lưu ý: Sau khi chuyển khoản trên App ngân hàng xong, vui lòng bấm nút xác nhận bên dưới để hệ thống ghi nhận.</em>
                    </div>
                `;
                btn.innerHTML = '<img src="/images/icons/vietqr.png" class="app-icon" alt="VietQR" style="width: 22px; height: 22px; object-fit: contain;"> Xác nhận đã chuyển khoản VietQR';
            } else if (selectedMethod === 'VNPAY') {
                if (ppWrapper) ppWrapper.style.display = 'none';
                if (btn) btn.style.display = 'inline-flex';
                btn.disabled = false;

                instructions.innerHTML = `
                    <h4 style="color: #005baa; margin-bottom: 12px; font-weight: 700; display:flex; align-items:center; gap:8px;">
                        <img src="/images/icons/vnpay.png" class="app-icon" alt=""> Cổng thanh toán VNPAY Sandbox
                    </h4>
                    <p class="mb-2" style="font-size: 14px;">Bạn sẽ được chuyển hướng sang cổng thanh toán chính thức của <strong>VNPAY</strong> để quét mã VNPAY-QR hoặc nhập thẻ ATM nội địa.</p>
                    <div style="background:#f1f5f9; padding:12px 16px; border-radius:8px; font-size:13px; line-height:1.6; margin-bottom:12px; border-left:4px solid #005baa;">
                        <strong>Thông tin thẻ TEST Sandbox để nộp đồ án:</strong><br/>
                        • Ngân hàng: <b>NCB</b><br/>
                        • Số thẻ: <b>9704198526191432198</b><br/>
                        • Tên chủ thẻ: <b>NGUYEN VAN A</b><br/>
                        • Ngày phát hành: <b>07/15</b><br/>
                        • Mật khẩu OTP: <b>123456</b>
                    </div>
                `;
                btn.innerHTML = '<img src="/images/icons/vnpay.png" class="app-icon" alt="VNPAY" style="width: 22px; height: 22px; object-fit: contain;"> Chuyển sang Cổng VNPAY';
            } else if (selectedMethod === 'PayPal') {
                const estUsd = Math.max(1, Math.round(totalGroupPrice / 25400)).toFixed(2);
                instructions.innerHTML = `
                    <h4 style="color: #003087; margin-bottom: 12px; font-weight: 700; display:flex; align-items:center; gap:8px;">
                        <img src="/images/icons/paypal.png" class="app-icon" alt=""> Cổng thanh toán Quốc tế PayPal Sandbox
                    </h4>
                    <p class="mb-2" style="font-size: 14px;">Thanh toán an toàn dành cho khách quốc tế qua thẻ <strong>Visa / MasterCard</strong> hoặc tài khoản <strong>PayPal</strong>.</p>
                    <div id="paypalExchangeInfo" style="background:#f8fafc; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:10px;">
                        <span style="font-size:14px; color:#0d9488; font-weight:600;">Tổng tiền: ${bTotal} quy đổi ≈ $${estUsd} USD</span>
                        <span style="font-size:12px; color:#64748b; margin-left:8px;">(Tỷ giá quy đổi: 1 USD = 25,400 VND)</span>
                    </div>
                `;
                setupPayPal();
            } else if (selectedMethod === 'Cash') {
                if (ppWrapper) ppWrapper.style.display = 'none';
                if (btn) btn.style.display = 'inline-flex';
                btn.disabled = false;

                instructions.innerHTML = `
                    <h4 style="color: #a16207; margin-bottom: 12px; font-weight: 700; display:flex; align-items:center; gap:8px;">
                        <img src="/images/icons/cash-vnd.png" class="app-icon" alt=""> Thanh toán Tiền mặt tại quầy
                    </h4>
                    <p class="mb-2" style="font-size: 14px;">Bạn có thể thanh toán trực tiếp tại quầy lễ tân hoặc văn phòng Du Thuyền Việt trước khi khởi hành.</p>
                    <ul style="padding-left: 20px; color: #475569; font-size: 13.5px; line-height: 1.7;">
                        <li><strong>Địa chỉ:</strong> Cảng Tàu Khách Quốc Tế Tuần Châu, TP. Hạ Long</li>
                        <li><strong>Hotline hỗ trợ:</strong> 1900 1234 (24/7)</li>
                    </ul>
                `;
                btn.innerHTML = '<img src="/images/icons/cash-vnd.png" class="app-icon" alt="Tiền mặt" style="width: 22px; height: 22px; object-fit: contain;"> Xác nhận đặt chỗ & Thanh toán sau';
            }
        }

        // Method selector event listener (Robust single binding)
        document.querySelectorAll('.payment-method').forEach(el => {
            el.addEventListener('click', (e) => {
                const targetCard = e.currentTarget || e.target.closest('.payment-method');
                if (!targetCard) return;

                document.querySelectorAll('.payment-method').forEach(card => card.classList.remove('selected'));
                targetCard.classList.add('selected');

                selectedMethod = targetCard.getAttribute('data-method') || 'VietQR';
                sessionStorage.setItem('active_payment_method_' + bookingCode, selectedMethod);
                updateInstructions();
            });
        });

        // Initial instructions display
        updateInstructions();

        // Submit Payment with Anti-Spam Buffer & Debounce Protection
        document.getElementById('btnPay').addEventListener('click', async () => {
            if (isProcessingPayment) return;

            const btn = document.getElementById('btnPay');
            
            // Double-check the actively selected card in DOM to guarantee correct method
            const activeCard = document.querySelector('.payment-method.selected');
            const finalMethod = (activeCard && activeCard.getAttribute('data-method')) || selectedMethod || 'VietQR';

            isProcessingPayment = true;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid #0f766e; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></span> Đang kết nối giao dịch an toàn...';

            if (finalMethod === 'VNPAY') {
                try {
                    const bId = firstBookingId || 0;
                    const vnpRes = await fetch(`${API_URL}/Payments/create-vnpay-url?bookingId=${bId}&bookingCode=${encodeURIComponent(bookingCode)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    const vnpData = await vnpRes.json().catch(() => ({}));
                    if (vnpRes.ok && vnpData.paymentUrl) {
                        sessionStorage.setItem('last_payment_method_' + bookingCode, 'VNPAY');
                        window.location.href = vnpData.paymentUrl;
                        return;
                    } else {
                        window.Popup.show('Lỗi', vnpData.message || 'Không thể tạo cổng VNPAY.', 'error');
                        setTimeout(() => { isProcessingPayment = false; btn.disabled = false; updateInstructions(); }, 2500);
                        return;
                    }
                } catch (e) {
                    window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ: ' + e.message, 'error');
                    setTimeout(() => { isProcessingPayment = false; btn.disabled = false; updateInstructions(); }, 2500);
                    return;
                }
            }

            // Process VietQR, Cash, or others via ProcessByCode
            try {
                const payRes = await fetch(`${API_URL}/Payments/ProcessByCode`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        bookingCode: bookingCode, 
                        paymentMethod: finalMethod 
                    })
                });

                const payData = await payRes.json().catch(() => ({}));

                if (payRes.ok) {
                    sessionStorage.setItem('last_payment_method_' + bookingCode, finalMethod);
                    window.Popup.show('Thành công', payData.message || 'Đã ghi nhận thanh toán!', 'success');
                    setTimeout(() => {
                        window.location.href = `/order-success.html?code=${bookingCode}&method=${encodeURIComponent(finalMethod)}`;
                    }, 1200);
                } else {
                    window.Popup.show('Lỗi', payData.message || 'Thanh toán thất bại', 'error');
                    // 2.5s Anti-spam buffer lockout before re-enabling
                    setTimeout(() => {
                        isProcessingPayment = false;
                        btn.disabled = false;
                        updateInstructions();
                    }, 2500);
                }
            } catch (error) {
                window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ', 'error');
                setTimeout(() => {
                    isProcessingPayment = false;
                    btn.disabled = false;
                    updateInstructions();
                }, 2500);
            }
        });

        // Cancel booking listener
        const btnCancel = document.getElementById('btnCancelCheckout');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                window.Popup.confirm('Xác nhận hủy', 'Bạn có chắc chắn muốn hủy đơn đặt phòng này không?', async () => {
                    btnCancel.disabled = true;
                    btnCancel.innerText = 'Đang xử lý...';

                    try {
                        let successCount = 0;
                        for (const item of groupItems) {
                            const cRes = await fetch(`${API_URL}/Bookings/${item.bookingId}/Cancel`, {
                                method: 'PUT',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (cRes.ok) successCount++;
                        }
                        if (successCount > 0) {
                            window.Popup.show('Thành công', 'Đã hủy đơn đặt phòng thành công.', 'success');
                            setTimeout(() => window.location.href = '/history.html', 1500);
                        } else {
                            window.Popup.show('Lỗi', 'Không thể hủy đơn đặt phòng này.', 'error');
                            btnCancel.disabled = false;
                            btnCancel.innerHTML = '<img src="/images/icons/cancel-booking.png" class="app-icon" alt=""> Hủy đơn đặt phòng';
                        }
                    } catch (e) {
                        window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
                        btnCancel.disabled = false;
                        btnCancel.innerHTML = '<img src="/images/icons/cancel-booking.png" class="app-icon" alt=""> Hủy đơn đặt phòng';
                    }
                });
            });
        }

    } catch (err) {
        console.error('Lỗi khởi tạo checkout:', err);
    }
});
