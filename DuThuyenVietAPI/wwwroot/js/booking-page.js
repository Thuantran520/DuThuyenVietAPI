/* ==========================================================================
   DuThuyenViet - Booking Page Logic
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

// Biến toàn cục lưu thông tin mã giảm giá được áp dụng
let appliedPromotion = null;

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!checkAuth()) return;

    // Auto-fill user profile
    try {
        const profileRes = await fetch('/api/account/profile', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            const emailInput = document.getElementById('b_email');
            const nameInput = document.getElementById('b_name');
            const phoneInput = document.getElementById('b_phone');

            if (emailInput) emailInput.value = profileData.email || profileData.Email || '';

            const fName = profileData.fullName || profileData.FullName || profileData.userName || profileData.UserName || '';
            if (nameInput && fName !== 'Chưa cập nhật') nameInput.value = fName;

            const pPhone = profileData.phoneNumber || profileData.PhoneNumber || '';
            if (phoneInput && pPhone !== 'Chưa cập nhật') phoneInput.value = pPhone;
        }
    } catch (err) {
        console.error('Lỗi lấy profile:', err);
    }

    // Booking page logic
    const urlParams = new URLSearchParams(window.location.search);
    const scheduleId = urlParams.get('scheduleId');
    const cruiseId = urlParams.get('cruiseId');
    const cabinsParam = urlParams.get('cabins');
    const singleCabinId = urlParams.get('cabinTypeId');

    // Fix layout flash
    const tripInfoRow = document.getElementById('trip-info-row');
    const roomWrapper = document.getElementById('room-count-wrapper');

    if (!singleCabinId || cabinsParam) {
        if (roomWrapper) roomWrapper.style.display = 'none';
    }

    if (tripInfoRow) tripInfoRow.style.display = 'grid';

    if (!scheduleId || !cruiseId) {
        window.location.href = '/search.html';
        return;
    }

    let selectedCabins = [];

    if (cabinsParam) {
        selectedCabins = cabinsParam.split(',').map(c => {
            const parts = c.split(':');
            return {
                cabinTypeId: parseInt(parts[0]),
                count: parseInt(parts[1])
            };
        });
    } else if (singleCabinId) {
        selectedCabins = [{
            cabinTypeId: parseInt(singleCabinId),
            count: 1
        }];
    }

    if (selectedCabins.length === 0) {
        window.location.href = `/cruise-detail.html?id=${cruiseId}`;
        return;
    }

    // Hàm cập nhật hiển thị tóm tắt đơn hàng & tính tiền giảm giá
    const updateSummary = () => {
        if (!window.cruiseDataCache) return;
        const cruise = window.cruiseDataCache;

        let totalAmount = 0;
        let summaryHtml = `
            <div class="mb-3">
                <p class="mb-1 text-muted" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Du thuyền</p>
                <h4 style="font-family: 'Playfair Display', serif; font-weight: 700; color: var(--primary);">${cruise.name}</h4>
                <p class="text-muted" style="font-size:0.9rem;"><img src="/images/Direction.svg" alt="Location" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 4px;"> ${cruise.destinationName || 'Vịnh Hạ Long'}</p>
            </div>
            <hr class="my-3">
            <div class="mb-3">
                <p class="mb-2"><strong>Lịch trình đi:</strong> Chuyến đi bắt đầu từ ngày được chọn.</p>
            </div>
            <hr class="my-3">
            <h4 class="mb-3" style="font-size: 1.1rem; font-weight: 600;">Chi tiết phòng chọn</h4>
        `;

        selectedCabins.forEach(sc => {
            const cabin = cruise.cabins.find(c => c.cabinTypeId == sc.cabinTypeId);
            if (cabin) {
                let currentCount = sc.count;
                const roomsInput = document.getElementById('b_rooms');
                if (singleCabinId && !cabinsParam && roomsInput) {
                    currentCount = parseInt(roomsInput.value) || 1;
                }
                const subTotal = cabin.basePrice * currentCount;
                totalAmount += subTotal;

                summaryHtml += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.95rem;">
                        <div>
                            <span>${cabin.name}</span>
                            <span class="text-muted" style="margin-left: 5px;">(x${currentCount})</span>
                        </div>
                        <strong>${formatPrice(subTotal)}</strong>
                    </div>
                `;
            }
        });

        // TÍNH TOÁN GIẢM GIÁ (CHỈ TÍNH KHI MÃ THỰC SỰ HỢP LỆ)
        let discountAmount = 0;
        if (appliedPromotion && Number(appliedPromotion.discountPercent) > 0) {
            discountAmount = (totalAmount * Number(appliedPromotion.discountPercent)) / 100;
        }
        const finalAmount = totalAmount - discountAmount;

        summaryHtml += `<hr class="my-3">`;

        if (appliedPromotion && Number(appliedPromotion.discountPercent) > 0) {
            summaryHtml += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.95rem; color: #64748b;">
                    <span>Tạm tính:</span>
                    <span>${formatPrice(totalAmount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.95rem; color: #16a34a; font-weight: 600;">
                    <span>Giảm giá (${appliedPromotion.discountPercent}%):</span>
                    <span>- ${formatPrice(discountAmount)}</span>
                </div>
            `;
        }

        summaryHtml += `
            <h4 class="mt-3">Tổng cộng: <span class="text-danger">${formatPrice(finalAmount)}</span></h4>
        `;

        const summaryContainer = document.getElementById('bookingSummary');
        if (summaryContainer) {
            summaryContainer.innerHTML = summaryHtml;
        }
    };

    // Tải dữ liệu Du thuyền
    try {
        const res = await fetch(`${API_URL}/Cruises/${cruiseId}`);
        if (!res.ok) throw new Error('Failed to load');
        const cruise = await res.json();
        window.cruiseDataCache = cruise;

        const bcCruiseLink = document.getElementById('bc-cruise-link');
        const bcCruiseActive = document.getElementById('bc-cruise-active');
        if (bcCruiseLink && bcCruiseActive) {
            bcCruiseLink.href = `/cruise-detail.html?id=${cruiseId}`;
            bcCruiseLink.innerText = cruise.name || 'Chi tiết du thuyền';
            bcCruiseActive.innerText = 'Đặt phòng';
        }

        updateSummary();

        const bRooms = document.getElementById('b_rooms');
        if (bRooms) bRooms.addEventListener('input', updateSummary);
        const bGuests = document.getElementById('b_guests');
        if (bGuests) bGuests.addEventListener('input', updateSummary);

    } catch (e) {
        const summaryContainer = document.getElementById('bookingSummary');
        if (summaryContainer) {
            summaryContainer.innerHTML = '<p class="text-danger">Không thể tải thông tin chuyến đi.</p>';
        }
    }

    // BẮT SỰ KIỆN NÚT "ÁP DỤNG MÃ GIẢM GIÁ" (ĐÃ TỐI ƯU HTTP 400)
    const btnApplyPromo = document.getElementById('btnApplyPromo');
    if (btnApplyPromo) {
        btnApplyPromo.addEventListener('click', async () => {
            const promoInput = document.getElementById('promoCodeInput');
            const promoMsg = document.getElementById('promoMessage');
            const code = promoInput ? promoInput.value.trim().toUpperCase() : '';

            // 1. Luôn hủy bỏ mã cũ ngay khi bấm nút
            appliedPromotion = null;

            if (!code) {
                if (promoMsg) promoMsg.innerHTML = '<span style="color: #ef4444;">Vui lòng nhập mã giảm giá.</span>';
                updateSummary();
                return;
            }

            try {
                if (promoMsg) promoMsg.innerHTML = '<span style="color: #64748b;">Đang kiểm tra mã...</span>';

                let promoApiUrl = `${API_URL}/Promotions/Validate/${encodeURIComponent(code)}`;
                if (scheduleId) {
                    promoApiUrl += `?scheduleId=${scheduleId}`;
                }

                const res = await fetch(promoApiUrl);

                // Đọc JSON an toàn
                let data = {};
                try {
                    data = await res.json();
                } catch (e) {
                    // Tránh crash nếu backend trả về text hoặc rỗng
                }

                // 2. Xử lý khi HTTP Status không ok (400, 404, 500...)
                if (!res.ok) {
                    appliedPromotion = null;
                    const errMsg = data.message || data.Message || data.error || data.Error || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.';
                    if (promoMsg) promoMsg.innerHTML = `<span style="color: #ef4444;">${errMsg}</span>`;
                    return;
                }

                // 3. Đọc dữ liệu khi HTTP Status = 200 OK
                const isValid = (data.isValid !== false) && (data.IsValid !== false) &&
                    (data.success !== false) && (data.Success !== false) &&
                    (data.isSuccess !== false) && (data.IsSuccess !== false);

                const discountPercent = Number(data.discountPercent || data.DiscountPercent || 0);
                const msg = data.message || data.Message || data.error || data.Error || '';

                if (isValid && discountPercent > 0) {
                    appliedPromotion = {
                        code: data.code || data.Code || code,
                        discountPercent: discountPercent
                    };
                    if (promoMsg) {
                        promoMsg.innerHTML = `<span style="color: #16a34a; font-weight: 600;">✓ Áp dụng mã thành công! Giảm ${discountPercent}%</span>`;
                    }
                } else {
                    appliedPromotion = null;
                    if (promoMsg) {
                        promoMsg.innerHTML = `<span style="color: #ef4444;">${msg || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.'}</span>`;
                    }
                }
            } catch (err) {
                console.error("Lỗi áp dụng mã:", err);
                appliedPromotion = null;
                if (promoMsg) promoMsg.innerHTML = '<span style="color: #ef4444;">Không thể kết nối máy chủ.</span>';
            } finally {
                // 4. Cập nhật lại tổng tiền (giá gốc nếu lỗi)
                updateSummary();
            }
        });
    }

    // XỬ LÝ SUBMIT FORM ĐẶT PHÒNG
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const contactName = document.getElementById('b_name').value;
            const contactPhone = document.getElementById('b_phone').value;
            const contactEmail = document.getElementById('b_email').value;
            const note = document.getElementById('b_note').value;
            const numberOfGuests = parseInt(document.getElementById('b_guests').value) || 1;
            const submitBtn = document.querySelector('#bookingForm button[type="submit"]');

            if (singleCabinId && !cabinsParam) {
                selectedCabins[0].count = parseInt(document.getElementById('b_rooms').value) || 1;
            }

            try {
                let firstBookingId = null;
                let hasError = false;

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="icon-spinner icon-spin"></i> Đang xử lý...';
                }

                const orderBookingCode = "BKG" + Date.now() + Math.floor(Math.random() * 900 + 100);

                for (let i = 0; i < selectedCabins.length; i++) {
                    const sc = selectedCabins[i];
                    const payload = {
                        bookingCode: orderBookingCode,
                        scheduleId: parseInt(scheduleId),
                        cabinTypeId: sc.cabinTypeId,
                        numberOfRooms: sc.count,
                        numberOfGuests: i === 0 ? numberOfGuests : 1,
                        contactName,
                        contactPhone,
                        contactEmail,
                        note,
                        promotionCode: (appliedPromotion && appliedPromotion.code) ? appliedPromotion.code : null
                    };

                    const res = await fetch(`${API_URL}/Bookings`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });

                    let data = {};
                    try { data = await res.json(); } catch (e) { }

                    if (res.ok) {
                        if (!firstBookingId) firstBookingId = data.bookingId;
                    } else {
                        if (window.Popup) {
                            window.Popup.show('Lỗi', data.message || 'Lỗi đặt phòng', 'error');
                        } else {
                            alert(data.message || 'Lỗi đặt phòng');
                        }
                        hasError = true;
                        break;
                    }
                }

                if (!hasError) {
                    window.location.href = `/checkout.html?bookingCode=${orderBookingCode}`;
                } else if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Xác Nhận Đặt Phòng';
                }
            } catch (error) {
                console.error("Lỗi gửi booking:", error);
                if (window.Popup) {
                    window.Popup.show('Lỗi', 'Không thể kết nối máy chủ.', 'error');
                } else {
                    alert('Không thể kết nối máy chủ.');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Xác Nhận Đặt Phòng';
                }
            }
        });
    }
});