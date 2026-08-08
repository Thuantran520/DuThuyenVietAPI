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
            document.getElementById('b_email').value = profileData.email || profileData.Email || '';
            const fName = profileData.fullName || profileData.FullName || profileData.userName || profileData.UserName || '';
            if(fName !== 'Chưa cập nhật') document.getElementById('b_name').value = fName;
            const pPhone = profileData.phoneNumber || profileData.PhoneNumber || '';
            if(pPhone !== 'Chưa cập nhật') document.getElementById('b_phone').value = pPhone;
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
    
    // Fix layout flash: Hide 'Số lượng phòng' immediately if using cabinsParam
    const tripInfoRow = document.getElementById('trip-info-row');
    const roomWrapper = document.getElementById('room-count-wrapper');
    
    if (!singleCabinId || cabinsParam) {
        roomWrapper.style.display = 'none';
    }
    
    // Reveal trip-info-row now that styles are adjusted
    tripInfoRow.style.display = 'grid';

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

    try {
        const res = await fetch(`${API_URL}/Cruises/${cruiseId}`);
        if (!res.ok) throw new Error('Failed to load');
        const cruise = await res.json();

        // Update breadcrumbs dynamically
        const bcCruiseLink = document.getElementById('bc-cruise-link');
        const bcCruiseActive = document.getElementById('bc-cruise-active');
        if (bcCruiseLink && bcCruiseActive) {
            bcCruiseLink.href = `/cruise-detail.html?id=${cruiseId}`;
            bcCruiseLink.innerText = cruise.name || 'Chi tiết du thuyền';
            bcCruiseActive.innerText = 'Đặt phòng';
        }

        const updateSummary = () => {
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
                    if (singleCabinId && !cabinsParam) {
                        currentCount = parseInt(document.getElementById('b_rooms').value) || 1;
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

            summaryHtml += `
                <hr class="my-3">
                <h4 class="mt-3">Tổng cộng: <span class="text-danger">${formatPrice(totalAmount)}</span></h4>
            `;
            
            document.getElementById('bookingSummary').innerHTML = summaryHtml;
        };

        updateSummary();
        const bRooms = document.getElementById('b_rooms');
        if (bRooms) bRooms.addEventListener('input', updateSummary);
        const bGuests = document.getElementById('b_guests');
        if (bGuests) bGuests.addEventListener('input', updateSummary);

    } catch (e) {
        document.getElementById('bookingSummary').innerHTML = '<p class="text-danger">Không thể tải thông tin chuyến đi.</p>';
    }

    document.getElementById('bookingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const contactName = document.getElementById('b_name').value;
        const contactPhone = document.getElementById('b_phone').value;
        const contactEmail = document.getElementById('b_email').value;
        const note = document.getElementById('b_note').value;
        const numberOfGuests = parseInt(document.getElementById('b_guests').value);

        // Re-read rooms for single mode
        if (singleCabinId && !cabinsParam) {
            selectedCabins[0].count = parseInt(document.getElementById('b_rooms').value) || 1;
        }

        try {
            let firstBookingId = null;
            let hasError = false;
            
            const submitBtn = document.querySelector('#bookingForm button[type="submit"]');
            if(submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="icon-spinner icon-spin"></i> Đang xử lý...';
            }
            
            // Generate a single BookingCode for the entire order
            const orderBookingCode = "BKG" + Date.now() + Math.floor(Math.random() * 900 + 100);

            for (let i = 0; i < selectedCabins.length; i++) {
                const sc = selectedCabins[i];
                const payload = {
                    bookingCode: orderBookingCode,
                    scheduleId: parseInt(scheduleId),
                    cabinTypeId: sc.cabinTypeId,
                    numberOfRooms: sc.count,
                    numberOfGuests: i === 0 ? numberOfGuests : 1, // Allocate guests to first booking
                    contactName,
                    contactPhone,
                    contactEmail,
                    note
                };

                const res = await fetch(`${API_URL}/Bookings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                    if (!firstBookingId) firstBookingId = data.bookingId;
                } else {
                    window.Popup.show('Lỗi', data.message || 'Lỗi đặt phòng', 'error');
                    hasError = true;
                    if(submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = 'Xác nhận đặt phòng';
                    }
                    break;
                }
            }
            
            if (!hasError) {
                window.location.href = `/checkout.html?bookingCode=${orderBookingCode}`;
            }
        } catch (error) {
            window.Popup.show('Lỗi', 'Không thể kết nối máy chủ.', 'error');
        }
    });
});
