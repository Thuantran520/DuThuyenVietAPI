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

    // Format Date for Input
    const formatForInput = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    // Format Date for Display
    const formatDisplayDate = (dateStr) => {
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
        const now = new Date();
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        if (now < start) return { text: 'Chưa Tới Hạn', class: 'status-expired' };
        if (now > end) return { text: 'Đã Hết Hạn', class: 'status-expired' };
        return { text: 'Đang Hoạt Động', class: 'status-active' };
    };

    const renderPromotions = () => {
        if (allPromotions.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">🎟️</div>
                    <h3 style="font-family: 'Playfair Display', serif; color: #0f172a; margin-bottom: 8px;">Chưa có mã giảm giá nào</h3>
                    <p style="color: #64748b; font-size: 0.95rem;">Nhấn nút "+ Thêm Mã Khuyến Mãi" ở trên để tạo mới.</p>
                </div>`;
            return;
        }

        grid.innerHTML = allPromotions.map(p => {
            const status = getStatusInfo(p);
            return `
            <div class="promo-ticket">
                <div class="promo-left">
                    <div class="discount-value">${p.discountPercent}%</div>
                    <div class="discount-label">GIẢM GIÁ</div>
                </div>
                <div class="promo-right">
                    <div class="promo-code-wrap">
                        <div class="promo-code">${p.code}</div>
                        <div class="promo-status ${status.class}">${status.text}</div>
                    </div>
                    <div class="promo-desc">${p.description || '<span style="color:#cbd5e1; font-style:italic;">Không có mô tả</span>'}</div>
                    <div class="promo-dates">
                        <span>🗓️ ${formatDisplayDate(p.startDate)}</span>
                        <span>➡️</span>
                        <span>${formatDisplayDate(p.endDate)}</span>
                    </div>
                    <div class="promo-actions">
                        <button class="btn-sm-action btn-edit-sm" onclick="editPromo(${p.promotionId})">✏️ Chỉnh sửa</button>
                        <button class="btn-sm-action btn-delete-sm" onclick="deletePromo(${p.promotionId})">🗑️ Xóa</button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    };

    // UI Interactions
    btnAdd.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('modal-title').innerText = '✨ Thêm Mã Giảm Giá';
        document.getElementById('promo-id').value = '';
        document.getElementById('promo-code').value = '';
        document.getElementById('promo-discount').value = '';
        document.getElementById('promo-start').value = '';
        document.getElementById('promo-end').value = '';
        document.getElementById('promo-desc').value = '';
        document.getElementById('promo-status').value = '1';
        modal.classList.add('active');
    });

    btnCancel.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('active');
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    window.editPromo = (id) => {
        const p = allPromotions.find(x => x.promotionId === id);
        if (!p) return;
        document.getElementById('modal-title').innerText = '✏️ Chỉnh sửa Mã Giảm Giá';
        document.getElementById('promo-id').value = p.promotionId;
        document.getElementById('promo-code').value = p.code;
        document.getElementById('promo-discount').value = p.discountPercent;
        document.getElementById('promo-start').value = formatForInput(p.startDate);
        document.getElementById('promo-end').value = formatForInput(p.endDate);
        document.getElementById('promo-desc').value = p.description || '';
        document.getElementById('promo-status').value = p.isActive ? '1' : '0';
        modal.classList.add('active');
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

        if (!code || isNaN(discount) || !start || !end) {
            Popup.show('Thiếu thông tin', 'Vui lòng nhập đầy đủ Mã, % Giảm giá và Thời gian.', 'error');
            return;
        }

        const data = {
            code,
            discountPercent: discount,
            description: document.getElementById('promo-desc').value.trim(),
            startDate: start,
            endDate: end,
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
                try { const e = await res.json(); msg = e.message || msg; } catch {}
                Popup.show('Lỗi', msg, 'error');
            }
        } catch { Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error'); }
        finally {
            btnSave.disabled = false;
            btnSave.innerText = '💾 Lưu Khuyến Mãi';
        }
    });

    loadPromotions();
});
