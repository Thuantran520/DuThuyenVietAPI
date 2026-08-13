document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (!token) { window.location.replace('/login.html'); return; }

    const urlParams = new URLSearchParams(window.location.search);
    const cruiseId = urlParams.get('id');
    const isEdit = !!cruiseId;
    let isCruiseActive = true; // Mặc định là đang hoạt động
    let currentGalleryUrls = []; // Lưu danh sách ảnh thư viện

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
        } catch {}

        const isAdminOrManager = currentUserRoles.some(r => r === 'Admin' || r === 'Manager');

        // Show "+ Thêm khu vực" button only for Admin/Manager
        if (isAdminOrManager) {
            document.getElementById('btn-add-dest').style.display = 'inline-block';
        }

        // Load destinations from API
        await loadDestinations();

        // Then load cruise data and sections
        if (isEdit) {
            document.getElementById('editor-title').innerText = 'Chỉnh sửa Du Thuyền';
            await loadCruise(cruiseId);
            document.getElementById('section-cabins').style.display = 'block';
            document.getElementById('section-schedules').style.display = 'block';
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
            select.innerHTML = dests.map(d =>
                `<option value="${d.destinationId}">${d.name}</option>`
            ).join('');
            if (selectedId) select.value = selectedId;
        } catch {
            // fallback hardcode nếu API lỗi
            document.getElementById('edit-dest').innerHTML = `
                <option value="1">Vịnh Hạ Long</option>
                <option value="2">Vịnh Lan Hạ</option>
            `;
        }
    }

    // "+ Thêm khu vực" button → open modal
    document.getElementById('btn-add-dest').addEventListener('click', () => {
        document.getElementById('dest-name').value = '';
        document.getElementById('dest-desc').value = '';
        document.getElementById('dest-modal').classList.add('active');
    });

    // Save new destination
    document.getElementById('btn-save-dest').addEventListener('click', async () => {
        const name = document.getElementById('dest-name').value.trim();
        if (!name) { Popup.show('Thiếu thông tin', 'Vui lòng nhập tên khu vực.', 'error'); return; }

        const btn = document.getElementById('btn-save-dest');
        btn.innerText = 'Đang lưu...'; btn.disabled = true;
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
                try { const e = await res.json(); msg = e.message || msg; } catch {}
                Popup.show('Lỗi', msg, 'error');
            }
        } catch { Popup.show('Lỗi', 'Lỗi kết nối.', 'error'); }
        finally { btn.innerText = '💾 Tạo Khu Vực'; btn.disabled = false; }
    });

    // Delete destination
    document.getElementById('btn-del-dest').addEventListener('click', () => {
        const select = document.getElementById('edit-dest');
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
                    try { const e = await res.json(); msg = e.message || msg; } catch {}
                    Popup.show('Lỗi', msg, 'error');
                }
            } catch {
                Popup.show('Lỗi', 'Lỗi kết nối.', 'error');
            }
        });
    });

    // Close dest modal on overlay click
    document.getElementById('dest-modal').addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });

    document.getElementById('btn-save-cruise').addEventListener('click', saveCruise);

    // Toggle Maintenance
    document.getElementById('btn-toggle-maintenance').addEventListener('click', () => {
        isCruiseActive = !isCruiseActive;
        updateMaintenanceBtn();
        Popup.show('Đã đổi trạng thái', 'Vui lòng nhấn "Lưu Thông Tin" để xác nhận trạng thái mới trên máy chủ.', 'success');
    });

    function updateMaintenanceBtn() {
        const btn = document.getElementById('btn-toggle-maintenance');
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

    // ==========================================
    // 1.5 IMAGE UPLOAD HANDLERS
    // ==========================================
    async function uploadSingleImage(file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/Upload/image', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                return data.url || data.Url;
            } else {
                let msg = 'Lỗi tải ảnh.'; try { const e = await res.json(); msg = e.message || e.title || msg; } catch {}
                Popup.show('Lỗi', msg, 'error');
            }
        } catch { Popup.show('Lỗi', 'Lỗi kết nối tải ảnh.', 'error'); }
        return null;
    }

    // Thumbnail upload
    const btnThumb = document.getElementById('btn-upload-thumb');
    const fileThumb = document.getElementById('file-thumb');
    if (btnThumb && fileThumb) {
        btnThumb.addEventListener('click', () => fileThumb.click());
        fileThumb.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            btnThumb.innerText = 'Đang tải...'; btnThumb.disabled = true;
            const url = await uploadSingleImage(e.target.files[0]);
            if (url) {
                document.getElementById('edit-thumb').value = url;
                document.getElementById('preview-thumb').src = url;
                Popup.show('Thành công', 'Tải ảnh đại diện thành công!', 'success');
            }
            btnThumb.innerText = '📁 Tải lên'; btnThumb.disabled = false;
            e.target.value = '';
        });
    }

    // Gallery upload
    const btnGallery = document.getElementById('btn-upload-gallery');
    const fileGallery = document.getElementById('file-gallery');
    if (btnGallery && fileGallery) {
        btnGallery.addEventListener('click', () => fileGallery.click());
        fileGallery.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            const files = Array.from(e.target.files);
            if (currentGalleryUrls.length + files.length > 5) {
                Popup.show('Lỗi', 'Chỉ được phép tải lên tối đa 5 ảnh trong thư viện.', 'error');
                return;
            }
            btnGallery.innerText = 'Đang tải...'; btnGallery.disabled = true;
            
            const formData = new FormData();
            files.forEach(f => formData.append('files', f));
            
            try {
                const res = await fetch('/api/Upload/images', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                });
                if (res.ok) {
                    const data = await res.json();
                    const urls = data.urls || data.Urls || [];
                    currentGalleryUrls.push(...urls);
                    renderGalleryPreview();
                    Popup.show('Thành công', 'Tải ảnh thư viện thành công!', 'success');
                } else {
                    let msg = 'Lỗi tải ảnh.'; try { const e = await res.json(); msg = e.message || e.title || msg; } catch {}
                    Popup.show('Lỗi', msg, 'error');
                }
            } catch { Popup.show('Lỗi', 'Lỗi kết nối tải ảnh.', 'error'); }
            
            btnGallery.innerText = '📁 Chọn ảnh tải lên'; btnGallery.disabled = false;
            e.target.value = '';
        });
    }

    function renderGalleryPreview() {
        const previewEl = document.getElementById('gallery-preview');
        const countEl = document.getElementById('gallery-count');
        if (!previewEl || !countEl) return;
        
        countEl.innerText = `${currentGalleryUrls.length}/5`;
        previewEl.innerHTML = currentGalleryUrls.map((url, index) => `
            <div style="position: relative; border-radius: 8px; overflow: hidden; height: 80px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
                <button onclick="removeGalleryImage(${index})" style="position: absolute; top: 4px; right: 4px; background: rgba(255,0,0,0.8); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
            </div>
        `).join('');
    }
    
    window.removeGalleryImage = function(index) {
        currentGalleryUrls.splice(index, 1);
        renderGalleryPreview();
    };

    // Cabin image upload
    const btnCabinUpload = document.getElementById('btn-upload-cabin');
    const fileCabin = document.getElementById('file-cabin');
    if (btnCabinUpload && fileCabin) {
        btnCabinUpload.addEventListener('click', () => fileCabin.click());
        fileCabin.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            btnCabinUpload.innerText = 'Đang tải...'; btnCabinUpload.disabled = true;
            const url = await uploadSingleImage(e.target.files[0]);
            if (url) {
                document.getElementById('cabin-image').value = url;
            }
            btnCabinUpload.innerText = '📁 Tải lên'; btnCabinUpload.disabled = false;
            e.target.value = '';
        });
    }


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
            document.getElementById('preview-thumb').src = thumbUrl || '/images/default-cruise.jpg';
            
            if (c.images && c.images.length > 1) {
                // If there are multiple images, the first is usually the thumbnail, so we take the rest for gallery
                currentGalleryUrls = c.images.filter(url => url !== thumbUrl);
                if (currentGalleryUrls.length > 5) currentGalleryUrls = currentGalleryUrls.slice(0, 5);
            } else {
                currentGalleryUrls = [];
            }
            renderGalleryPreview();
            
            isCruiseActive = c.isActive !== undefined ? c.isActive : true;
            updateMaintenanceBtn();
        } catch (err) {
            Popup.show('Lỗi', 'Lỗi tải dữ liệu du thuyền.', 'error');
        }
    }

    async function saveCruise() {
        const btn = document.getElementById('btn-save-cruise');
        const origText = btn.innerText;
        btn.innerText = 'Đang lưu...'; btn.disabled = true;

        const data = {
            destinationId: parseInt(document.getElementById('edit-dest').value) || 1,
            name: document.getElementById('edit-name').value.trim(),
            totalCabins: parseInt(document.getElementById('edit-cabins').value) || 20,
            shortDescription: document.getElementById('edit-shortdesc').value.trim(),
            description: document.getElementById('edit-desc').value.trim(),
            thumbnailUrl: document.getElementById('edit-thumb').value.trim(),
            isActive: isCruiseActive,
            galleryUrls: currentGalleryUrls
        };

        if (!data.name) { Popup.show('Thiếu thông tin', 'Vui lòng nhập tên du thuyền.', 'error'); btn.innerText = origText; btn.disabled = false; return; }

        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `/api/Cruises/${cruiseId}` : '/api/Cruises';

        try {
            const res = await fetch(url, {
                method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                const saved = await res.json();
                if (!isEdit) {
                    // After create, redirect to edit mode so cabins/schedules can be added
                    const newId = saved.cruiseId || saved.CruiseId;
                    Popup.show('Thành công', 'Tạo du thuyền thành công! Bạn có thể thêm phòng và lịch trình ngay bây giờ.', 'success');
                    setTimeout(() => { window.location.href = `/admin/cruise-editor.html?id=${newId}`; }, 1500);
                } else {
                    Popup.show('Thành công', 'Đã cập nhật thông tin du thuyền!', 'success');
                }
            } else {
                let errorMsg = 'Lỗi không xác định.';
                try { const e = await res.json(); errorMsg = e.message || e.title || JSON.stringify(e); } catch {}
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
        } catch {}
    }

    function renderCabins(cabins) {
        const grid = document.getElementById('cabin-list');
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
                        <button class="btn-sm-action btn-edit-sm" onclick="openEditCabin(${JSON.stringify(c).replace(/"/g, '&quot;')})">✏️ Sửa thông tin</button>
                        <button class="btn-sm-action btn-delete-sm" onclick="deleteCabin(${c.cabinTypeId})">🗑️ Xóa</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Open cabin modal for ADD
    document.getElementById('btn-add-cabin').addEventListener('click', () => {
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

    // Open cabin modal for EDIT (called from inline HTML)
    window.openEditCabin = function(c) {
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

    document.getElementById('btn-save-cabin').addEventListener('click', async () => {
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
                let msg = 'Lỗi lưu.'; try { const e = await res.json(); msg = e.message || msg; } catch {}
                Popup.show('Lỗi', msg, 'error');
            }
        } catch { Popup.show('Lỗi', 'Lỗi kết nối.', 'error'); }
    });

    window.deleteCabin = function(id) {
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
            renderSchedules(schedules);
        } catch {}
    }

    function renderSchedules(schedules) {
        const tbody = document.getElementById('schedule-list');
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
                    <button class="btn-sm-action btn-edit-sm" onclick="openEditSchedule(${JSON.stringify(s).replace(/"/g, '&quot;')})">✏️ Sửa</button>
                    <button class="btn-sm-action btn-delete-sm" style="margin-left:6px;" onclick="deleteSchedule(${s.scheduleId})">🗑️ Xóa</button>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('btn-add-schedule').addEventListener('click', () => {
        document.getElementById('schedule-modal-title').innerText = 'Thêm Lịch Trình';
        document.getElementById('schedule-id').value = '';
        document.getElementById('schedule-departure').value = '';
        document.getElementById('schedule-return').value = '';
        document.getElementById('schedule-duration').value = '';
        document.getElementById('schedule-status').value = 'Available';
        document.getElementById('schedule-modal').classList.add('active');
    });

    window.openEditSchedule = function(s) {
        document.getElementById('schedule-modal-title').innerText = 'Chỉnh sửa Lịch Trình';
        document.getElementById('schedule-id').value = s.scheduleId;
        document.getElementById('schedule-departure').value = s.departureDate;
        document.getElementById('schedule-return').value = s.returnDate;
        document.getElementById('schedule-duration').value = s.durationLabel || '';
        document.getElementById('schedule-status').value = s.status || 'Available';
        document.getElementById('schedule-modal').classList.add('active');
    };

    document.getElementById('btn-save-schedule').addEventListener('click', async () => {
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
                let msg = 'Lỗi lưu.'; try { const e = await res.json(); msg = e.message || msg; } catch {}
                Popup.show('Lỗi', msg, 'error');
            }
        } catch { Popup.show('Lỗi', 'Lỗi kết nối.', 'error'); }
    });

    window.deleteSchedule = function(id) {
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
                    } catch {}
                    Popup.show('Lỗi', msg, 'error');
                }
            } catch { Popup.show('Lỗi', 'Lỗi kết nối.', 'error'); }
        });
    };

    // Close modals when clicking overlay background
    ['cabin-modal', 'schedule-modal'].forEach(id => {
        document.getElementById(id).addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
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
