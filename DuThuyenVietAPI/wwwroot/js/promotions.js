// @ts-nocheck
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (!token) { window.location.replace('/login.html'); return; }

    let allPromotions = [];

    // Elements
    const grid = document.getElementById('promo-list');
    const modal = document.getElementById('promo-modal');
    const btnAdd = document.getElementById('btn-add-promo');
    const btnCancel = document.getElementById('btn-cancel-promo');
    const btnSave = document.getElementById('btn-save-promo');
    const chkPermanent = document.getElementById('promo-permanent');
    const promoEnd = document.getElementById('promo-end');
    const txtUsageLimit = document.getElementById('promo-usage-limit');

    // Toggle Permanent State
    const updatePermanentState = () => {
        if (!chkPermanent || !promoEnd) return;
        if (chkPermanent.checked) {
            promoEnd.value = '';
            promoEnd.disabled = true;
            promoEnd.style.opacity = '0.5';
            promoEnd.style.cursor = 'not-allowed';
            promoEnd.style.backgroundColor = '#f1f5f9';
        } else {
            promoEnd.disabled = false;
            promoEnd.style.opacity = '1';
            promoEnd.style.cursor = 'text';
            promoEnd.style.backgroundColor = '#ffffff';
        }
    };

    if (chkPermanent) {
        chkPermanent.addEventListener('change', updatePermanentState);
    }

    // Format Date for Input
    const formatForInput = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    // Format Date for Display
    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return 'Vĩnh viễn';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const loadPromotions = async () => {
        try {
            const res = await fetch('/api/Promotions/All', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) {
                let errorMsg = 'Lỗi tải dữ liệu. (' + res.status + ')';
                if (res.status === 403) errorMsg = 'Bạn không có quyền truy cập trang này (403).';
                if (res.status === 401) errorMsg = 'Chưa đăng nhập hoặc phiên đăng nhập hết hạn (401).';
                if (res.status === 404) errorMsg = 'Không tìm thấy API. Vui lòng kiểm tra xem Backend đã khởi động lại chưa (404).';
                grid.innerHTML = '<div style="text-align:center; padding: 40px; color: #ef4444; font-weight:600;">' + errorMsg + '</div>';
                return;
            }
            allPromotions = await res.json();
            renderPromotions();
        } catch {
            grid.innerHTML = '<div style="text-align:center; padding: 40px; color: #ef4444;">Lỗi kết nối máy chủ.</div>';
        }
    };

    const getStatusInfo = (p) => {
        if (!p.isActive) return { text: 'Tạm Khóa', class: 'status-inactive' };
        if (p.usageLimit && p.usedCount >= p.usageLimit) return { text: 'Hết Lượt', class: 'status-expired' };
        const now = new Date();
        const start = new Date(p.startDate);
        if (now < start) return { text: 'Chưa Tới Hạn', class: 'status-expired' };
        if (!p.endDate) return { text: 'Đang Hoạt Động', class: 'status-active' };
        const end = new Date(p.endDate);
        if (now > end) return { text: 'Đã Hết Hạn', class: 'status-expired' };
        return { text: 'Đang Hoạt Động', class: 'status-active' };
    };

    const renderPromotions = () => {
        if (allPromotions.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
                    <div style="margin-bottom: 16px;"><img src="/images/icons/voucher.png" class="app-icon-xl" alt=""></div>
                    <h3 style="font-family: 'Playfair Display', serif; color: #0f172a; margin-bottom: 8px;">Chưa có mã giảm giá nào</h3>
                    <p style="color: #64748b; font-size: 0.95rem;">Nhấn nút "+ Thêm Mã Khuyến Mãi" ở trên để tạo mới.</p>
                </div>`;
            return;
        }

        grid.innerHTML = allPromotions.map(p => {
            const status = getStatusInfo(p);
            const isPermanent = !p.endDate;

            return `
            <div class="promo-ticket">
                <div class="promo-left">
                    <div class="discount-value">${p.discountPercent}%</div>
                    <div class="discount-label">GIẢM GIÁ</div>
                </div>
                <div class="promo-right">
                    <div class="promo-code-wrap" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
                            <div class="promo-code" style="word-break: break-all; overflow-wrap: anywhere; line-height: 1.25;" title="${p.code}">${p.code}</div>
                            ${isPermanent ? '<span style="align-self: flex-start; background: #ccfbf1; color: #0f766e; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; white-space: nowrap;">∞ Vĩnh viễn</span>' : ''}
                        </div>
                        <div class="promo-status ${status.class}" style="flex-shrink: 0; white-space: nowrap; margin-left: auto;">${status.text}</div>
                    </div>
                    <div class="promo-desc">${p.description || '<span style="color:#cbd5e1; font-style:italic;">Không có mô tả</span>'}</div>
                    <div class="promo-dates">
                        <span><img src="/images/icons/departure-calendar.png" class="app-icon-sm" alt=""> ${formatDisplayDate(p.startDate)}</span>
                        <span><img src="/images/icons/arrow-square-right.png" class="app-icon-sm" alt="→"></span>
                        ${p.endDate ? `<span>${formatDisplayDate(p.endDate)}</span>` : `<span style="color: #0f766e; font-weight: 600;">Không có ngày hết hạn</span>`}
                    </div>
                    <div class="promo-usage-meta" style="margin-top: 8px; font-size: 13px; color: #475569; display: flex; align-items: center; gap: 8px;">
                        <img src="/images/icons/ticket.png" class="app-icon-sm" alt="">
                        <span>Lượt dùng: <strong style="color: #0f766e;">${p.usedCount || 0}</strong>${p.usageLimit ? ` / <strong>${p.usageLimit}</strong> lượt` : ' <em>(Không giới hạn)</em>'}</span>
                    </div>
                    <div class="promo-actions">
                        <button class="btn-sm-action btn-edit-sm" onclick="editPromo(${p.promotionId})"><img src="/images/icons/edit-pencil.png" class="app-icon" alt=""> Chỉnh sửa</button>
                        <button class="btn-sm-action btn-delete-sm" onclick="deletePromo(${p.promotionId})"><img src="/images/icons/delete-trash.png" class="app-icon" alt=""> Xóa</button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    };

    // UI Interactions
    btnAdd.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('modal-title').innerHTML = '<img src="/images/icons/special-offer.png" class="app-icon" alt=""> Thêm Mã Giảm Giá';
        document.getElementById('promo-id').value = '';
        document.getElementById('promo-code').value = '';
        document.getElementById('promo-discount').value = '';
        document.getElementById('promo-start').value = '';
        document.getElementById('promo-end').value = '';
        if (txtUsageLimit) txtUsageLimit.value = '';
        if (chkPermanent) chkPermanent.checked = false;
        updatePermanentState();
        document.getElementById('promo-desc').value = '';
        document.getElementById('promo-status').value = '1';
        modal.classList.add('active');
        if (window.LottieEffects) window.LottieEffects.initAuto();
    });

    btnCancel.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('active');
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    window.editPromo = (id) => {
        const p = allPromotions.find(x => x.promotionId === id);
        if (!p) return;
        document.getElementById('modal-title').innerHTML = '<img src="/images/icons/edit-pencil.png" class="app-icon" alt=""> Chỉnh sửa Mã Giảm Giá';
        document.getElementById('promo-id').value = p.promotionId;
        document.getElementById('promo-code').value = p.code;
        document.getElementById('promo-discount').value = p.discountPercent;
        document.getElementById('promo-start').value = formatForInput(p.startDate);
        if (txtUsageLimit) txtUsageLimit.value = p.usageLimit || '';
        
        const isPermanent = !p.endDate;
        if (chkPermanent) {
            chkPermanent.checked = isPermanent;
            updatePermanentState();
        }
        if (!isPermanent) {
            document.getElementById('promo-end').value = formatForInput(p.endDate);
        } else {
            document.getElementById('promo-end').value = '';
        }
        
        document.getElementById('promo-desc').value = p.description || '';
        document.getElementById('promo-status').value = p.isActive ? '1' : '0';
        modal.classList.add('active');
        if (window.LottieEffects) window.LottieEffects.initAuto();
    };

    window.deletePromo = (id) => {
        Popup.confirm('Xóa Khuyến Mãi', 'Bạn có chắc muốn xóa mã giảm giá này? Hành động này không thể hoàn tác.', async () => {
            try {
                const res = await fetch(`/api/Promotions/${id}`, {
                    method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    Popup.show('Thành công', 'Đã xóa mã khuyến mãi.', 'success');
                    loadPromotions();
                } else {
                    Popup.show('Lỗi', 'Không thể xóa mã khuyến mãi.', 'error');
                }
            } catch { Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error'); }
        });
    };

    btnSave.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = document.getElementById('promo-id').value;
        const code = document.getElementById('promo-code').value.trim();
        const discount = parseInt(document.getElementById('promo-discount').value);
        const start = document.getElementById('promo-start').value;
        const end = document.getElementById('promo-end').value;
        const isPermanent = chkPermanent ? chkPermanent.checked : false;
        const usageLimitVal = txtUsageLimit && txtUsageLimit.value ? parseInt(txtUsageLimit.value) : null;

        if (!code || isNaN(discount) || !start || (!isPermanent && !end)) {
            Popup.show('Thiếu thông tin', 'Vui lòng nhập đầy đủ Mã, % Giảm giá và Thời gian áp dụng.', 'error');
            return;
        }

        const data = {
            code,
            discountPercent: discount,
            description: document.getElementById('promo-desc').value.trim(),
            startDate: start,
            endDate: isPermanent ? null : end,
            isPermanent: isPermanent,
            usageLimit: usageLimitVal && usageLimitVal > 0 ? usageLimitVal : null,
            isActive: document.getElementById('promo-status').value === '1'
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/Promotions/${id}` : '/api/Promotions';
        btnSave.disabled = true;
        btnSave.innerText = 'Đang lưu...';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                Popup.show('Thành công', id ? 'Đã cập nhật mã giảm giá.' : 'Đã tạo mã giảm giá mới.', 'success');
                modal.classList.remove('active');
                loadPromotions();
            } else {
                let msg = 'Lỗi lưu mã giảm giá.';
                try { const errObj = await res.json(); msg = errObj.message || msg; } catch {}
                Popup.show('Lỗi', msg, 'error');
            }
        } catch { Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error'); }
        finally {
            btnSave.disabled = false;
            btnSave.innerHTML = '<img src="/images/icons/save.png" class="app-icon" alt=""> Lưu Khuyến Mãi';
        }
    });

    loadPromotions();
});
