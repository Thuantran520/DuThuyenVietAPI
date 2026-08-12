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
                    setTimeout(() => { window.location.href = '/login.html'; }, 1500);
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
            window.location.href = '/login.html';
            return;
        }

        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'block';

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

                    const elUsername = document.getElementById('val-username');
                    if (elUsername) elUsername.innerText = userName;

                    const elEmail = document.getElementById('val-email');
                    if (elEmail) elEmail.innerText = email;

                    const elFullname = document.getElementById('val-fullname');
                    if (elFullname) elFullname.innerText = fullName;

                    const elPhone = document.getElementById('val-phone');
                    if (elPhone) elPhone.innerText = phone;

                    const inputFullname = document.getElementById('input-fullname');
                    if (inputFullname) inputFullname.value = fullName === 'Chưa cập nhật' ? '' : fullName;

                    const inputPhone = document.getElementById('input-phone');
                    if (inputPhone) inputPhone.value = phone === 'Chưa cập nhật' ? '' : phone;

                    // Avatar logic
                    const letter = document.getElementById('avatarLetter');
                    const img = document.getElementById('avatarImage');
                    if (letter && img) {
                        if (avatarUrl) {
                            img.src = avatarUrl;
                            img.style.display = 'block';
                            letter.style.display = 'none';
                        } else {
                            img.style.display = 'none';
                            letter.style.display = 'block';
                            letter.innerText = (fullName !== 'Chưa cập nhật' ? fullName : email).charAt(0).toUpperCase();
                        }
                    }

                    // Roles
                    const userRoles = data.roles || data.Roles || [];
                    const rolesContainer = document.getElementById('val-roles');
                    if (rolesContainer) {
                        rolesContainer.innerHTML = '';
                        if (userRoles.length > 0) {
                            userRoles.forEach(role => {
                                rolesContainer.innerHTML += `<span class="role-badge ${role.toLowerCase() === 'admin' ? 'admin' : ''}">${role}</span>`;
                            });
                        } else {
                            rolesContainer.innerHTML = `<span style="color: #9ca3af">Customer</span>`;
                        }
                    }

                    // Determine roles (we still need this even if no rolesContainer)
                    if (userRoles.length > 0) {
                        userRoles.forEach(role => {
                            if (role.toLowerCase() === 'admin') isAdmin = true;
                            if (role.toLowerCase() === 'manager') isManager = true;
                            if (role.toLowerCase() === 'staff') isStaff = true;
                        });
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

                    const tabPromotionsNav = document.getElementById('tab-promotions-nav');
                    if (tabPromotionsNav && (isAdmin || isManager || isStaff)) {
                        tabPromotionsNav.style.display = 'block';
                    }
                    
                    const tabBookingsNav = document.getElementById('tab-bookings-nav');
                    if (tabBookingsNav && (isAdmin || isManager || isStaff)) {
                        tabBookingsNav.style.display = 'block';
                        loadAdminBookings();
                    }
                    
                    const tabNotesNav = document.getElementById('tab-notes-nav');
                    if (tabNotesNav && (isAdmin || isManager || isStaff)) {
                        tabNotesNav.style.display = 'block';
                    }
                    
                    const tabCruisesNav = document.getElementById('tab-cruises-nav');
                    if (tabCruisesNav && (isAdmin || isManager || isStaff)) {
                        tabCruisesNav.style.display = 'block';
                        loadAdminCruises();
                    }

                    if (loader) loader.style.display = 'none';
                    mainContent.style.display = 'block';
                } else {
                    localStorage.removeItem('auth_token');
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error(error);
                Popup.show('Lỗi', 'Lỗi lấy thông tin: ' + (error.stack || error.message), 'error');
            }
        }
        
        loadProfile();

        // --- Tab Logic ---
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => {
                    c.classList.remove('active');
                    c.style.display = ''; // clear inline display:none so CSS class works
                });
                
                tab.classList.add('active');
                const targetEl = document.getElementById(tab.getAttribute('data-target'));
                if (targetEl) targetEl.classList.add('active');
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

        if (btnEdit) {
            btnEdit.addEventListener('click', () => {
                valFullname.style.display = 'none'; formFullname.style.display = 'block';
                valPhone.style.display = 'none'; formPhone.style.display = 'block';
                viewActions.style.display = 'none'; editActions.style.display = 'flex';
            });
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                valFullname.style.display = 'block'; formFullname.style.display = 'none';
                valPhone.style.display = 'block'; formPhone.style.display = 'none';
                viewActions.style.display = 'flex'; editActions.style.display = 'none';
            });
        }

        // --- Save Profile ---
        const btnSave = document.getElementById('btnSaveProfile');
        const inputFullname = document.getElementById('input-fullname');
        const inputPhone = document.getElementById('input-phone');
        if (btnSave) {
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
        }

        // --- Upload Avatar ---
        const avatarUpload = document.getElementById('avatarUpload');
        const avatarStatus = document.getElementById('avatarStatus');
        
        if (avatarUpload) {
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
        }

        // --- Change Password Form Submit ---
        window.changePasswordSubmit = async () => {
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                Popup.show('Lỗi', 'Mật khẩu mới và xác nhận mật khẩu mới không khớp!', 'error');
                return;
            }

            const btnSubmit = document.querySelector('#changePasswordForm button[type="submit"]');
            const originalText = btnSubmit ? btnSubmit.innerText : 'Lưu mật khẩu mới';
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerText = 'Đang đổi...';
            }

            try {
                const response = await fetch('/api/account/change-password', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ oldPassword, newPassword })
                });

                const data = await response.json();
                if (response.ok) {
                    Popup.show('Thành công', 'Đổi mật khẩu thành công!', 'success');
                    document.getElementById('changePasswordForm').reset();
                } else {
                    Popup.show('Lỗi', data.message || 'Thay đổi mật khẩu thất bại.', 'error');
                }
            } catch (error) {
                console.error(error);
                Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerText = originalText;
                }
            }
        };

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
                    let totalNotes = 0;

                    Object.values(grouped).forEach(b => {
                        if (b.status === 'Confirmed') {
                            totalRevenue += b.totalPrice;
                        }
                        if (b.contactPhone) uniqueCustomers.add(b.contactPhone);
                        totalOrders++;
                        if (b.note && b.note.trim() !== '') totalNotes++;
                    });

                    const elRev = document.getElementById('dash-revenue');
                    const elCus = document.getElementById('dash-customers');
                    const elBook = document.getElementById('dash-bookings');
                    if (elRev) elRev.innerText = formatPrice(totalRevenue);
                    if (elCus) elCus.innerText = uniqueCustomers.size.toString();
                    if (elBook) elBook.innerText = totalOrders.toString();

                    // Update notes dashboard card count (no badge on tab)
                    const elNotes = document.getElementById('dash-notes');
                    if (elNotes) elNotes.innerText = totalNotes.toString();

                        // Sử dụng hàm lọc để render thay vì render trực tiếp
                        filterAdminBookings();
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

        // --- Notes / Special Requests Table ---
        function loadNotesTable() {
            const tbody = document.getElementById('notes-table-body');
            if (!tbody) return;

            // Re-use adminGroupedBookings if already loaded
            const grouped = window.adminGroupedBookings;
            if (!grouped) {
                // Not loaded yet — wait until loadAdminBookings resolves
                // We listen for a custom event dispatched after loading
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Vui lòng vào tab Quản lý Đặt Phòng trước.</td></tr>';
                return;
            }

            const withNotes = Object.values(grouped).filter(b => b.note && b.note.trim() !== '');
            if (withNotes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#6b7280;">Không có yêu cầu đặc biệt nào từ khách hàng.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            withNotes.forEach(b => {
                let statusHtml = '';
                if (b.status === 'Pending') statusHtml = '<span class="role-badge" style="background:#fef3c7; color:#d97706;">Chờ thanh toán</span>';
                else if (b.status === 'AwaitingConfirmation') statusHtml = '<span class="role-badge" style="background:#e0e7ff; color:#4338ca;">Chờ xác nhận</span>';
                else if (b.status === 'Confirmed') statusHtml = '<span class="role-badge" style="background:#dcfce3; color:#16a34a;">Thành công</span>';
                else if (b.status === 'Cancelled') statusHtml = '<span class="role-badge" style="background:#fee2e2; color:#dc2626;">Đã hủy</span>';
                else statusHtml = b.status;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: 500;">
                        ${b.bookingCode}
                        <button onclick="copyToClipboard('${b.bookingCode}')" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:0 5px;" title="Sao chép">📋</button>
                    </td>
                    <td>
                        <strong>${b.contactName}</strong><br>
                        <small class="text-muted">${b.contactPhone}</small>
                    </td>
                    <td>
                        ${b.cruiseName}<br>
                        <small class="text-muted">${b.departureDate ? new Date(b.departureDate).toLocaleDateString('vi-VN') : 'Chưa xác định'}</small>
                    </td>
                    <td>
                        <div style="background: #f0fdfa; border-left: 3px solid #0d9488; padding: 10px 12px; border-radius: 6px; color: #0f172a; font-size: 0.95rem; line-height: 1.5;">
                            📝 ${b.note}
                        </div>
                    </td>
                    <td>${statusHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Trigger notes table load when tab-notes is clicked
        document.querySelectorAll('.tab').forEach(tab => {
            if (tab.getAttribute('data-target') === 'tab-notes') {
                tab.addEventListener('click', () => loadNotesTable());
            }
        });
        
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
                                <h3 class="cruise-title"><a href="/du-thuyen/${c.cruiseId}-${window.generateSlug(c.name)}">${c.name}</a></h3>
                                <div class="cruise-meta mb-3">
                                    <span class="rating">⭐ ${c.averageRating} (${c.reviewCount})</span>
                                    <span class="destination"><img src="/images/Direction.svg" alt="Location" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 4px;"> ${c.destinationName}</span>
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
                    if (!tbody) return;
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

window.downloadInvoiceDirectly = function(code, btnEl) {
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Đang tạo...'; }
    const restore = () => { if (btnEl) { btnEl.disabled = false; btnEl.textContent = '📥 Tải hóa đơn (PDF)'; } };

    const grp = (window.adminGroupedBookings && window.adminGroupedBookings[code]) ||
                (window.customerGroupedBookings && window.customerGroupedBookings[code]) || null;
    if (!grp) { restore(); alert('Dữ liệu chưa tải xong. Vui lòng đợi vài giây rồi thử lại.'); return; }

    const fmt = p => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const items  = (grp.items && grp.items.length > 0) ? grp.items : [grp];
    const first  = items[0];
    const name   = esc(grp.contactName   || first.contactName   || '');
    const phone  = esc(grp.contactPhone  || first.contactPhone  || '');
    const cruise = esc(grp.cruiseName    || first.cruiseName    || '');
    const depD   = grp.departureDate || first.departureDate || '';
    const note   = esc(grp.note          || first.note          || '');
    const cAt    = grp.createdAt     || first.createdAt     || '';
    const status = grp.status        || first.status        || '';
    const total  = grp.totalPrice    || items.reduce((s,i) => s+(i.totalPrice||0), 0);
    const stLabel= status==='Confirmed' ? 'Đã thanh toán' : status==='Cancelled' ? 'Đã hủy' : 'Chờ xác nhận';

    const jwtD = (() => { try { const t=localStorage.getItem('auth_token'); return t?JSON.parse(atob(t.split('.')[1])):null; } catch{return null;} })();
    const staff = jwtD?(jwtD['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']||jwtD['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/email']||'Admin'):'Admin';
    const approver = (status==='Confirmed'||status==='Cancelled') ? staff : 'Chưa duyệt';

    const allPay = items.reduce((a,i)=>a.concat(i.payments||[]),[]);
    const payStr = allPay.length>0
        ? (allPay[0].paymentMethod==='BankTransfer'?'Chuyển khoản':allPay[0].paymentMethod==='Cash'?'Tiền mặt':esc(allPay[0].paymentMethod||''))
          + (allPay[0].transactionCode ? ' – Mã GD: '+esc(allPay[0].transactionCode) : '')
        : 'Chưa thanh toán';

    let roomRows = '';
    items.forEach(item => {
        const r = item.numberOfRooms||1;
        const t = item.totalPrice||0;
        const u = r>0?t/r:t;
        roomRows += '<tr><td>'+esc(item.cabinName||'Phòng')+'</td><td style="text-align:center">'+r+'</td><td style="text-align:right">'+fmt(u)+'</td><td style="text-align:right;font-weight:bold">'+fmt(t)+'</td></tr>';
    });

    const html = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">' +
    '<title>Hóa đơn '+code+'</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;font-size:13px;color:#000;margin:20px;background:#fff}' +
    'h1{font-size:18px;text-align:center;margin:0 0 4px}' +
    '.sub{text-align:center;font-size:12px;margin:0 0 16px}' +
    'hr{border:1px solid #000;margin:10px 0}' +
    '.info td{padding:3px 8px;vertical-align:top}' +
    '.info td:first-child{width:38%;color:#333;white-space:nowrap}' +
    'table.items{width:100%;border-collapse:collapse;margin:12px 0}' +
    'table.items th,table.items td{border:1px solid #000;padding:6px 8px;font-size:13px}' +
    'table.items th{background:#f0f0f0;font-weight:bold}' +
    '.total-row td{font-weight:bold;font-size:15px;padding:10px 8px;border-top:2px solid #000}' +
    '.footer{text-align:center;font-size:11px;font-style:italic;margin-top:14px;color:#444}' +
    '@media print{body{margin:0} button{display:none}} @page{margin:15mm; size:A4;}' +
    '</style></head><body>' +
    '<h1>HÓA ĐƠN ĐẶT PHÒNG</h1>' +
    '<p class="sub">Du Thuyền Việt &nbsp;—&nbsp; Mã đơn: <b>'+code+'</b></p>' +
    '<hr>' +
    '<table class="info"><tbody>' +
    '<tr><td>Khách hàng</td><td><b>'+name+'</b></td></tr>' +
    '<tr><td>Điện thoại</td><td>'+phone+'</td></tr>' +
    '<tr><td>Du thuyền</td><td><b>'+cruise+'</b></td></tr>' +
    '<tr><td>Ngày khởi hành</td><td>'+(depD?new Date(depD).toLocaleDateString('vi-VN'):'')+'</td></tr>' +
    '<tr><td>Ngày đặt</td><td>'+(cAt?new Date(cAt).toLocaleString('vi-VN'):'')+'</td></tr>' +
    '<tr><td>Trạng thái</td><td><b>'+stLabel+'</b></td></tr>' +
    '<tr><td>Thanh toán</td><td>'+payStr+'</td></tr>' +
    '<tr><td>Xác nhận bởi</td><td>'+approver+'</td></tr>' +
    (note?'<tr><td style="vertical-align:top">Ghi chú</td><td><i>'+note+'</i></td></tr>':'') +
    '</tbody></table>' +
    '<hr>' +
    '<table class="items"><thead><tr><th style="text-align:left">Loại phòng</th><th>Số phòng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>' +
    '<tbody>'+roomRows+'</tbody>' +
    '<tfoot><tr class="total-row"><td colspan="3">TỔNG THANH TOÁN</td><td style="text-align:right">'+fmt(total)+'</td></tr></tfoot>' +
    '</table>' +
    '<p class="footer">Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ của Du Thuyền Việt!</p>' +
    '<div style="text-align:center;margin-top:10px;">' +
    '<button onclick="window.print()" style="padding:10px 28px;font-size:14px;cursor:pointer;background:#000;color:#fff;border:none;border-radius:4px;">🖨️ In / Lưu PDF</button>' +
    '</div>' +
    '</body></html>';

    // Mở cửa sổ mới, in thẳng — không dùng thư viện, không tích lũy state
    const win = window.open('', '_blank', 'width=820,height=900,scrollbars=yes');
    if (!win) { restore(); alert('Trình duyệt chặn popup. Vui lòng cho phép popup rồi thử lại.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    // Đợi render xong rồi mở hộp thoại in
    setTimeout(() => {
        win.print();
        restore();
    }, 600);
};

window.filterAdminBookings = function() {
    const searchEl = document.getElementById('adminBookingSearch');
    const statusEl = document.getElementById('adminBookingStatusFilter');
    
    const searchTerm = (searchEl ? searchEl.value : '').toLowerCase();
    const statusFilter = statusEl ? statusEl.value : 'all';
    
    const tbody = document.getElementById('bookings-table-body');
    if (!tbody) return;

    if (!window.adminGroupedBookings) return;

    const filtered = Object.values(window.adminGroupedBookings).filter(b => {
        let firstItem = (b.items && b.items.length > 0) ? b.items[0] : b;
        let bStatus = firstItem.status;
        
        // Check Status
        if (statusFilter !== 'all' && bStatus !== statusFilter) return false;
        
        // Check Search (BookingCode, Name, Phone, Note)
        if (searchTerm) {
            const matchesCode = (b.bookingCode || '').toLowerCase().includes(searchTerm);
            const matchesName = (b.contactName || '').toLowerCase().includes(searchTerm);
            const matchesPhone = (b.contactPhone || '').toLowerCase().includes(searchTerm);
            const matchesNote = (b.note || '').toLowerCase().includes(searchTerm);
            if (!matchesCode && !matchesName && !matchesPhone && !matchesNote) return false;
        }
        
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#6b7280; padding:20px;">Không tìm thấy đơn nào phù hợp.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    const formatPrice = (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    
    // Sắp xếp các đơn mới nhất lên đầu (theo createdAt)
    filtered.sort((a, b) => {
        let aDate = (a.items && a.items.length > 0 && a.items[0].createdAt) ? new Date(a.items[0].createdAt) : new Date(0);
        let bDate = (b.items && b.items.length > 0 && b.items[0].createdAt) ? new Date(b.items[0].createdAt) : new Date(0);
        return bDate - aDate;
    });

    filtered.forEach(b => {
        let firstItem = (b.items && b.items.length > 0) ? b.items[0] : b;
        let bStatus = firstItem.status;
        
        let statusHtml = '';
        if (bStatus === 'Pending') statusHtml = '<span class="role-badge" style="background:#fef3c7; color:#d97706;">Chờ thanh toán</span>';
        else if (bStatus === 'AwaitingConfirmation') statusHtml = '<span class="role-badge" style="background:#e0e7ff; color:#4338ca;">Chờ xác nhận</span>';
        else if (bStatus === 'Confirmed') statusHtml = '<span class="role-badge" style="background:#dcfce3; color:#16a34a;">Thành công</span>';
        else if (bStatus === 'Cancelled') statusHtml = '<span class="role-badge" style="background:#fee2e2; color:#dc2626;">Đã hủy</span>';
        else statusHtml = bStatus;

        // Check if departed
        let hasDeparted = false;
        if (b.departureDate) {
            let depDate = new Date(b.departureDate);
            depDate.setHours(0,0,0,0);
            let today = new Date();
            today.setHours(0,0,0,0);
            if (depDate < today) hasDeparted = true;
        }

        let actionsHtml = `<div style="display: flex; gap: 8px; justify-content: flex-end;">`;

        actionsHtml += `<button class="btn-sm btn-outline" style="border-color:#0d9488; color:#0d9488;" onclick="downloadInvoiceDirectly('${b.bookingCode}', this)">📥 Tải hóa đơn (PDF)</button>`;
        
        if (bStatus === 'AwaitingConfirmation' || bStatus === 'Pending') {
            actionsHtml += `<button class="btn-sm btn-outline" style="border-color:#10b981; color:#10b981;" onclick="updateBookingGroupStatus('${b.bookingCode}', 'Confirmed')">Xác nhận</button>`;
            actionsHtml += `<button class="btn-sm btn-outline" style="border-color:#ef4444; color:#ef4444;" onclick="updateBookingGroupStatus('${b.bookingCode}', 'Cancelled')">Hủy</button>`;
        }
        actionsHtml += `</div>`;

        const tr = document.createElement('tr');
        if (hasDeparted) tr.style.backgroundColor = '#fafafa';
        
        const opc = hasDeparted ? 'opacity: 0.6;' : '';
        tr.innerHTML = `
            <td style="font-weight: 500;">
                <div style="${opc}">
                    ${b.bookingCode}
                    <button onclick="copyToClipboard('${b.bookingCode}')" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:0 5px;" title="Sao chép">📋</button>
                    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${firstItem.createdAt ? new Date(firstItem.createdAt).toLocaleString('vi-VN') : ''}</div>
                </div>
            </td>
            <td>
                <div style="${opc}">
                    ${b.contactName}<br>
                    <small class="text-muted">${b.contactPhone}</small>
                    ${b.note ? `
                    <div onclick="window.showNotePopup('${b.bookingCode}')" style="cursor: pointer; margin-top: 12px; padding: 12px; background: ${hasDeparted ? '#f8fafc' : '#fff1f2'}; border: 1px solid ${hasDeparted ? '#e2e8f0' : '#fecdd3'}; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); min-width: 200px; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 14px;">${hasDeparted ? '📝' : '📌'}</span>
                                <span style="font-size: 11px; font-weight: 700; color: ${hasDeparted ? '#64748b' : '#e11d48'}; letter-spacing: 0.5px;">YÊU CẦU ĐẶC BIỆT</span>
                            </div>
                            <span style="font-size: 10px; color: ${hasDeparted ? '#94a3b8' : '#fda4af'}; font-weight: 600;">Chi tiết ↗</span>
                        </div>
                        <div style="color: ${hasDeparted ? '#64748b' : '#881337'}; font-size: 13px; font-weight: 500; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap;">${b.note.replace(/</g, '&lt;')}</div>
                    </div>` : ''}
                </div>
            </td>
            <td>
                <div style="${opc}">
                    ${b.cruiseName} 
                    ${hasDeparted ? '<span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-left:4px;">🛳️ Đã khởi hành</span>' : ''}
                    <br>
                    <small class="text-muted">Ngày đi: ${b.departureDate ? new Date(b.departureDate).toLocaleDateString('vi-VN') : ''}</small>
                </div>
            </td>
            <td style="font-weight: 600; color: #ef4444;"><div style="${opc}">${formatPrice(b.totalPrice)}</div></td>
            <td><div style="${opc}">${statusHtml}</div></td>
            <td style="text-align: right; white-space: nowrap;">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
};



// Show Note Popup
window.showNotePopup = function(bookingCode) {
    if (!window.adminGroupedBookings) return;
    const b = window.adminGroupedBookings[bookingCode];
    if (b && b.note && window.Popup && window.Popup.info) {
        let hasDeparted = false;
        if (b.departureDate) {
            let depDate = new Date(b.departureDate);
            depDate.setHours(0,0,0,0);
            let today = new Date();
            today.setHours(0,0,0,0);
            if (depDate < today) hasDeparted = true;
        }

        let html = `
            <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                <div style="color: #0f172a; font-weight: 500; margin-bottom: 8px;">Khách hàng: <span style="color: #3b82f6;">${b.contactName}</span></div>
                <div style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a; white-space: pre-wrap;">${b.note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>
        `;
        window.Popup.info('📌 Yêu cầu đặc biệt: ' + bookingCode, html);
    }
};
