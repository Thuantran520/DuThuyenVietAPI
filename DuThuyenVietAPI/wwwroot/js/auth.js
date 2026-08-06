document.addEventListener('DOMContentLoaded', async function () {
    // === Global Router Guard ===
    const token = localStorage.getItem('auth_token');
    const path = window.location.pathname.toLowerCase();
    const isAuthPage = path.includes('login.html') || path.includes('register.html');
    const isProfilePage = path.includes('profile.html');

    if (token && isAuthPage) {
        // Đã đăng nhập nhưng cố vào trang đăng nhập/đăng ký
        window.location.replace('/index.html');
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
                    
                    let redirectUrl = '/index.html';
                    if (loginAsAdmin) {
                        redirectUrl = '/admin/profile.html';
                    }

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

                    let totalRevenue = 0;
                    let uniqueCustomers = new Set();
                    let totalOrders = 0;

                    Object.values(grouped).forEach(b => {
                        if (b.status === 'Confirmed') {
                            totalRevenue += b.totalPrice;
                        }
                        if (b.contactPhone) uniqueCustomers.add(b.contactPhone);
                        totalOrders++;
                    });

                    const elRev = document.getElementById('dash-revenue');
                    const elCus = document.getElementById('dash-customers');
                    const elBook = document.getElementById('dash-bookings');
                    if (elRev) elRev.innerText = formatPrice(totalRevenue);
                    if (elCus) elCus.innerText = uniqueCustomers.size.toString();
                    if (elBook) elBook.innerText = totalOrders.toString();


                    Object.values(grouped).forEach(b => {
                        let statusHtml = '';
                        if (b.status === 'Pending') statusHtml = '<span class="role-badge" style="background:#fef3c7; color:#d97706;">Chờ thanh toán</span>';
                        else if (b.status === 'AwaitingConfirmation') statusHtml = '<span class="role-badge" style="background:#e0e7ff; color:#4338ca;">Chờ xác nhận</span>';
                        else if (b.status === 'Confirmed') statusHtml = '<span class="role-badge" style="background:#dcfce3; color:#16a34a;">Thành công</span>';
                        else if (b.status === 'Cancelled') statusHtml = '<span class="role-badge" style="background:#fee2e2; color:#dc2626;">Đã hủy</span>';
                        else statusHtml = b.status;

                        let actionsHtml = `<div style="display: flex; gap: 8px; justify-content: flex-end;">`;
                        actionsHtml += `<button class="btn-sm btn-outline" style="border-color:#0d9488; color:#0d9488;" onclick="downloadInvoiceDirectly('${b.bookingCode}')">📥 Tải PDF</button>`;
                        
                        if (b.status === 'AwaitingConfirmation' || b.status === 'Pending') {
                            actionsHtml += `<button class="btn-sm btn-outline" style="border-color:#10b981; color:#10b981;" onclick="updateBookingGroupStatus('${b.bookingCode}', 'Confirmed')">Xác nhận</button>`;
                            actionsHtml += `<button class="btn-sm btn-outline" style="border-color:#ef4444; color:#ef4444;" onclick="updateBookingGroupStatus('${b.bookingCode}', 'Cancelled')">Hủy</button>`;
                        }
                        actionsHtml += `</div>`;

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
                } else {
                    const errorText = await response.text();
                    document.getElementById('bookings-table-body').innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Lỗi tải dữ liệu: ${errorText || response.statusText}</td></tr>`;
                }
            } catch (err) {
                console.error("Lỗi lấy danh sách booking:", err);
                const tbody = document.getElementById('bookings-table-body');
                if(tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Lỗi: ${err.message}</td></tr>`;
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
                                    <a href="/admin/cruise-editor.html?id=${c.cruiseId}" style="flex: 1; text-align: center; border-radius: 6px; padding: 8px; border: none; font-size: 14px; cursor: pointer; background-color: var(--primary); color: white; text-decoration: none; display: flex; align-items: center; justify-content: center;">Sửa</a>
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
                    document.getElementById('cruise-dest-input').value = c.destinationId || '1'; 
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
                } else {
                    const errorText = await response.text();
                    document.getElementById('user-table-body').innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Lỗi tải dữ liệu: ${errorText || response.statusText}</td></tr>`;
                }
            } catch (err) {
                console.error("Lỗi lấy danh sách user:", err);
                const tbody = document.getElementById('user-table-body');
                if(tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Lỗi: ${err.message}</td></tr>`;
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

window.downloadInvoiceDirectly = function(code) {
    try {
        const grp = window.adminGroupedBookings ? window.adminGroupedBookings[code] : null;
        if(!grp) {
            alert("Không tìm thấy dữ liệu hóa đơn. Vui lòng tải lại trang.");
            return;
        }

        const formatPrice = (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
        let firstItem = (grp.items && grp.items.length > 0) ? grp.items[0] : grp;
        
        // Decode JWT to get staff's name
        const jwtData = (() => {
            const token = localStorage.getItem('auth_token');
            if (!token) return null;
            try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
        })();
        const staffName = jwtData ? (jwtData['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || jwtData['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/email'] || 'Admin') : 'Admin (Hệ thống)';
        let approver = (firstItem.status === 'Confirmed' || firstItem.status === 'Cancelled') ? staffName : 'Chưa duyệt';
        
        let html = `
        <div style="padding: 30px; font-family: 'Inter', sans-serif; color: #0f172a; max-width: 800px; margin: 0 auto;">
            <h2 style="text-align: center; color: #0f172a; margin-bottom: 24px;">HÓA ĐƠN ĐẶT PHÒNG</h2>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; font-size:14px;">
                <div><strong>Mã đơn:</strong> ${code}</div>
                <div><strong>Khách hàng:</strong> ${grp.contactName || ''}</div>
                <div><strong>Điện thoại:</strong> ${grp.contactPhone || ''}</div>
                <div><strong>Du thuyền:</strong> ${grp.cruiseName || ''}</div>
                <div><strong>Khởi hành:</strong> ${grp.departureDate ? new Date(grp.departureDate).toLocaleDateString('vi-VN') : ''}</div>
                <div><strong>Ngày tạo:</strong> ${firstItem.createdAt ? new Date(firstItem.createdAt).toLocaleString('vi-VN') : ''}</div>
                <div><strong>Trạng thái:</strong> <span style="color:${firstItem.status === 'Confirmed' ? '#16a34a' : '#ea580c'}; font-weight:600;">${firstItem.status === 'Confirmed' ? 'Đã thanh toán' : (firstItem.status === 'Cancelled' ? 'Đã hủy' : 'Chờ xác nhận')}</span></div>
                <div><strong>Xác nhận bởi:</strong> ${approver}</div>
            </div>
            
            <h4 style="margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Chi tiết phòng</h4>
        `;

        if (grp.items) {
            grp.items.forEach(item => {
                const unitPrice = item.numberOfRooms > 0 ? item.totalPrice / item.numberOfRooms : item.totalPrice;
                html += `
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:14px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 12px;">
                    <div>
                        <div style="font-weight:600;">${item.cabinName || ''}</div>
                        <div style="color:#64748b;">${formatPrice(unitPrice)} × ${item.numberOfRooms || 0} phòng</div>
                    </div>
                    <div style="font-weight:600;">${formatPrice(item.totalPrice || 0)}</div>
                </div>`;
            });
        }

        const allPayments = (grp.items || []).reduce((acc, i) => acc.concat(i.payments || []), []);
        if (allPayments.length > 0) {
            const p = allPayments[0];
            const pMethod = p.paymentMethod === 'BankTransfer' ? 'Chuyển khoản NH' : p.paymentMethod === 'Cash' ? 'Tiền mặt' : p.paymentMethod;
            html += `
            <div style="margin-top:20px; font-size:14px;">
                <h4 style="margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Thanh toán</h4>
                <div><strong>Phương thức:</strong> ${pMethod}</div>
                ${p.transactionCode ? `<div><strong>Mã GD:</strong> ${p.transactionCode}</div>` : ''}
            </div>`;
        }

        html += `
            <div style="margin-top:24px; padding:16px; background:#f8fafc; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600;">Tổng cộng:</span>
                <span style="font-size:18px; font-weight:700; color:#ef4444;">${formatPrice(grp.totalPrice || 0)}</span>
            </div>
        </div>`;

        if (typeof html2pdf === 'undefined') {
            alert("Thư viện tải PDF chưa sẵn sàng. Vui lòng đợi hoặc thử lại.");
            return;
        }

        html2pdf().set({
            margin: 10,
            filename: `HoaDon_${code}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(html).save();

    } catch (err) {
        console.error("Lỗi khi tải PDF:", err);
        alert("Lỗi tải hóa đơn: " + err.message);
    }
};
