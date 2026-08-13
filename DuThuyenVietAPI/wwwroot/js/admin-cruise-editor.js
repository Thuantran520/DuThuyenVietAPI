document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (!token) { window.location.replace('/login.html'); return; }

    const urlParams = new URLSearchParams(window.location.search);
    const cruiseId = urlParams.get('id');
    const isEdit = !!cruiseId;
    let isCruiseActive = true; // Mặc định là đang hoạt động

    const formatPrice = p => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

    // ==========================================
    // 0. LOAD DESTINATIONS (dynamic)
    // ==========================================
    let currentUserRoles = [];

    async function initPage() {
        // Get user roles from token
        try {
            const res = await fetch('/api/account/profile', { headers: { 'Authorization': 'Bearer ' + token } });
            if (res.ok) {
                const profile = await res.json();
                currentUserRoles = profile.roles || profile.Roles || [];
            }
        } catch { }

        const isAdminOrManager = currentUserRoles.some(r => r === 'Admin' || r === 'Manager');

        // Show "+ Thêm khu vực" button only for Admin/Manager
        const btnAddDest = document.getElementById('btn-add-dest');
        if (isAdminOrManager && btnAddDest) {
            btnAddDest.style.display = 'inline-block';
        }

        // Load destinations from API
        await loadDestinations();

        // Then load cruise data and sections
        if (isEdit) {
            const editorTitle = document.getElementById('editor-title');
            if (editorTitle) editorTitle.innerText = 'Chỉnh sửa Du Thuyền';

            await loadCruise(cruiseId);

            const secCabins = document.getElementById('section-cabins');
            const secSchedules = document.getElementById('section-schedules');
            if (secCabins) secCabins.style.display = 'block';
            if (secSchedules) secSchedules.style.display = 'block';

            loadCabins();
            loadSchedules();
        }
    }

    async function loadDestinations(selectedId = null) {
        try {
            const res = await fetch('/api/Destinations');
            if (!res.ok) return;
            const dests = await res.json();
            const select = document.getElementById('edit-dest');
            if (!select) return;
            select.innerHTML = dests.map(d =>
                `<option value="${d.destinationId}">${d.name}</option>`
            ).join('');
            if (selectedId) select.value = selectedId;
        } catch {
            // fallback hardcode nếu API lỗi
            const select = document.getElementById('edit-dest');
            if (select) {
                select.innerHTML = `
                    <option value="1">Vịnh Hạ Long</option>
                    <option value="2">Vịnh Lan Hạ</option>
                `;
            }
        }
    }

    // "+ Thêm khu vực" button → open modal
    const btnAddDest = document.getElementById('btn-add-dest');
    if (btnAddDest) {
        btnAddDest.addEventListener('click', () => {
            document.getElementById('dest-name').value = '';
            document.getElementById('dest-desc').value = '';
            document.getElementById('dest-modal').classList.add('active');
        });
    }

    // Save new destination
    const btnSaveDest = document.getElementById('btn-save-dest');
    if (btnSaveDest) {
        btnSaveDest.addEventListener('click', async () => {
            const name = document.getElementById('dest-name').value.trim();
            if (!name) { Popup.show('Thiếu thông tin', 'Vui lòng nhập tên khu vực.', 'error'); return; }

            btnSaveDest.innerText = 'Đang lưu...'; btnSaveDest.disabled = true;
            try {
                const res = await fetch('/api/Destinations', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description: document.getElementById('dest-desc').value.trim(), imageUrl: '' })
                });
                if (res.ok) {
                    const newDest = await res.json();
                    document.getElementById('dest-modal').classList.remove('active');
                    Popup.show('Thành công', `Đã tạo khu vực "${newDest.name}"!`, 'success');
                    await loadDestinations(newDest.destinationId); // reload & auto-select new
                } else {
                    let msg = 'Lỗi tạo khu vực.';
                    try { const e = await res.json(); msg = e.message || msg; } catch { }
                    Popup.show('Lỗi', msg, 'error');
                }
            } catch { Popup.show('Lỗi', 'Lỗi kết nối.', 'error'); }
            finally { btnSaveDest.innerText = '💾 Tạo Khu Vực'; btnSaveDest.disabled = false; }
        });
    }

    // Delete destination
    const btnDelDest = document.getElementById('btn-del-dest');
    if (btnDelDest) {
        btnDelDest.addEventListener('click', () => {
            const select = document.getElementById('edit-dest');
            if (!select) return;
            const destId = select.value;
            const destName = select.options[select.selectedIndex]?.text;
            if (!destId) return;

            Popup.confirm('Xóa khu vực', `Bạn có chắc chắn muốn xóa khu vực "${destName}"? Các du thuyền thuộc khu vực này có thể bị ảnh hưởng.`, async () => {
                try {
                    const res = await fetch(`/api/Destinations/${destId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (res.ok) {
                        Popup.show('Thành công', 'Đã xóa khu vực.', 'success');
                        await loadDestinations();
                    } else {
                        let msg = 'Lỗi xóa khu vực.';
                        try { const e = await res.json(); msg = e.message || msg; } catch { }
                        Popup.show('Lỗi', msg, 'error');
                    }
                } catch {
                    Popup.show('Lỗi', 'Lỗi kết nối.', 'error');
                }
            });
        });
    }

    const btnSaveCruise = document.getElementById('btn-save-cruise');
    if (btnSaveCruise) btnSaveCruise.addEventListener('click', saveCruise);

    // Toggle Maintenance
    const btnToggleMaint = document.getElementById('btn-toggle-maintenance');
    if (btnToggleMaint) {
        btnToggleMaint.addEventListener('click', () => {
            isCruiseActive = !isCruiseActive;
            updateMaintenanceBtn();
            Popup.show('Đã đổi trạng thái', 'Vui lòng nhấn "Lưu Thông Tin" để xác nhận trạng thái mới trên máy chủ.', 'success');
        });
    }

    function updateMaintenanceBtn() {
        const btn = document.getElementById('btn-toggle-maintenance');
        if (!btn) return;
        if (!isEdit) {
            btn.style.display = 'none';
            return;
        }
        btn.style.display = 'inline-flex';
        if (isCruiseActive) {
            btn.className = 'btn btn-outline';
            btn.innerHTML = '🔴 Đưa vào Bảo Trì';
            btn.style.background = '';
            btn.style.color = '';
        } else {
            btn.className = 'btn btn-primary';
            btn.innerHTML = '🟢 Bật Hoạt Động Lại';
            btn.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
            btn.style.color = 'white';
        }
    }

    // Start init
    initPage();

    async function loadCruise(id) {
        try {
            const res = await fetch(`/api/Cruises/${id}`);
            if (!res.ok) { Popup.show('Lỗi', 'Không tìm thấy du thuyền.', 'error'); return; }
            const c = await res.json();
            document.getElementById('edit-name').value = c.name || '';
            document.getElementById('edit-dest').value = c.destinationId || '1';
            document.getElementById('edit-cabins').value = c.totalCabins || 20;
            document.getElementById('edit-shortdesc').value = c.shortDescription || '';
            document.getElementById('edit-desc').value = c.description || '';
            const thumbUrl = c.thumbnailUrl || (c.images && c.images.length > 0 ? c.images[0] : '');
            document.getElementById('edit-thumb').value = thumbUrl;

            const previewThumb = document.getElementById('preview-thumb');
            if (previewThumb) previewThumb.src = thumbUrl || '/images/default-cruise.jpg';

            isCruiseActive = c.isActive !== undefined ? c.isActive : true;
            updateMaintenanceBtn();
        } catch (err) {
            Popup.show('Lỗi', 'Lỗi tải dữ liệu du thuyền.', 'error');
        }
    }

    // ==========================================
    // UPLOAD FILE ẢNH
    // ==========================================
    async function uploadCruiseImages(targetCruiseId) {
        const thumbInput = document.getElementById('input-thumbnail');
        const galleryInput = document.getElementById('input-gallery');

        const thumbFile = thumbInput ? thumbInput.files[0] : null;
        const galleryFiles = galleryInput ? Array.from(galleryInput.files) : [];

        // Validate Client-side
        if (thumbFile && thumbFile.size > 5 * 1024 * 1024) {
            Popup.show('Lỗi file', 'Ảnh đại diện vượt quá dung lượng cho phép (tối đa 5MB).', 'error');
            return false;
        }

        if (galleryFiles.length > 0) {
            if (galleryFiles.length > 5) {
                Popup.show('Lỗi file', 'Chỉ được chọn tối đa 5 ảnh cho thư viện.', 'error');
                return false;
            }
            const totalSize = galleryFiles.reduce((sum, f) => sum + f.size, 0);
            if (totalSize > 50 * 1024 * 1024) {
                Popup.show('Lỗi file', 'Tổng dung lượng thư viện ảnh vượt quá 50MB.', 'error');
                return false;
            }
        }

        // Nếu người dùng không chọn file nào mới thì bỏ qua
        if (!thumbFile && galleryFiles.length === 0) return true;

        const formData = new FormData();
        if (thumbFile) formData.append('thumbnail', thumbFile);
        galleryFiles.forEach(f => formData.append('gallery', f));

        try {
            const res = await fetch(`/api/Cruises/upload-images/${targetCruiseId}`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            });

            if (res.ok) {
                return true;
            } else {
                let msg = 'Không thể tải ảnh lên server.';
                try {
                    const errorText = await res.text();
                    if (errorText) msg = errorText;
                } catch { }
                Popup.show('Lỗi Upload', msg, 'error');
                return false;
            }
        } catch (err) {
            Popup.show('Lỗi', 'Không thể kết nối đến API Upload ảnh.', 'error');
            return false;
        }
    }

    async function saveCruise() {
        const btn = document.getElementById('btn-save-cruise');
        if (!btn) return;
        const origText = btn.innerText;
        btn.innerText = 'Đang lưu...'; btn.disabled = true;

        try {
            // 1. Nếu đang ở trang Sửa -> Upload ảnh trước để lưu file vật lý vào thư mục backend
            if (isEdit) {
                const uploadSuccess = await uploadCruiseImages(cruiseId);
                if (!uploadSuccess) {
                    btn.innerText = origText; btn.disabled = false;
                    return;
                }
            }

            // 2. Chuẩn bị dữ liệu form
            const data = {
                destinationId: parseInt(document.getElementById('edit-dest').value) || 1,
                name: document.getElementById('edit-name').value.trim(),
                totalCabins: parseInt(document.getElementById('edit-cabins').value) || 20,
                shortDescription: document.getElementById('edit-shortdesc').value.trim(),
                description: document.getElementById('edit-desc').value.trim(),
                thumbnailUrl: document.getElementById('edit-thumb').value.trim(),
                isActive: isCruiseActive
            };

            if (!data.name) {
                Popup.show('Thiếu thông tin', 'Vui lòng nhập tên du thuyền.', 'error');
                btn.innerText = origText; btn.disabled = false;
                return;
            }

            const method = isEdit ? 'PUT' : 'POST';
            const url = isEdit ? `/api/Cruises/${cruiseId}` : '/api/Cruises';

            const res = await fetch(url, {
                method,
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                const saved = await res.json();
                const activeCruiseId = isEdit ? cruiseId : (saved.cruiseId || saved.CruiseId);

                if (!isEdit) {
                    // Nếu là Tạo mới -> Upload ảnh sau khi đã có Cruise ID từ Database
                    await uploadCruiseImages(activeCruiseId);
                    Popup.show('Thành công', 'Tạo du thuyền thành công! Bạn có thể thêm phòng và lịch trình ngay bây giờ.', 'success');
                    setTimeout(() => { window.location.href = `/admin/cruise-editor.html?id=${activeCruiseId}`; }, 1000);
                } else {
                    Popup.show('Thành công', 'Đã cập nhật thông tin thành công!', 'success');
                    await loadCruise(activeCruiseId); // Reload lại thông tin giao diện
                }
            } else {
                let errorMsg = 'Lỗi không xác định.';
                try { const e = await res.json(); errorMsg = e.message || e.title || JSON.stringify(e); } catch { }
                Popup.show('Lỗi', 'Lưu thất bại: ' + errorMsg, 'error');
            }
        } catch (err) {
            Popup.show('Lỗi', 'Lỗi kết nối đến máy chủ.', 'error');
        } finally {
            btn.innerText = origText; btn.disabled = false;
        }
    }

    // ==========================================
    // 2. CABIN TYPES
    // ==========================================
    async function loadCabins() {
        if (!cruiseId) return;
        try {
            const res = await fetch(`/api/CabinTypes?cruiseId=${cruiseId}`);
            if (!res.ok) return;
            const cabins = await res.json();
            window.currentCabins = cabins; // Lưu lại để validate
            renderCabins(cabins);
        } catch { }
    }

    function renderCabins(cabins) {
        const grid = document.getElementById('cabin-list');
        if (!grid) return;
        if (!cabins || cabins.length === 0) {
            grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛏️</div><p>Chưa có loại phòng nào.<br>Nhấn <strong>"+ Thêm Loại Phòng"</strong> để bắt đầu.</p></div>`;
            return;
        }
        grid.innerHTML = cabins.map(c => `
            <div class="cabin-card-admin">
                <div class="cabin-card-img-wrapper">
                    <img src="${c.imageUrl || '/images/default-cruise.jpg'}" alt="${c.name}" onerror="this.src='/images/default-cruise.jpg'">
                </div>
                <div class="cabin-card-content">
                    <div class="cabin-card-header">
                        <div class="cabin-card-title">${c.name}</div>
                        <div class="cabin-card-price">${formatPrice(c.basePrice)}<span class="price-unit">/đêm</span></div>
                    </div>
                    <div class="cabin-card-details">
                        <span class="detail-item">👥 Sức chứa: <strong>${c.maxOccupancy} khách</strong></span>
                        <span class="detail-divider">•</span>
                        <span class="detail-item">🚪 Tổng: <strong>${c.totalRooms} phòng</strong></span>
                    </div>
                    <div class="cabin-card-desc">${c.description ? c.description.substring(0, 120) + '...' : '<span style="color:#94a3b8;font-style:italic;">Chưa có mô tả</span>'}</div>
                    <div class="cabin-card-actions">
                        <button class="btn-sm-action btn-edit-sm" onclick="openEditCabinById(${c.cabinTypeId})">✏️ Sửa thông tin</button>
                        <button class="btn-sm-action btn-delete-sm" onclick="deleteCabin(${c.cabinTypeId})">🗑️ Xóa</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Open cabin modal for ADD
    const btnAddCabin = document.getElementById('btn-add-cabin');
    if (btnAddCabin) {
        btnAddCabin.addEventListener('click', () => {
            document.getElementById('cabin-modal-title').innerText = 'Thêm Loại Phòng';
            document.getElementById('cabin-id').value = '';
            document.getElementById('cabin-name').value = '';
            document.getElementById('cabin-occupancy').value = 2;
            document.getElementById('cabin-rooms').value = 5;
            document.getElementById('cabin-price').value = 0;
            document.getElementById('cabin-desc').value = '';
            document.getElementById('cabin-image').value = '';
            document.getElementById('cabin-modal').classList.add('active');
        });
    }

    // Open cabin modal for EDIT safely using ID
    window.openEditCabinById = function (cabinTypeId) {
        if (!window.currentCabins) return;
        const c = window.currentCabins.find(item => item.cabinTypeId === cabinTypeId);
        if (!c) return;
        window.openEditCabin(c);
    };

    window.openEditCabin = function (c) {
        document.getElementById('cabin-modal-title').innerText = 'Chỉnh sửa Loại Phòng';
        document.getElementById('cabin-id').value = c.cabinTypeId;
        document.getElementById('cabin-name').value = c.name;
        document.getElementById('cabin-occupancy').value = c.maxOccupancy;
        document.getElementById('cabin-rooms').value = c.totalRooms;
        document.getElementById('cabin-price').value = c.basePrice;
        document.getElementById('cabin-desc').value = c.description || '';
        document.getElementById('cabin-image').value = c.imageUrl || '';
        document.getElementById('cabin-modal').classList.add('active');
    };

    const btnSaveCabin = document.getElementById('btn-save-cabin');
    if (btnSaveCabin) {
        btnSaveCabin.addEventListener('click', async () => {
            const cabinId = document.getElementById('cabin-id').value;
            const data = {
                cruiseId: parseInt(cruiseId),
                name: document.getElementById('cabin-name').value.trim(),
                description: document.getElementById('cabin-desc').value.trim(),
                maxOccupancy: parseInt(document.getElementById('cabin-occupancy').value) || 2,
                basePrice: parseFloat(document.getElementById('cabin-price').value) || 0,
                totalRooms: parseInt(document.getElementById('cabin-rooms').value) || 1,
                imageUrl: document.getElementById('cabin-image').value.trim()
            };

            if (!data.name) { Popup.show('Thiếu thông tin', 'Vui lòng nhập tên loại phòng.', 'error'); return; }

            // Kiểm tra hợp lệ tổng số phòng (Validation)
            const maxCruiseRooms = parseInt(document.getElementById('edit-cabins').value) || 0;
            let currentTotalRooms = 0;
            if (window.currentCabins) {
                currentTotalRooms = window.currentCabins
                    .filter(c => c.cabinTypeId != cabinId) // Không cộng dồn phòng đang sửa
                    .reduce((sum, c) => sum + c.totalRooms, 0);
            }

            if (currentTotalRooms + data.totalRooms > maxCruiseRooms) {
                Popup.show('Lỗi dữ liệu', `Tổng số phòng của các loại phòng (${currentTotalRooms + data.totalRooms}) vượt quá số phòng của Du thuyền (${maxCruiseRooms}). Vui lòng điều chỉnh lại!`, 'error');
                return;
            }

            const method = cabinId ? 'PUT' : 'POST';
            const url = cabinId ? `/api/CabinTypes/${cabinId}` : '/api/CabinTypes';

            try {
                const res = await fetch(url, {
                    method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    document.getElementById('cabin-modal').classList.remove('active');
                    Popup.show('Thành công', cabinId ? 'Đã cập nhật loại phòng!' : 'Đã thêm loại phòng!', 'success');
                    loadCabins();
                } else {
                    let msg = 'Lỗi lưu.'; try { const e = await res.json(); msg = e.message || msg; } catch { }
                    Popup.show('Lỗi', msg, 'error');
                }
            } catch { Popup.show('Lỗi', 'Lỗi kết nối.', 'error'); }
        });
    }

    window.deleteCabin = function (id) {
        Popup.confirm('Xác nhận xóa', 'Bạn có chắc muốn xóa loại phòng này? Hành động không thể hoàn tác.', async () => {
            try {
                const res = await fetch(`/api/CabinTypes/${id}`, {
                    method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) { Popup.show('Đã xóa', 'Xóa loại phòng thành công.', 'success'); loadCabins(); }
                else Popup.show('Lỗi', 'Không thể xóa loại phòng.', 'error');
            } catch { Popup.show('Lỗi', 'Lỗi kết nối.', 'error'); }
        });
    };

    // ==========================================
    // 3. SCHEDULES
    // ==========================================
    async function loadSchedules() {
        try {
            const res = await fetch(`/api/Schedules?cruiseId=${cruiseId}`);
            if (!res.ok) return;
            const schedules = await res.json();
            window.currentSchedules = schedules;
            renderSchedules(schedules);
        } catch { }
    }

    function renderSchedules(schedules) {
        const tbody = document.getElementById('schedule-list');
        if (!tbody) return;
        if (!schedules || schedules.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:40px;"><div style="font-size:2rem; margin-bottom:8px;">🗓️</div>Chưa có lịch trình nào.</td></tr>`;
            return;
        }

        const statusBadge = s => {
            if (s === 'Available') return `<span class="badge-available">Còn chỗ</span>`;
            if (s === 'Full') return `<span class="badge-full">Đầy chỗ</span>`;
            return `<span class="badge-closed">Đã đóng</span>`;
        };

        tbody.innerHTML = schedules.map(s => `
            <tr>
                <td><strong>${new Date(s.departureDate).toLocaleDateString('vi-VN')}</strong></td>
                <td>${new Date(s.returnDate).toLocaleDateString('vi-VN')}</td>
                <td><span style="background:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:20px; font-size:0.85rem; font-weight:600;">${s.durationLabel || '—'}</span></td>
                <td>${statusBadge(s.status)}</td>
                <td style="text-align: right;">
                    <button class="btn-sm-action btn-edit-sm" onclick="openEditScheduleById(${s.scheduleId})">✏️ Sửa</button>
                    <button class="btn-sm-action btn-delete-sm" style="margin-left:6px;" onclick="deleteSchedule(${s.scheduleId})">🗑️ Xóa</button>
                </td>
            </tr>
        `).join('');
    }

    const btnAddSchedule = document.getElementById('btn-add-schedule');
    if (btnAddSchedule) {
        btnAddSchedule.addEventListener('click', () => {
            document.getElementById('schedule-modal-title').innerText = 'Thêm Lịch Trình';
            document.getElementById('schedule-id').value = '';
            document.getElementById('schedule-departure').value = '';
            document.getElementById('schedule-return').value = '';
            document.getElementById('schedule-duration').value = '';
            document.getElementById('schedule-status').value = 'Available';
            document.getElementById('schedule-modal').classList.add('active');
        });
    }

    window.openEditScheduleById = function (schedId) {
        if (!window.currentSchedules) return;
        const s = window.currentSchedules.find(item => item.scheduleId === schedId);
        if (!s) return;
        window.openEditSchedule(s);
    };

    window.openEditSchedule = function (s) {
        document.getElementById('schedule-modal-title').innerText = 'Chỉnh sửa Lịch Trình';
        document.getElementById('schedule-id').value = s.scheduleId;
        document.getElementById('schedule-departure').value = s.departureDate;
        document.getElementById('schedule-return').value = s.returnDate;
        document.getElementById('schedule-duration').value = s.durationLabel || '';
        document.getElementById('schedule-status').value = s.status || 'Available';
        document.getElementById('schedule-modal').classList.add('active');
    };

    const btnSaveSchedule = document.getElementById('btn-save-schedule');
    if (btnSaveSchedule) {
        btnSaveSchedule.addEventListener('click', async () => {
            const schedId = document.getElementById('schedule-id').value;
            const dep = document.getElementById('schedule-departure').value;
            const ret = document.getElementById('schedule-return').value;
            if (!dep || !ret) { Popup.show('Thiếu thông tin', 'Vui lòng nhập đầy đủ ngày khởi hành và ngày trở về.', 'error'); return; }
            if (new Date(dep) >= new Date(ret)) { Popup.show('Ngày không hợp lệ', 'Ngày trở về phải sau ngày khởi hành.', 'error'); return; }

            const data = {
                cruiseId: parseInt(cruiseId),
                departureDate: dep,
                returnDate: ret,
                durationLabel: document.getElementById('schedule-duration').value.trim(),
                status: document.getElementById('schedule-status').value
            };

            const method = schedId ? 'PUT' : 'POST';
            const url = schedId ? `/api/Schedules/${schedId}` : '/api/Schedules';

            try {
                const res = await fetch(url, {
                    method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    document.getElementById('schedule-modal').classList.remove('active');
                    Popup.show('Thành công', schedId ? 'Đã cập nhật lịch trình!' : 'Đã thêm lịch trình!', 'success');
                    loadSchedules();
                } else {
                    let msg = 'Lỗi lưu.'; try { const e = await res.json(); msg = e.message || msg; } catch { }
                    Popup.show('Lỗi', msg, 'error');
                }
            } catch { Popup.show('Lỗi', 'Lỗi kết nối.', 'error'); }
        });
    }

    window.deleteSchedule = function (id) {
        Popup.confirm('Xác nhận xóa', 'Bạn có chắc muốn xóa lịch trình này?', async () => {
            try {
                const res = await fetch(`/api/Schedules/${id}`, {
                    method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) { Popup.show('Đã xóa', 'Xóa lịch trình thành công.', 'success'); loadSchedules(); }
                else {
                    let msg = 'Không thể xóa lịch trình.';
                    try {
                        const data = await res.json();
                        if (data.message) msg = data.message;
                    } catch { }
                    Popup.show('Lỗi', msg, 'error');
                }
            } catch { Popup.show('Lỗi', 'Lỗi kết nối.', 'error'); }
        });
    };

    // Close modals when clicking overlay background
    ['dest-modal', 'cabin-modal', 'schedule-modal'].forEach(id => {
        const modalEl = document.getElementById(id);
        if (modalEl) {
            modalEl.addEventListener('click', function (e) {
                if (e.target === this) this.classList.remove('active');
            });
        }
    });

    // Sync dynamic breadcrumb title
    const checkNameInterval = setInterval(() => {
        const editorTitleEl = document.getElementById('editor-title');
        if (editorTitleEl && editorTitleEl.innerText && editorTitleEl.innerText !== 'Thêm Du Thuyền Mới') {
            const breadcrumbName = document.getElementById('breadcrumb-editor-title');
            if (breadcrumbName) {
                breadcrumbName.innerText = editorTitleEl.innerText;
            }
            clearInterval(checkNameInterval);
        }
    }, 500);
    setTimeout(() => clearInterval(checkNameInterval), 10000);
});