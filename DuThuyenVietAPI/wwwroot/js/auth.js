document.addEventListener('DOMContentLoaded', async function () {
    // === Global Router Guard ===
    const token = localStorage.getItem('auth_token');
    const path = window.location.pathname.toLowerCase();
    const isAuthPage = path.includes('login.html') || path.includes('register.html');
    const isProfilePage = path.includes('profile.html');

    if (token && isAuthPage) {
        // Đã đăng nhập nhưng cố vào trang đăng nhập/đăng ký
        window.location.replace('/profile.html');
        return;
    }
    if (!token && isProfilePage) {
        // Chưa đăng nhập mà đòi vào profile
        window.location.replace('/login.html');
        return;
    }
    // ==========================================
    // 1. TRANG ĐĂNG KÝ
    // ==========================================
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const fullName = document.getElementById('fullname').value;
            const phoneNumber = document.getElementById('phone').value;

            const btn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const spinner = document.getElementById('spinner');

            btn.disabled = true; btnText.style.display = 'none'; spinner.style.display = 'block';

            try {
                const response = await fetch('/api/account/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password, fullName, phoneNumber })
                });

                if (response.ok) {
                    Popup.show('Thành công', 'Đăng ký thành công! Hãy đăng nhập.', 'success');
                    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    const errMsg = errorData.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại.';
                    Popup.show('Lỗi đăng ký', errMsg, 'error');
                }
            } catch (error) {
                console.error(error);
                Popup.show('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
            } finally {
                btn.disabled = false; btnText.style.display = 'inline-block'; spinner.style.display = 'none';
            }
        });
    }

    // ==========================================
    // 2. TRANG ĐĂNG NHẬP
    // ==========================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameOrEmail = document.getElementById('usernameOrEmail').value.trim();
            const password = document.getElementById('password').value.trim();

            const btn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const spinner = document.getElementById('spinner');
            const alertBox = document.getElementById('alert-box');

            const isAdminCheckbox = document.getElementById('isAdminLogin');
            const loginAsAdmin = isAdminCheckbox ? isAdminCheckbox.checked : false;

            btn.disabled = true; btnText.style.display = 'none'; spinner.style.display = 'block'; alertBox.style.display = 'none';

            try {
                const response = await fetch('/api/Account/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernameOrEmail: usernameOrEmail, password, loginAsAdmin })
                });

                alertBox.style.display = 'block';
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('auth_token', data.token);
                    
                    const redirectUrl = loginAsAdmin ? '/admin/profile.html' : '/profile.html';

                    Popup.show('Thành công', 'Đăng nhập thành công! Đang chuyển hướng...', 'success');
                    setTimeout(() => { window.location.href = redirectUrl; }, 1000);
                } else if (response.status === 401) {
                    alertBox.className = 'alert-error'; 
                    alertBox.innerHTML = `Email hoặc mật khẩu không đúng.<br><small>Gỡ lỗi: Đã gửi tài khoản "${usernameOrEmail}", độ dài mật khẩu: ${password.length}</small>`;
                } else {
                    const textData = await response.text();
                    let errData = {};
                    try { errData = JSON.parse(textData); } catch(e) { errData = { message: textData }; }
                    
                    let errorMsg = errData.message || errData.title || 'Có lỗi xảy ra, vui lòng thử lại.';
                    if (errData.errors) {
                        const firstError = Object.values(errData.errors)[0];
                        if (Array.isArray(firstError)) errorMsg = firstError[0];
                    }
                    
                    alertBox.className = 'alert-error'; alertBox.innerHTML = 'Lỗi: ' + errorMsg;
                }
            } catch (error) {
                alertBox.style.display = 'block'; alertBox.className = 'alert-error'; alertBox.innerHTML = 'Lỗi kết nối máy chủ.';
            } finally {
                btn.disabled = false; btnText.style.display = 'block'; spinner.style.display = 'none';
            }
        });
    }

    // ==========================================
    // 3. TRANG PROFILE & ADMIN TABS
    // ==========================================
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            alert('Vui lòng đăng nhập để xem trang này!');
            window.location.href = 'login.html';
            return;
        }

        const loader = document.getElementById('loader');
        loader.style.display = 'block';

        let isAdmin = false;
        let isManager = false;
        let isStaff = false;

        // --- Fetch Profile Data ---
        async function loadProfile() {
            try {
                const response = await fetch('/api/account/profile', {
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    const email = data.email || data.Email;
                    const userName = data.userName || data.UserName || 'Chưa cập nhật';
                    const fullName = data.fullName || data.FullName || userName;
                    const phone = data.phoneNumber || data.PhoneNumber || 'Chưa cập nhật';
                    const avatarUrl = data.avatarUrl || data.AvatarUrl;

                    document.getElementById('val-username').innerText = userName;
                    document.getElementById('val-email').innerText = email;
                    document.getElementById('val-fullname').innerText = fullName;
                    document.getElementById('val-phone').innerText = phone;
                    document.getElementById('input-fullname').value = fullName === 'Chưa cập nhật' ? '' : fullName;
                    document.getElementById('input-phone').value = phone === 'Chưa cập nhật' ? '' : phone;

                    // Avatar logic
                    const letter = document.getElementById('avatarLetter');
                    const img = document.getElementById('avatarImage');
                    if (avatarUrl) {
                        img.src = avatarUrl;
                        img.style.display = 'block';
                        letter.style.display = 'none';
                    } else {
                        img.style.display = 'none';
                        letter.style.display = 'block';
                        letter.innerText = (fullName !== 'Chưa cập nhật' ? fullName : email).charAt(0).toUpperCase();
                    }

                    // Roles
                    const userRoles = data.roles || data.Roles || [];
                    const rolesContainer = document.getElementById('val-roles');
                    rolesContainer.innerHTML = '';
                    if (userRoles.length > 0) {
                        userRoles.forEach(role => {
                            if (role.toLowerCase() === 'admin') isAdmin = true;
                            if (role.toLowerCase() === 'manager') isManager = true;
                            if (role.toLowerCase() === 'staff') isStaff = true;
                            
                            rolesContainer.innerHTML += `<span class="role-badge ${role.toLowerCase() === 'admin' ? 'admin' : ''}">${role}</span>`;
                        });
                    } else {
                        rolesContainer.innerHTML = `<span style="color: #9ca3af">Customer</span>`;
                    }

                    // Router & Access Control
                    const isInternalRoute = window.location.pathname.includes('/admin/');
                    
                    if (isAdmin || isManager || isStaff) {
                        // Admin/Staff/Manager
                        if (!isInternalRoute) {
                            window.location.replace('/admin/profile.html');
                            return;
                        }
                    } else {
                        // Customer
                        if (isInternalRoute) {
                            window.location.replace('/profile.html');
                            return;
                        }
                    }

                    // Reveal header smoothly since we are permitted to stay
                    const mainHeader = document.getElementById('main-header');
                    if (mainHeader) mainHeader.style.opacity = '1';

                    // Show Admin Tab Navigation only if it exists in HTML
                    const tabAdminNav = document.getElementById('tab-admin-nav');
                    if (tabAdminNav && (isAdmin || isManager || isStaff)) {
                        tabAdminNav.style.display = 'block';
                        loadAdminUsers();
                    }
                    
                    const tabBookingsNav = document.getElementById('tab-bookings-nav');
                    if (tabBookingsNav && (isAdmin || isManager || isStaff)) {
                        tabBookingsNav.style.display = 'block';
                        loadAdminBookings();
                    }
                    
                    const tabCruisesNav = document.getElementById('tab-cruises-nav');
                    if (tabCruisesNav && (isAdmin || isManager || isStaff)) {
                        tabCruisesNav.style.display = 'block';
                        loadAdminCruises();
                    }

                    loader.style.display = 'none';
                    mainContent.style.display = 'block';
                } else {
                    localStorage.removeItem('auth_token');
                    window.location.href = 'login.html';
                }
            } catch (error) {
                console.error(error);
                Popup.show('Lỗi', 'Lỗi lấy thông tin.', 'error');
            }
        }
        
        loadProfile();

        // --- Tab Logic ---
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(tab.getAttribute('data-target')).classList.add('active');
            });
        });

        // --- UI Toggles for Edit Mode ---
        const btnEdit = document.getElementById('btnEditProfile');
        const btnCancel = document.getElementById('btnCancelEdit');
        const viewActions = document.getElementById('view-actions');
        const editActions = document.getElementById('edit-actions');
        
        const valFullname = document.getElementById('val-fullname');
        const valPhone = document.getElementById('val-phone');
        const formFullname = document.getElementById('form-fullname');
        const formPhone = document.getElementById('form-phone');

        btnEdit.addEventListener('click', () => {
            valFullname.style.display = 'none'; formFullname.style.display = 'block';
            valPhone.style.display = 'none'; formPhone.style.display = 'block';
            viewActions.style.display = 'none'; editActions.style.display = 'flex';
        });

        btnCancel.addEventListener('click', () => {
            valFullname.style.display = 'block'; formFullname.style.display = 'none';
            valPhone.style.display = 'block'; formPhone.style.display = 'none';
            viewActions.style.display = 'flex'; editActions.style.display = 'none';
        });

        // --- Save Profile ---
        const btnSave = document.getElementById('btnSaveProfile');
        const inputFullname = document.getElementById('input-fullname');
        const inputPhone = document.getElementById('input-phone');
        btnSave.addEventListener('click', async () => {
            const fullName = inputFullname.value;
            const phoneNumber = inputPhone.value;
            
            btnSave.disabled = true;
            btnSave.innerText = "Đang lưu...";

            try {
                const response = await fetch('/api/account/profile', {
                    method: 'PUT',
                    headers: { 
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ fullName, phoneNumber })
                });

                if (response.ok) {
                    Popup.show('Thành công', 'Cập nhật hồ sơ thành công!', 'success');
                    viewActions.style.display = 'block';
                    editActions.style.display = 'none';
                    formFullname.style.display = 'none';
                    formPhone.style.display = 'none';
                    valFullname.style.display = 'inline-block';
                    valPhone.style.display = 'inline-block';
                    valFullname.innerText = inputFullname.value;
                    valPhone.innerText = inputPhone.value;
                } else {
                    Popup.show('Lỗi', 'Cập nhật thất bại, vui lòng thử lại.', 'error');
                }
            } catch (error) {
                Popup.show('Lỗi', 'Lỗi kết nối.', 'error');
            } finally {
                btnSave.disabled = false;
                btnSave.innerText = "Lưu thay đổi";
            }
        });

        // --- Upload Avatar ---
        const avatarUpload = document.getElementById('avatarUpload');
        const avatarStatus = document.getElementById('avatarStatus');
        
        avatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            avatarStatus.innerText = "Đang tải lên...";
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/account/avatar', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    Popup.show('Thành công', 'Ảnh đại diện đã được thay đổi!', 'success');
                    document.getElementById('avatarImage').src = data.avatarUrl;
                    document.getElementById('avatarImage').style.display = 'block';
                    document.getElementById('avatarLetter').style.display = 'none';
                    avatarStatus.innerText = "";
                } else {
                    Popup.show('Lỗi', 'Lỗi khi tải ảnh lên.', 'error');
                    avatarStatus.innerText = "";
                }
            } catch (error) {
                avatarStatus.innerText = "Lỗi kết nối.";
            }
        });

        // --- Fetch Admin Bookings Data ---
        async function loadAdminBookings() {
            try {
                const response = await fetch('/api/Bookings/All', {
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    const bookings = await response.json();
                    const tbody = document.getElementById('bookings-table-body');
                    if (!tbody) return;
                    tbody.innerHTML = '';

                    const formatPrice = (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
                    
                    window.copyToClipboard = function(text) {
                        navigator.clipboard.writeText(text).then(() => {
                            window.Popup.show('Đã sao chép', 'Mã đã được lưu vào bộ nhớ tạm!', 'success');
                        });
                    };

                    const grouped = {};
                    bookings.forEach(b => {
                        if (!grouped[b.bookingCode]) {
                            grouped[b.bookingCode] = { ...b, items: [], totalPrice: 0 };
                        }
                        grouped[b.bookingCode].items.push(b);
                        grouped[b.bookingCode].totalPrice += b.totalPrice;
                    });
                    
                    window.adminGroupedBookings = grouped; // for modal

                    window.showBookingDetails = function(code) {
                        const grp = window.adminGroupedBookings[code];
                        if(!grp) return;
                        
                        document.getElementById('modal-booking-code').innerText = code;
                        
                        let html = `<p><strong>Khách hàng:</strong> ${grp.contactName} - ${grp.contactPhone}</p>`;
                        html += `<p><strong>Du thuyền:</strong> ${grp.cruiseName}</p>`;
                        html += `<p><strong>Ngày khởi hành:</strong> ${new Date(grp.departureDate).toLocaleDateString('vi-VN')}</p>`;
                        html += `<hr style="margin: 16px 0; border: none; border-top: 1px dashed #cbd5e1;">`;
                        html += `<h4 style="margin-bottom: 12px;">Chi tiết phòng:</h4>`;
                        
                        grp.items.forEach(item => {
                            html += `<div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
                                <div>
                                    <div style="font-weight: 600;">${item.cabinName}</div>
                                    <div style="font-size: 0.9rem; color: #64748b;">Số lượng: ${item.numberOfRooms} phòng</div>
                                </div>
                                <div style="font-weight: 600; color: var(--primary);">${formatPrice(item.totalPrice)}</div>
                            </div>`;
                        });
                        
                        html += `<hr style="margin: 16px 0; border: none; border-top: 1px dashed #cbd5e1;">`;
                        html += `<div style="text-align: right; font-size: 1.2rem;"><strong>Tổng cộng: <span style="color: #ef4444;">${formatPrice(grp.totalPrice)}</span></strong></div>`;
                        
                        document.getElementById('booking-details-content').innerHTML = html;
                        document.getElementById('bookingDetailsModal').style.display = 'flex';
                    };

                    Object.values(grouped).forEach(b => {
                        let statusHtml = '';
                        if (b.status === 'Pending') statusHtml = '<span class="role-badge" style="background:#fef3c7; color:#d97706;">Chờ thanh toán</span>';
                        else if (b.status === 'AwaitingConfirmation') statusHtml = '<span class="role-badge" style="background:#e0e7ff; color:#4338ca;">Chờ xác nhận</span>';
                        else if (b.status === 'Confirmed') statusHtml = '<span class="role-badge" style="background:#dcfce3; color:#16a34a;">Thành công</span>';
                        else if (b.status === 'Cancelled') statusHtml = '<span class="role-badge" style="background:#fee2e2; color:#dc2626;">Đã hủy</span>';
                        else statusHtml = b.status;

                        let actionsHtml = `<button class="btn-sm btn-outline" style="border-color:#3b82f6; color:#3b82f6; margin-right:8px;" onclick="showBookingDetails('${b.bookingCode}')">Chi tiết</button>`;
                        
                        if (b.status === 'AwaitingConfirmation' || b.status === 'Pending') {
                            // Only confirm/cancel the first item for simplicity, or ideally call an API that updates by bookingCode.
                            // Currently, we'll just pass the bookingId of the first item which is technically partial, 
                            // but our backend should ideally handle it. Since we haven't changed the backend, we loop or just pass the first.
                            // Assuming backend updates ALL bookings with this code if we adapt it later, but for now we'll just loop in JS.
                            actionsHtml += `<button class="btn-sm btn-outline" style="border-color:#10b981; color:#10b981; margin-right:8px;" onclick="updateBookingGroupStatus('${b.bookingCode}', 'Confirmed')">Xác nhận</button>`;
                            actionsHtml += `<button class="btn-sm btn-outline" style="border-color:#ef4444; color:#ef4444;" onclick="updateBookingGroupStatus('${b.bookingCode}', 'Cancelled')">Hủy</button>`;
                        }

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td style="font-weight: 500;">
                                ${b.bookingCode}
                                <button onclick="copyToClipboard('${b.bookingCode}')" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:0 5px;" title="Sao chép">📋</button>
                            </td>
                            <td>${b.contactName}<br><small class="text-muted">${b.contactPhone}</small></td>
                            <td>${b.cruiseName}<br><small class="text-muted">${b.items.length} loại phòng</small></td>
                            <td style="font-weight: 600; color: #ef4444;">${formatPrice(b.totalPrice)}</td>
                            <td>${statusHtml}</td>
                            <td style="text-align: right; white-space: nowrap;">${actionsHtml}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            } catch (err) {
                console.error("Lỗi lấy danh sách booking:", err);
            }
        }
        
        window.updateBookingGroupStatus = async function(bookingCode, newStatus) {
            const grp = window.adminGroupedBookings[bookingCode];
            if(!grp || !grp.items || grp.items.length === 0) return;
            
            Popup.confirm('Xác nhận cập nhật', 'Bạn có chắc chắn muốn cập nhật trạng thái đơn này không?', async () => {
                try {
                    let successCount = 0;
                    for (const item of grp.items) {
                        const res = await fetch(`/api/Bookings/${item.bookingId}/Status`, {
                            method: 'PUT',
                            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newStatus })
                        });
                        if (res.ok) successCount++;
                    }
                    if (successCount > 0) {
                        Popup.show('Thành công', 'Cập nhật trạng thái thành công!', 'success');
                        loadAdminBookings();
                    } else {
                        Popup.show('Lỗi', 'Không thể cập nhật trạng thái', 'error');
                    }
                } catch(e) {
                    Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
                }
            });
        }
        
        window.updateBookingStatus = async function(bookingId, status) {
            let msg = status === 'Confirmed' ? 'Xác nhận đơn đặt phòng này?' : 'Bạn chắc chắn muốn hủy đơn này?';
            Popup.confirm('Xác nhận', msg, async () => {
                try {
                    const res = await fetch(`/api/Bookings/${bookingId}/Status`, {
                        method: 'PUT',
                        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: status })
                    });
                    if (res.ok) { 
                        Popup.show('Thành công', 'Cập nhật trạng thái thành công!', 'success'); 
                        loadAdminBookings(); 
                    }
                    else { 
                        Popup.show('Lỗi', 'Cập nhật thất bại.', 'error'); 
                    }
                } catch(e) {
                    Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
                }
            });
        }

        // --- Fetch Admin Cruises Data ---
        async function loadAdminCruises() {
            try {
                // Using existing GET /api/Cruises which returns pagination
                const res = await fetch('/api/Cruises?pageSize=50');
                if (res.ok) {
                    const json = await res.json();
                    const cruises = json.data;
                    const grid = document.getElementById('cruises-grid-container');
                    if (!grid) return;
                    grid.innerHTML = '';
                    
                    cruises.forEach(c => {
                        const div = document.createElement('div');
                        div.className = 'cruise-card';
                        div.innerHTML = `
                            <img src="${c.thumbnailUrl || '/images/default-cruise.jpg'}" alt="${c.name}" class="cruise-img" onerror="this.src='/images/default-cruise.jpg'">
                            <div class="cruise-card-body">
                                <h3 class="cruise-title"><a href="/cruise-detail.html?id=${c.cruiseId}">${c.name}</a></h3>
                                <div class="cruise-meta mb-3">
                                    <span class="rating">⭐ ${c.averageRating} (${c.reviewCount})</span>
                                    <span class="destination">📍 ${c.destinationName}</span>
                                </div>
                                <div class="cruise-footer" style="display: flex; gap: 8px;">
                                    <button class="btn-primary" style="flex: 1; text-align: center; border-radius: 6px; padding: 8px; border: none; font-size: 14px; cursor: pointer; background-color: var(--primary); color: white;" onclick="window.editCruise(${c.cruiseId})">Sửa</button>
                                    <button class="btn-outline" style="flex: 1; text-align: center; border-radius: 6px; padding: 8px; border: 1px solid #ef4444; color: #ef4444; background: transparent; font-size: 14px; cursor: pointer;" onclick="window.deleteCruise(${c.cruiseId})">Xóa</button>
                                </div>
                            </div>
                        `;
                        grid.appendChild(div);
                    });
                }
            } catch (err) {
                console.error("Lỗi lấy danh sách du thuyền:", err);
            }
        }
        
        // --- Admin Cruises Preview Mode ---
        window.switchCruiseModalTab = function(tab) {
            const formSection = document.getElementById('cruise-form-section');
            const previewSection = document.getElementById('cruise-preview-section');
            const btnForm = document.getElementById('btn-tab-form');
            const btnPreview = document.getElementById('btn-tab-preview');
            
            if (tab === 'preview') {
                formSection.style.display = 'none';
                previewSection.style.display = 'block';
                btnForm.className = 'btn btn-outline btn-sm';
                btnPreview.className = 'btn btn-primary btn-sm';
                
                // Populate preview with current form values
                document.getElementById('preview-title').textContent = document.getElementById('cruise-name-input').value || 'Tên Du Thuyền Mới';
                
                const destSelect = document.getElementById('cruise-dest-input');
                document.getElementById('preview-dest').textContent = destSelect.options[destSelect.selectedIndex].text;
                document.getElementById('preview-cabins').textContent = document.getElementById('cruise-cabins-input').value || '0';
                document.getElementById('preview-shortdesc').textContent = document.getElementById('cruise-shortdesc-input').value || 'Chưa có mô tả ngắn...';
                document.getElementById('preview-desc').innerHTML = document.getElementById('cruise-desc-input').value || 'Chưa có mô tả chi tiết...';
            } else {
                formSection.style.display = 'block';
                previewSection.style.display = 'none';
                btnForm.className = 'btn btn-primary btn-sm';
                btnPreview.className = 'btn btn-outline btn-sm';
            }
        };

        window.openCruiseModal = function() {
            document.getElementById('cruiseModalTitle').innerText = 'Thêm Du Thuyền';
            document.getElementById('cruise-id-input').value = '';
            document.getElementById('cruise-name-input').value = '';
            document.getElementById('cruise-dest-input').value = '1';
            document.getElementById('cruise-cabins-input').value = '20';
            document.getElementById('cruise-shortdesc-input').value = '';
            document.getElementById('cruise-desc-input').value = '';
            document.getElementById('cruise-thumb-input').value = '';
            document.getElementById('cruiseModal').style.display = 'flex';
            window.switchCruiseModalTab('form');
        };
        
        window.editCruise = async function(id) {
            try {
                const res = await fetch(`/api/Cruises/${id}`);
                if (res.ok) {
                    const c = await res.json();
                    document.getElementById('cruiseModalTitle').innerText = 'Cập nhật Du Thuyền';
                    document.getElementById('cruise-id-input').value = c.cruiseId;
                    document.getElementById('cruise-name-input').value = c.name;
                    // c.destinationId is not returned in detail currently, just use a default or fetch if needed
                    document.getElementById('cruise-dest-input').value = '1'; 
                    document.getElementById('cruise-cabins-input').value = '20';
                    document.getElementById('cruise-shortdesc-input').value = c.shortDescription || '';
                    document.getElementById('cruise-desc-input').value = c.description || '';
                    document.getElementById('cruise-thumb-input').value = c.images && c.images.length > 0 ? c.images[0] : '';
                    document.getElementById('cruise-preview-img').src = document.getElementById('cruise-thumb-input').value || '/images/default-cruise.jpg';
                    
                    document.getElementById('cruiseModal').style.display = 'flex';
                }
            } catch (err) {
                Popup.show('Lỗi', 'Không thể tải thông tin du thuyền.', 'error');
            }
            window.switchCruiseModalTab('form');
        };
        
        window.saveCruise = async function() {
            const id = document.getElementById('cruise-id-input').value;
            const data = {
                destinationId: parseInt(document.getElementById('cruise-dest-input').value) || 1,
                name: document.getElementById('cruise-name-input').value,
                totalCabins: parseInt(document.getElementById('cruise-cabins-input').value) || 20,
                shortDescription: document.getElementById('cruise-shortdesc-input').value,
                description: document.getElementById('cruise-desc-input').value,
                thumbnailUrl: document.getElementById('cruise-thumb-input').value
            };
            
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/Cruises/${id}` : '/api/Cruises';
            
            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (res.ok) {
                    Popup.show('Thành công', 'Lưu du thuyền thành công!', 'success');
                    document.getElementById('cruiseModal').style.display = 'none';
                    loadAdminCruises();
                } else {
                    Popup.show('Lỗi', 'Lưu thất bại.', 'error');
                }
            } catch (err) {
                Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            }
        };
        
        window.deleteCruise = function(id) {
            Popup.confirm('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa du thuyền này không?', async () => {
                try {
                    const res = await fetch(`/api/Cruises/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (res.ok) {
                        Popup.show('Thành công', 'Đã xóa du thuyền', 'success');
                        loadAdminCruises();
                    } else {
                        Popup.show('Lỗi', 'Xóa thất bại', 'error');
                    }
                } catch (err) {
                    Popup.show('Lỗi', 'Lỗi kết nối', 'error');
                }
            });
        };

        // --- Fetch Admin Data (Staff Management) ---
        async function loadAdminUsers() {
            try {
                const response = await fetch('/api/users', {
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    const users = await response.json();
                    const tbody = document.getElementById('user-table-body');
                    tbody.innerHTML = '';

                    users.forEach(u => {
                        const targetRoles = u.roles || u.Roles || [];
                        const id = u.id || u.Id;
                        const fullName = u.fullName || u.FullName || u.userName || u.UserName;
                        const email = u.email || u.Email;
                        const roleStr = targetRoles.join(', ') || 'Customer';
                        let actionsHtml = '';
                        
                        // Assign Role dropdown (Admin & Manager)
                        if (isAdmin || isManager) {
                            let roleOptions = `<option value="Customer" ${targetRoles.includes('Customer')?'selected':''}>Customer</option>
                                               <option value="Staff" ${targetRoles.includes('Staff')?'selected':''}>Staff</option>`;
                            if (isAdmin) {
                                roleOptions += `<option value="Manager" ${targetRoles.includes('Manager')?'selected':''}>Manager</option>
                                                <option value="Admin" ${targetRoles.includes('Admin')?'selected':''}>Admin</option>`;
                            }
                            actionsHtml += `<select onchange="assignRole('${id}', this.value)" style="padding:4px; margin-right:8px; border-radius:4px; border:1px solid #e5e7eb; font-size:13px; color:#374151;">
                                              <option value="" disabled selected>Đổi Quyền</option>
                                              ${roleOptions}
                                            </select>`;
                        }

                        // Reset password (Admin, Manager, Staff can reset Customer)
                        const isTargetCustomer = targetRoles.length === 0 || targetRoles.includes('Customer');
                        if (isAdmin || isManager || (isStaff && isTargetCustomer)) {
                             actionsHtml += `<button class="btn-sm btn-outline" style="margin-right:8px; border-color:#0d9488; color:#0d9488;" onclick="resetPassword('${id}')">Reset Mật khẩu</button>`;
                        }

                        // Delete (Admin can delete all, Manager can delete Staff & Customer)
                        const isTargetAdmin = targetRoles.includes('Admin');
                        const isTargetManager = targetRoles.includes('Manager');
                        if (isAdmin || (isManager && !isTargetAdmin && !isTargetManager)) {
                             actionsHtml += `<button class="btn-sm btn-outline" style="color:#ef4444; border-color:#fca5a5;" onclick="deleteUser('${id}')">Xóa</button>`;
                        }

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td style="font-size: 13px; color: #6b7280;">${id.substring(0, 8)}...</td>
                            <td style="font-weight: 500;">${fullName}</td>
                            <td>${email}</td>
                            <td><span class="role-badge" style="background:#f3f4f6; color:#374151; border-color:#d1d5db;">${roleStr}</span></td>
                            <td style="text-align: right; min-width: 250px;">${actionsHtml}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            } catch (err) {
                console.error("Lỗi lấy danh sách user:", err);
            }
        }

        window.assignRole = async function(userId, role) {
            Popup.confirm('Xác nhận Cấp quyền', `Cấp quyền ${role} cho người dùng này?`, async () => {
                try {
                    const res = await fetch(`/api/users/${userId}/assign-role`, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role })
                    });
                    if (res.ok) { Popup.show('Thành công', 'Cấp quyền thành công!', 'success'); loadAdminUsers(); }
                    else { Popup.show('Từ chối', 'Cấp quyền thất bại, bạn không đủ thẩm quyền.', 'error'); }
                } catch(e) {}
            });
        }

        window.deleteUser = async function(userId) {
            Popup.confirm('Xóa Người dùng', 'Hành động này sẽ XÓA VĨNH VIỄN người dùng. Bạn có chắc chắn không?', async () => {
                try {
                    const res = await fetch(`/api/users/${userId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (res.ok) { Popup.show('Đã xóa', 'Người dùng đã bị xóa khỏi hệ thống.', 'success'); loadAdminUsers(); }
                    else { Popup.show('Từ chối', 'Không thể xóa. Lỗi phân quyền.', 'error'); }
                } catch(e) {}
            }, true); // true = Danger alert
        }

        window.resetPassword = async function(userId) {
            Popup.prompt('Reset Mật khẩu', 'Nhập mật khẩu MỚI cho người dùng này (Yêu cầu có chữ hoa, thường, số, ký tự đặc biệt):', 'Nhập mật khẩu mới', async (newPass) => {
                try {
                    const res = await fetch(`/api/users/${userId}/reset-password`, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newPassword: newPass })
                    });
                    if (res.ok) { Popup.show('Thành công', 'Mật khẩu đã được reset thành công!', 'success'); }
                    else { Popup.show('Lỗi', 'Reset thất bại. Chú ý mật khẩu phải đủ mạnh.', 'error'); }
                } catch(e) {}
            });
        }
    }

    // ==========================================
    // Đăng xuất
    // ==========================================
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', function () {
            Popup.confirm('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?', () => {
                localStorage.removeItem('auth_token');
                window.location.href = '/login.html';
            });
        });
    }

});
