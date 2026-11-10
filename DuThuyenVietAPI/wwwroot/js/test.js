// @ts-nocheck
const grp = {
    contactName: "Test Name",
    contactPhone: "0123456789",
    cruiseName: "Test Cruise",
    departureDate: "2026-08-10T00:00:00",
    totalPrice: 1000000,
    items: [
        {
            status: "Confirmed",
            createdAt: "2026-08-01T00:00:00",
            cabinName: "Test Cabin",
            numberOfRooms: 1,
            totalPrice: 1000000
        }
    ]
};
const formatPrice = (p) => p + " VND";
let firstItem = (grp.items && grp.items.length > 0) ? grp.items[0] : grp;
let approver = (firstItem.status === 'Confirmed' || firstItem.status === 'Cancelled') ? 'Admin (Hệ thống)' : 'Chưa duyệt';
let html = `
<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; background:#f8fafc; border-radius:10px; padding:14px 16px; margin-bottom:16px; font-size:0.95rem;">
    <div><span style="color:#64748b;">Khách hàng</span><br><strong>${grp.contactName}</strong></div>
    <div><span style="color:#64748b;"><img src="/images/icons/phone-hotline.png" class="app-icon" alt=""> Điện thoại</span><br><strong>${grp.contactPhone}</strong></div>
    <div><span style="color:#64748b;"><img src="/images/icons/ship-front.png" class="app-icon" alt=""> Du thuyền</span><br><strong>${grp.cruiseName}</strong></div>
    <div><span style="color:#64748b;">Khởi hành</span><br><strong>${new Date(grp.departureDate).toLocaleDateString('vi-VN')}</strong></div>
    <div><span style="color:#64748b;"><img src="/images/icons/clock.png" class="app-icon" alt=""> Ngày giờ tạo</span><br><strong>${new Date(firstItem.createdAt).toLocaleString('vi-VN')}</strong></div>
    <div><span style="color:#64748b;"><img src="/images/icons/staff.png" class="app-icon" alt=""> Người duyệt</span><br><strong>${approver}</strong></div>
    ${grp.contactEmail ? `<div style="grid-column:1/-1;"><span style="color:#64748b;"><img src="/images/icons/email-at.png" class="app-icon" alt=""> Email</span><br><strong>${grp.contactEmail}</strong></div>` : ''}
    ${grp.note ? `<div style="grid-column:1/-1;"><span style="color:#64748b;"><img src="/images/icons/note-edit.png" class="app-icon" alt=""> Ghi chú</span><br><em style="color:#334155;">${grp.note}</em></div>` : ''}
</div>`;
console.log(html);
