// @ts-nocheck
document.addEventListener('DOMContentLoaded', async function () {
    // === Global Router Guard ===
    const auth = (typeof window.getAuthStatus === 'function') 
        ? window.getAuthStatus() 
        : (() => {
            try {
                const t = localStorage.getItem('auth_token');
                if (!t || t === 'null' || t === 'undefined') return { isLoggedIn: false, isAdmin: false };
                const p = JSON.parse(atob(t.split('.')[1]));
                if (p.exp && p.exp * 1000 < Date.now()) {
                    localStorage.removeItem('auth_token');
                    return { isLoggedIn: false, isAdmin: false };
                }
                const r = p['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || p['role'] || '';
                const roles = Array.isArray(r) ? r : [r.toString()];
                const isAdmin = roles.some(x => ['admin', 'manager', 'staff'].includes(x.toLowerCase()));
                return { isLoggedIn: true, isAdmin: isAdmin };
            } catch(e) {
                localStorage.removeItem('auth_token');
                return { isLoggedIn: false, isAdmin: false };
            }
        })();

    const path = window.location.pathname.toLowerCase();
    const isAuthPage = path.includes('login.html') || path.includes('register.html');
    const isCustomerProfile = (path.endsWith('/profile.html') || path.includes('/profile.html')) && !path.includes('/admin/');
    const isHistoryPage = path.includes('history.html');
    const isAdminArea = path.includes('/admin/');

    if (auth.isLoggedIn && isAuthPage) {
        // Đã đăng nhập nhưng cố vào trang đăng nhập/đăng ký
        window.location.replace(auth.isAdmin ? '/admin/profile.html' : '/index.html');
        return;
    }
    if (!auth.isLoggedIn && (isCustomerProfile || isAdminArea || isHistoryPage)) {
        // Chưa đăng nhập mà đòi vào trang cá nhân, lịch sử hoặc khu vực quản trị
        window.location.replace('/login.html');
        return;
    }
    if (auth.isLoggedIn && isAdminArea && !auth.isAdmin) {
        // Đăng nhập quyền khách hàng nhưng cố vào trang quản trị
        window.location.replace('/404.html');
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
                    if (window.Popup) Popup.show('Thành công', 'Đăng ký thành công! Hãy đăng nhập.', 'success');
                    else alert('Đăng ký thành công! Hãy đăng nhập.');
                    setTimeout(() => { window.location.href = '/login.html'; }, 1200);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    const errMsg = errorData.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại.';
                    if (window.Popup) Popup.show('Lỗi đăng ký', errMsg, 'error');
                    else alert(errMsg);
                }
            } catch (error) {
                console.error(error);
                if (window.Popup) Popup.show('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
                else alert('Không thể kết nối đến máy chủ.');
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
                    
                    const urlParams = new URLSearchParams(window.location.search);
                    const returnUrl = urlParams.get('returnUrl');
                    let redirectUrl = loginAsAdmin ? '/admin/profile.html' : (returnUrl || '/index.html');

                    alertBox.className = 'alert-success';
                    alertBox.innerHTML = 'Đăng nhập thành công! Đang chuyển hướng...';

                    if (window.Popup && typeof window.Popup.show === 'function') {
                        window.Popup.show('Thành công', 'Đăng nhập thành công! Đang chuyển hướng...', 'success');
                    }
                    setTimeout(() => { window.location.href = redirectUrl; }, 600);
                    return;
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
                        loadStaffPerformance();
                        loadAuditDisputes();
                    }

                    const tabPromotionsNav = document.getElementById('tab-promotions-nav');
                    if (tabPromotionsNav && (isAdmin || isManager || isStaff)) {
                        tabPromotionsNav.style.display = 'block';
                    }

                    const tabAdsNav = document.getElementById('tab-ads-nav');
                    if (tabAdsNav && (isAdmin || isManager || isStaff)) {
                        tabAdsNav.style.display = 'block';
                        if (window.loadAds) window.loadAds();
                    }

                    const tabChatNav = document.getElementById('tab-chat-nav');
                    if (tabChatNav && (isAdmin || isManager || isStaff)) {
                        tabChatNav.style.display = 'block';
                        if (window.loadConversations) window.loadConversations();
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

                    if (window.location.pathname.includes('users.html')) {
                        loadAdminUsers();
                        loadStaffPerformance();
                        loadAuditDisputes();
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
                const targetId = tab.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.classList.add('active');
                    if (targetId === 'tab-admin') {
                        loadAdminUsers();
                        loadStaffPerformance();
                        loadAuditDisputes();
                    }
                }
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
        
        window.revenueChartInstance = null;
        window.statusChartInstance = null;
        window.ordersChartInstance = null;
        window.topCruiseChartInstance = null;

        function renderAdminCharts(grouped) {
            if (typeof Chart === 'undefined') return;
            
            const bookings = Object.values(grouped);
            
            const filterEl = document.getElementById('biFilter');
            const days = filterEl ? parseInt(filterEl.value) || 7 : 7;
            
            const titleEl = document.getElementById('revenueChartTitle');
            const titleOrdersEl = document.getElementById('ordersChartTitle');
            if (titleEl) {
                if (days === 7) {
                    titleEl.innerText = 'Doanh thu 7 ngày qua';
                    if (titleOrdersEl) titleOrdersEl.innerText = 'Số lượng đơn đặt 7 ngày qua';
                }
                else if (days === 30) {
                    titleEl.innerText = 'Doanh thu 30 ngày qua';
                    if (titleOrdersEl) titleOrdersEl.innerText = 'Số lượng đơn đặt 30 ngày qua';
                }
                else if (days === 180) {
                    titleEl.innerText = 'Doanh thu 6 tháng qua';
                    if (titleOrdersEl) titleOrdersEl.innerText = 'Số lượng đơn đặt 6 tháng qua';
                }
                else if (days === 365) {
                    titleEl.innerText = 'Doanh thu 1 năm qua';
                    if (titleOrdersEl) titleOrdersEl.innerText = 'Số lượng đơn đặt 1 năm qua';
                }
            }
            
            // 1. Status Chart (Lọc theo số ngày)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const filteredBookings = bookings.filter(b => {
                if (!b.createdAt) return false;
                return new Date(b.createdAt) >= cutoffDate;
            });
            
            const statusCounts = { Pending: 0, AwaitingConfirmation: 0, Confirmed: 0, Cancelled: 0 };
            filteredBookings.forEach(b => {
                if (statusCounts[b.status] !== undefined) statusCounts[b.status]++;
                else statusCounts[b.status] = 1;
            });
            
            const ctxStatus = document.getElementById('statusChart');
            if (ctxStatus) {
                if (window.statusChartInstance) window.statusChartInstance.destroy();
                
                // Đăng ký plugin datalabels nếu có
                const plugins = [];
                if (typeof ChartDataLabels !== 'undefined') {
                    Chart.register(ChartDataLabels);
                    plugins.push(ChartDataLabels);
                }
                
                window.statusChartInstance = new Chart(ctxStatus, {
                    type: 'doughnut',
                    data: {
                        labels: ['Chờ thanh toán', 'Chờ xác nhận', 'Thành công', 'Đã hủy'],
                        datasets: [{
                            data: [statusCounts.Pending || 0, statusCounts.AwaitingConfirmation || 0, statusCounts.Confirmed || 0, statusCounts.Cancelled || 0],
                            backgroundColor: ['#fef3c7', '#e0e7ff', '#dcfce3', '#fee2e2'],
                            borderColor: ['#d97706', '#4338ca', '#16a34a', '#dc2626'],
                            borderWidth: 1
                        }]
                    },
                    plugins: plugins,
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: {
                            datalabels: {
                                formatter: (value, ctx) => {
                                    let sum = 0;
                                    let dataArr = ctx.chart.data.datasets[0].data;
                                    dataArr.map(data => { sum += data; });
                                    if (sum === 0 || value === 0) return '';
                                    let percentage = Math.round((value * 100) / sum) + "%";
                                    return percentage;
                                },
                                color: '#1e293b',
                                font: {
                                    weight: 'bold',
                                    size: 14
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        let value = context.parsed;
                                        let sum = 0;
                                        let dataArr = context.dataset.data;
                                        dataArr.map(data => { sum += data; });
                                        let percentage = sum > 0 ? Math.round((value * 100) / sum) + "%" : "0%";
                                        return label + value + ' đơn (' + percentage + ')';
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // 1b. Payment Method Chart (Biểu đồ tròn Cơ cấu Cổng thanh toán)
            let vnpayRev = 0, vietqrRev = 0, paypalRev = 0, cashRev = 0;
            bookings.forEach(b => {
                if (b.status === 'Confirmed') {
                    const allPay = (b.items || []).reduce((acc, it) => acc.concat(it.payments || []), b.payments || []);
                    const m = allPay.length > 0 ? (allPay[0].paymentMethod || '') : '';
                    if (m === 'VNPAY') vnpayRev += b.totalPrice;
                    else if (m === 'PayPal') paypalRev += b.totalPrice;
                    else if (m === 'VietQR' || m === 'BankTransfer') vietqrRev += b.totalPrice;
                    else if (m === 'Cash') cashRev += b.totalPrice;
                }
            });

            const ctxPay = document.getElementById('paymentMethodChart');
            if (ctxPay) {
                if (window.paymentMethodChartInstance) window.paymentMethodChartInstance.destroy();
                window.paymentMethodChartInstance = new Chart(ctxPay, {
                    type: 'doughnut',
                    data: {
                        labels: ['Cổng VNPAY', 'VietQR', 'PayPal', 'Tiền mặt'],
                        datasets: [{
                            data: [vnpayRev, vietqrRev, paypalRev, cashRev],
                            backgroundColor: ['#005baa', '#0d9488', '#003087', '#d97706'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const pct = sum > 0 ? Math.round((value * 100) / sum) + '%' : '0%';
                                        return `${label}: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)} (${pct})`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            // 2 & 3. Revenue Chart & Orders Chart
            const dates = [];
            const revenues = [];
            const orderCounts = [];
            
            if (days <= 30) {
                // Group by day
                for (let i = days - 1; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    dates.push(d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }));
                    revenues.push(0);
                    orderCounts.push(0);
                }
                
                filteredBookings.forEach(b => {
                    if (b.createdAt) {
                        const bDate = new Date(b.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                        const idx = dates.indexOf(bDate);
                        if (idx !== -1) {
                            if (b.status === 'Confirmed') revenues[idx] += b.totalPrice;
                            orderCounts[idx] += 1;
                        }
                    }
                });
            } else {
                // Group by month
                const monthsToShow = days === 180 ? 6 : 12;
                for (let i = monthsToShow - 1; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    dates.push(d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }));
                    revenues.push(0);
                    orderCounts.push(0);
                }
                
                filteredBookings.forEach(b => {
                    if (b.createdAt) {
                        const bDate = new Date(b.createdAt).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
                        const idx = dates.indexOf(bDate);
                        if (idx !== -1) {
                            if (b.status === 'Confirmed') revenues[idx] += b.totalPrice;
                            orderCounts[idx] += 1;
                        }
                    }
                });
            }
            
            const ctxRev = document.getElementById('revenueChart');
            if (ctxRev) {
                if (window.revenueChartInstance) window.revenueChartInstance.destroy();
                window.revenueChartInstance = new Chart(ctxRev, {
                    type: 'bar',
                    data: {
                        labels: dates,
                        datasets: [{
                            label: 'Doanh thu (VNĐ)',
                            data: revenues,
                            backgroundColor: 'rgba(5, 150, 105, 0.7)',
                            borderColor: 'rgba(5, 150, 105, 1)',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
                                    }
                                }
                            }
                        },
                        plugins: {
                            datalabels: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) label += ': ';
                                        if (context.parsed.y !== null) {
                                            label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.parsed.y);
                                        }
                                        return label;
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            const ctxOrders = document.getElementById('ordersChart');
            if (ctxOrders) {
                if (window.ordersChartInstance) window.ordersChartInstance.destroy();
                window.ordersChartInstance = new Chart(ctxOrders, {
                    type: 'line',
                    data: {
                        labels: dates,
                        datasets: [{
                            label: 'Số lượng đơn đặt',
                            data: orderCounts,
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderColor: 'rgba(59, 130, 246, 1)',
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                        plugins: { datalabels: { display: false } }
                    }
                });
            }
            
            // 4. Top Cruises Chart (Horizontal Bar)
            const cruiseStats = {};
            filteredBookings.forEach(b => {
                if (b.status === 'Confirmed') {
                    const name = b.cruiseName || 'Khác';
                    if (!cruiseStats[name]) cruiseStats[name] = 0;
                    cruiseStats[name] += 1;
                }
            });
            const sortedCruises = Object.entries(cruiseStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const cruiseLabels = sortedCruises.map(x => x[0]);
            const cruiseData = sortedCruises.map(x => x[1]);

            const ctxTop = document.getElementById('topCruiseChart');
            if (ctxTop) {
                if (window.topCruiseChartInstance) window.topCruiseChartInstance.destroy();
                window.topCruiseChartInstance = new Chart(ctxTop, {
                    type: 'bar',
                    data: {
                        labels: cruiseLabels.length > 0 ? cruiseLabels : ['Chưa có dữ liệu'],
                        datasets: [{
                            label: 'Số đơn thành công',
                            data: cruiseData.length > 0 ? cruiseData : [0],
                            backgroundColor: 'rgba(245, 158, 11, 0.7)',
                            borderColor: 'rgba(245, 158, 11, 1)',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: { 
                        indexAxis: 'y',
                        responsive: true, 
                        maintainAspectRatio: false,
                        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
                        plugins: { datalabels: { display: false } }
                    }
                });
            }
        }
        
        window.updateBICharts = function() {
            if (window.adminGroupedBookings) {
                renderAdminCharts(window.adminGroupedBookings);
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

                    let revByMethod = {
                        VNPAY: { amount: 0, count: 0 },
                        VietQR: { amount: 0, count: 0 },
                        PayPal: { amount: 0, count: 0 },
                        Cash: { amount: 0, count: 0 }
                    };

                    Object.values(grouped).forEach(b => {
                        const allPay = (b.items || []).reduce((acc, it) => acc.concat(it.payments || []), b.payments || []);
                        const payMethod = allPay.length > 0 ? (allPay[0].paymentMethod || '') : '';

                        if (b.status === 'Confirmed') {
                            totalRevenue += b.totalPrice;
                            if (payMethod === 'VNPAY') {
                                revByMethod.VNPAY.amount += b.totalPrice;
                                revByMethod.VNPAY.count++;
                            } else if (payMethod === 'PayPal') {
                                revByMethod.PayPal.amount += b.totalPrice;
                                revByMethod.PayPal.count++;
                            } else if (payMethod === 'VietQR' || payMethod === 'BankTransfer') {
                                revByMethod.VietQR.amount += b.totalPrice;
                                revByMethod.VietQR.count++;
                            } else if (payMethod === 'Cash') {
                                revByMethod.Cash.amount += b.totalPrice;
                                revByMethod.Cash.count++;
                            }
                        }
                        if (b.contactPhone) uniqueCustomers.add(b.contactPhone);
                        totalOrders++;
                        if (b.note && b.note.trim() !== '') totalNotes++;
                    });

                    // Cập nhật thẻ KPI doanh thu theo từng phương thức thanh toán
                    const setRev = (idPrefix, data) => {
                        const elAmt = document.getElementById(`rev-${idPrefix}-amount`);
                        const elCnt = document.getElementById(`rev-${idPrefix}-count`);
                        if (elAmt) elAmt.innerText = formatPrice(data.amount);
                        if (elCnt) elCnt.innerText = `${data.count} đơn`;
                    };
                    setRev('vnpay', revByMethod.VNPAY);
                    setRev('vietqr', revByMethod.VietQR);
                    setRev('paypal', revByMethod.PayPal);
                    setRev('cash', revByMethod.Cash);

                    const elRev = document.getElementById('dash-revenue');
                    const elCus = document.getElementById('dash-customers');
                    const elBook = document.getElementById('dash-bookings');
                    if (elRev) elRev.innerText = formatPrice(totalRevenue);
                    if (elCus) elCus.innerText = uniqueCustomers.size.toString();
                    if (elBook) elBook.innerText = totalOrders.toString();

                    // Update notes dashboard card count (no badge on tab)
                    const elNotes = document.getElementById('dash-notes');
                    if (elNotes) elNotes.innerText = totalNotes.toString();

                    // Cập nhật biểu đồ BI Dashboard
                    renderAdminCharts(grouped);

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
                        <button onclick="copyToClipboard('${b.bookingCode}')" style="background:none; border:none; cursor:pointer; padding:0 5px;" title="Sao chép"><img src="/images/icons/clipboard.png" class="app-icon" alt="📋"></button>
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
                            <img src="/images/icons/note-edit.png" class="app-icon" alt=""> ${b.note}
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

        // --- Fetch Admin Cruises Data with Filters & Maintenance Controls ---
        let allAdminCruises = [];

        async function loadAdminCruises() {
            try {
                // Fetch all cruises including maintenance items
                const res = await fetch('/api/Cruises?pageSize=100&includeInactive=true');
                if (res.ok) {
                    const json = await res.json();
                    allAdminCruises = json.data || [];
                    
                    // Populate destinations dropdown for filter
                    populateCruiseDestFilter();
                    
                    // Bind filter event listeners once
                    setupCruiseFilterEvents();
                    
                    // Render with current filter
                    renderAdminCruisesGrid();
                }
            } catch (err) {
                console.error("Lỗi lấy danh sách du thuyền:", err);
            }
        }

        async function populateCruiseDestFilter() {
            const destSelect = document.getElementById('filter-cruise-dest');
            if (!destSelect || destSelect.dataset.loaded === 'true') return;
            try {
                const res = await fetch('/api/Destinations');
                if (res.ok) {
                    const dests = await res.json();
                    destSelect.innerHTML = '<option value="">Tất cả khu vực</option>' + dests.map(d => `<option value="${d.destinationId}">${d.name}</option>`).join('');
                    destSelect.dataset.loaded = 'true';
                }
            } catch {}
        }

        let cruiseFiltersBound = false;
        function setupCruiseFilterEvents() {
            if (cruiseFiltersBound) return;
            const searchInput = document.getElementById('filter-cruise-search');
            const destSelect = document.getElementById('filter-cruise-dest');
            const statusSelect = document.getElementById('filter-cruise-status');
            const sortSelect = document.getElementById('filter-cruise-sort');

            if (searchInput) searchInput.addEventListener('input', renderAdminCruisesGrid);
            if (destSelect) destSelect.addEventListener('change', renderAdminCruisesGrid);
            if (statusSelect) statusSelect.addEventListener('change', renderAdminCruisesGrid);
            if (sortSelect) sortSelect.addEventListener('change', renderAdminCruisesGrid);
            cruiseFiltersBound = true;
        }

        function renderAdminCruisesGrid() {
            const grid = document.getElementById('cruises-grid-container');
            if (!grid) return;

            const searchVal = (document.getElementById('filter-cruise-search')?.value || '').trim().toLowerCase();
            const destVal = document.getElementById('filter-cruise-dest')?.value || '';
            const statusVal = document.getElementById('filter-cruise-status')?.value || 'all';
            const sortVal = document.getElementById('filter-cruise-sort')?.value || 'rating';

            let filtered = allAdminCruises.filter(c => {
                // Search keyword
                if (searchVal) {
                    const matchName = (c.name || '').toLowerCase().includes(searchVal);
                    const matchDest = (c.destinationName || '').toLowerCase().includes(searchVal);
                    if (!matchName && !matchDest) return false;
                }
                // Destination
                if (destVal && c.destinationId && c.destinationId.toString() !== destVal) {
                    return false;
                }
                // Status
                if (statusVal === 'active' && !c.isActive) return false;
                if (statusVal === 'maintenance' && c.isActive) return false;

                return true;
            });

            // Sorting
            if (sortVal === 'newest') {
                filtered.sort((a, b) => b.cruiseId - a.cruiseId);
            } else if (sortVal === 'name') {
                filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            } else {
                // Default: rating
                filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
            }

            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #ffffff; border-radius: 12px; border: 1.5px dashed #cbd5e1;">
                        <img src="/images/icons/cruise-yacht.png" class="app-icon-xl" alt="" style="opacity: 0.4; margin-bottom: 12px;">
                        <h4 style="font-family: 'Playfair Display', serif; color: #334155; margin-bottom: 6px;">Không tìm thấy du thuyền phù hợp</h4>
                        <p style="color: #64748b; font-size: 13.5px; margin: 0;">Hãy thử điều chỉnh từ khóa tìm kiếm hoặc bỏ chọn bộ lọc trạng thái / khu vực.</p>
                    </div>`;
                return;
            }

            grid.innerHTML = '';
            filtered.forEach(c => {
                const div = document.createElement('div');
                div.className = 'cruise-card';
                div.style.position = 'relative';
                div.style.overflow = 'hidden';
                div.style.borderRadius = '14px';
                div.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                div.style.border = c.isActive ? '1px solid #e2e8f0' : '1.5px solid #fde68a';
                div.style.background = c.isActive ? '#ffffff' : '#fffbeb';

                const statusBadge = c.isActive
                    ? `<span style="position: absolute; top: 12px; right: 12px; background: rgba(220, 252, 231, 0.95); color: #15803d; border: 1px solid #86efac; padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 700; backdrop-filter: blur(4px); box-shadow: 0 2px 6px rgba(0,0,0,0.1); z-index: 2;">🟢 Đang hoạt động</span>`
                    : `<span style="position: absolute; top: 12px; right: 12px; background: rgba(254, 243, 199, 0.95); color: #b45309; border: 1px solid #fde68a; padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 700; backdrop-filter: blur(4px); box-shadow: 0 2px 6px rgba(0,0,0,0.1); z-index: 2;">🟡 Đang bảo trì</span>`;

                div.innerHTML = `
                    <div style="position: relative; height: 180px; overflow: hidden;">
                        <img src="${c.thumbnailUrl || '/images/default-cruise.jpg'}" alt="${c.name}" class="cruise-img" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/images/default-cruise.jpg'">
                        ${statusBadge}
                    </div>
                    <div class="cruise-card-body" style="padding: 18px; display: flex; flex-direction: column; flex: 1;">
                        <h3 class="cruise-title" style="margin: 0 0 8px; font-size: 17px; font-weight: 700; line-height: 1.35;">
                            <a href="/du-thuyen/${c.cruiseId}-${window.generateSlug(c.name)}" style="color: #0f172a; text-decoration: none;">${c.name}</a>
                        </h3>
                        <div class="cruise-meta mb-3" style="display: flex; gap: 12px; font-size: 13px; color: #64748b; margin-bottom: 14px;">
                            <span class="rating" style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: #b45309;">
                                <img src="/images/icons/rating-star.png" class="app-icon-sm" alt=""> ${c.averageRating || '5.0'} (${c.reviewCount || 0})
                            </span>
                            <span class="destination" style="display: inline-flex; align-items: center; gap: 4px;">
                                <img src="/images/icons/departure-calendar.png" class="app-icon-sm" alt=""> ${c.destinationName || 'Hạ Long'}
                            </span>
                        </div>
                        <div class="cruise-footer" style="display: flex; gap: 6px; margin-top: auto; padding-top: 12px; border-top: 1px solid #f1f5f9; flex-wrap: wrap;">
                            <a href="/admin/cruise-editor.html?id=${c.cruiseId}" style="flex: 1.2; text-align: center; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 600; cursor: pointer; background: #0d9488; color: white; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 5px;">
                                <img src="/images/icons/edit-pencil.png" class="app-icon-sm" alt="" style="filter: brightness(0) invert(1);"> Sửa
                            </a>
                            <button type="button" onclick="window.toggleCruiseMaintenance(${c.cruiseId})" style="flex: 1.4; text-align: center; border-radius: 8px; padding: 8px 10px; border: 1.5px solid ${c.isActive ? '#f59e0b' : '#10b981'}; color: ${c.isActive ? '#b45309' : '#047857'}; background: ${c.isActive ? '#fffbeb' : '#f0fdf4'}; font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;" title="${c.isActive ? 'Tạm dừng du thuyền để bảo trì' : 'Mở lại du thuyền cho khách đặt'}">
                                <img src="/images/icons/${c.isActive ? 'pending-hourglass' : 'check'}.png" class="app-icon-sm" alt=""> ${c.isActive ? 'Bảo trì' : 'Mở lại'}
                            </button>
                            <button type="button" onclick="window.deleteCruise(${c.cruiseId})" style="border-radius: 8px; padding: 8px 10px; border: 1.5px solid #fecaca; color: #dc2626; background: #fef2f2; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" title="Xóa">
                                <img src="/images/icons/close.png" class="app-icon-sm" alt="">
                            </button>
                        </div>
                    </div>
                `;
                grid.appendChild(div);
            });
        }

        // Global Toggle Maintenance for Cruise
        window.toggleCruiseMaintenance = async function(id) {
            const cruise = allAdminCruises.find(x => x.cruiseId === id);
            const actionText = cruise && cruise.isActive ? 'đưa vào bảo trì' : 'mở hoạt động lại';
            const cruiseName = cruise ? cruise.name : `ID #${id}`;

            Popup.confirm('Xác nhận bảo trì', `Bạn có muốn ${actionText} du thuyền "${cruiseName}"?`, async () => {
                try {
                    const res = await fetch(`/api/Cruises/${id}/toggle-maintenance`, {
                        method: 'PUT',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        Popup.show('Thành công', data.message || 'Đã cập nhật trạng thái du thuyền.', 'success');
                        await loadAdminCruises();
                    } else {
                        let msg = 'Lỗi cập nhật trạng thái.';
                        try { const e = await res.json(); msg = e.message || msg; } catch {}
                        Popup.show('Lỗi', msg, 'error');
                    }
                } catch {
                    Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
                }
            });
        };
        
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
            const cruise = allAdminCruises.find(x => x.cruiseId === id);
            const cruiseName = cruise ? cruise.name : `ID #${id}`;

            Popup.confirm('Xác nhận xóa', `Bạn có chắc chắn muốn xóa vĩnh viễn du thuyền "${cruiseName}" không? Hành động này sẽ loại bỏ du thuyền hoàn toàn khỏi hệ thống.`, async () => {
                try {
                    const res = await fetch(`/api/Cruises/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (res.ok) {
                        const data = await res.json().catch(() => ({}));
                        allAdminCruises = allAdminCruises.filter(x => x.cruiseId !== id);
                        renderAdminCruisesGrid();
                        Popup.show('Thành công', data.message || 'Đã xóa du thuyền thành công.', 'success');
                        await loadAdminCruises();
                    } else {
                        let errMsg = 'Xóa thất bại.';
                        try { const errJson = await res.json(); errMsg = errJson.message || errMsg; } catch {}
                        Popup.show('Lỗi', errMsg, 'error');
                    }
                } catch (err) {
                    Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
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
                            let roleOptions = `<option value="Customer" ${targetRoles.includes('Customer')?'selected':''}>Customer (Khách hàng)</option>
                                               <option value="Staff" ${targetRoles.includes('Staff')?'selected':''}>Staff (Nhân viên tư vấn)</option>
                                               <option value="Accountant" ${targetRoles.includes('Accountant')?'selected':''}>Accountant (Kế toán)</option>`;
                            if (isAdmin) {
                                roleOptions += `<option value="Manager" ${targetRoles.includes('Manager')?'selected':''}>Manager (Quản lý)</option>
                                                <option value="Admin" ${targetRoles.includes('Admin')?'selected':''}>Admin (Quản trị viên)</option>`;
                            }
                            actionsHtml += `<select onchange="assignRole('${id}', this.value)" style="padding:5px 8px; margin-right:8px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px; color:#1e293b; background:#ffffff;">
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

        // --- Load Staff Performance & Ratings ---
        let allStaffPerformanceData = [];
        let showAllStaff = false;
        let allAuditDisputesData = [];
        let showAllAudit = false;

        function renderStaffPerformanceTable() {
            const tbody = document.getElementById('staff-perf-body');
            const btnToggle = document.getElementById('btnToggleStaffLimit');
            if (!tbody) return;

            if (!allStaffPerformanceData || allStaffPerformanceData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">Chưa có chuyên viên nào trong danh sách.</td></tr>';
                if (btnToggle) btnToggle.style.display = 'none';
                return;
            }

            const displayData = showAllStaff ? allStaffPerformanceData : allStaffPerformanceData.slice(0, 5);

            tbody.innerHTML = displayData.map(s => {
                let roleBadge = '<span class="role-badge" style="background:#dcfce7; color:#15803d; border-color:#86efac; font-weight:700;"><img src="/images/icons/staff.png" class="app-icon-sm" alt=""> Nhân viên</span>';
                if (s.primaryRole === 'Admin') {
                    roleBadge = '<span class="role-badge" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5; font-weight:700;"><img src="/images/icons/admin-crown.png" class="app-icon-sm" alt=""> Admin</span>';
                } else if (s.primaryRole === 'Manager') {
                    roleBadge = '<span class="role-badge" style="background:#fef3c7; color:#b45309; border-color:#fde68a; font-weight:700;"><img src="/images/icons/special-offer.png" class="app-icon-sm" alt=""> Quản lý</span>';
                } else if (s.primaryRole === 'Accountant') {
                    roleBadge = '<span class="role-badge" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd; font-weight:700;"><img src="/images/icons/revenue-chart.png" class="app-icon-sm" alt=""> Kế toán</span>';
                }

                const resolvePercent = s.totalConsulted > 0 ? Math.round(s.totalResolved / s.totalConsulted * 100) : 100;
                const starsDisplay = s.totalRatings > 0 
                    ? `<strong style="color: #d97706; font-size: 14px;">${s.avgRating} ⭐</strong> <span style="font-size:11.5px; color:#64748b;">(${s.totalRatings} đánh giá)</span>`
                    : '<span style="color:#94a3b8; font-size:12px; font-style:italic;">Chưa có đánh giá</span>';

                return `
                <tr>
                    <td>
                        <strong style="color: #0f172a; font-size: 14px;">${s.fullName || s.userName}</strong>
                        <div style="font-size: 12px; color: #64748b;">${s.email}</div>
                    </td>
                    <td>${roleBadge}</td>
                    <td>
                        <strong>${s.totalConsulted}</strong> cuộc
                        <div style="font-size: 11.5px; color: #64748b;">${s.totalResolved} đã giải quyết</div>
                    </td>
                    <td>
                        <span style="font-weight: 700; color: ${resolvePercent >= 80 ? '#16a34a' : '#d97706'};">${resolvePercent}%</span>
                    </td>
                    <td>${starsDisplay}</td>
                    <td>
                        <strong style="color: ${s.satisfactionRate >= 80 ? '#16a34a' : (s.satisfactionRate >= 50 ? '#d97706' : '#dc2626')};">${s.satisfactionRate}%</strong>
                        ${s.disputeCount > 0 ? `<div style="font-size: 11px; color: #dc2626; font-weight: 600;">⚠️ ${s.disputeCount} khiếu nại</div>` : ''}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-outline" style="font-size: 12px; padding: 4px 9px; margin-right: 4px; color: #0d9488; border-color: #99f6e4;" onclick="window.showStaffDetailModal('${s.id}')" title="Xem chi tiết hồ sơ & KPIs nhân viên">
                            <img src="/images/icons/preview-eye.png" class="app-icon-sm" alt=""> Chi tiết
                        </button>
                        <button class="btn btn-outline" style="font-size: 12px; padding: 4px 9px;" onclick="window.searchDisputesForStaff('${s.fullName || s.userName}')" title="Tra cứu các cuộc tư vấn & khiếu nại">
                            <img src="/images/icons/review-chat.png" class="app-icon-sm" alt=""> Tra cứu
                        </button>
                    </td>
                </tr>
                `;
            }).join('');

            if (btnToggle) {
                if (allStaffPerformanceData.length > 5) {
                    btnToggle.style.display = 'inline-flex';
                    btnToggle.innerHTML = showAllStaff
                        ? '<img src="/images/icons/arrow-left.png" class="app-icon-sm" alt="" style="transform: rotate(90deg);"> Thu gọn về Top 5 gần nhất'
                        : `<img src="/images/icons/arrow-square-right.png" class="app-icon-sm" alt="" style="transform: rotate(90deg);"> Xem tất cả (${allStaffPerformanceData.length}) nhân viên tư vấn ▼`;
                } else {
                    btnToggle.style.display = 'none';
                }
            }
        }

        async function loadStaffPerformance() {
            const tbody = document.getElementById('staff-perf-body');
            if (!tbody) return;

            try {
                const res = await fetch('/api/users/StaffPerformance', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!res.ok) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">Chưa có dữ liệu hiệu suất hoặc không đủ quyền xem.</td></tr>';
                    return;
                }
                allStaffPerformanceData = await res.json() || [];
                if (allStaffPerformanceData.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">Chưa có chuyên viên nào trong danh sách.</td></tr>';
                    return;
                }

                // Update KPI Cards
                let totalStaff = allStaffPerformanceData.length;
                let totalConsultations = allStaffPerformanceData.reduce((sum, s) => sum + (s.totalConsulted || 0), 0);
                let totalRatings = allStaffPerformanceData.reduce((sum, s) => sum + (s.totalRatings || 0), 0);
                let weightedRatingSum = allStaffPerformanceData.reduce((sum, s) => sum + ((s.avgRating || 5) * (s.totalRatings || 1)), 0);
                let overallAvg = totalRatings > 0 ? (weightedRatingSum / (totalRatings || 1)).toFixed(1) : '5.0';
                let totalDisputes = allStaffPerformanceData.reduce((sum, s) => sum + (s.disputeCount || 0), 0);
                let avgSatRate = allStaffPerformanceData.length > 0 ? Math.round(allStaffPerformanceData.reduce((sum, s) => sum + (s.satisfactionRate || 100), 0) / allStaffPerformanceData.length) : 100;

                const elStaff = document.getElementById('kpi-total-staff');
                const elCons = document.getElementById('kpi-total-consultations');
                const elStars = document.getElementById('kpi-avg-stars');
                const elSat = document.getElementById('kpi-satisfaction-rate');
                const elDisp = document.getElementById('kpi-disputes-count');

                if (elStaff) elStaff.innerText = totalStaff;
                if (elCons) elCons.innerText = totalConsultations;
                if (elStars) elStars.innerText = overallAvg + ' ⭐';
                if (elSat) elSat.innerText = avgSatRate + '%';
                if (elDisp) elDisp.innerText = totalDisputes > 0 ? `${totalDisputes} khiếu nại cần lưu ý` : '0 khiếu nại (Rất tốt)';

                renderStaffPerformanceTable();

            } catch (err) {
                console.error("Lỗi lấy số liệu hiệu suất:", err);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Lỗi tải số liệu hiệu suất.</td></tr>';
            }
        }

        // Toggle Staff Limit
        const btnToggleStaffLimit = document.getElementById('btnToggleStaffLimit');
        if (btnToggleStaffLimit) {
            btnToggleStaffLimit.addEventListener('click', () => {
                showAllStaff = !showAllStaff;
                renderStaffPerformanceTable();
            });
        }

        // --- Load Audit Disputes & Live Chat Logs ---
        function renderAuditDisputesTable() {
            const tbody = document.getElementById('audit-disputes-body');
            const btnToggle = document.getElementById('btnToggleAuditLimit');
            if (!tbody) return;

            if (!allAuditDisputesData || allAuditDisputesData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">Không tìm thấy biên bản tư vấn nào phù hợp với bộ lọc.</td></tr>';
                if (btnToggle) btnToggle.style.display = 'none';
                return;
            }

            const displayLogs = showAllAudit ? allAuditDisputesData : allAuditDisputesData.slice(0, 5);

            tbody.innerHTML = displayLogs.map(c => {
                const stars = c.rating ? '⭐'.repeat(c.rating) : '<span style="color:#94a3b8; font-size:12px; font-style:italic;">Chưa đánh giá</span>';
                const feedback = c.ratingComment
                    ? `<div style="background:#fef3c7; border: 1px solid #fde68a; color:#92400e; padding:5px 8px; border-radius:6px; font-size:12px;"><strong>Khách viết:</strong> "${c.ratingComment}"</div>`
                    : (c.lastMessageSnippet ? `<span style="font-size:12px; color:#64748b;">${c.lastMessageSnippet}</span>` : '—');

                const statusBadge = c.status === 'Resolved'
                    ? '<span class="status-badge-chat badge-resolved" style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">Đã giải quyết</span>'
                    : '<span class="status-badge-chat badge-open" style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">Đang xử lý</span>';

                return `
                <tr>
                    <td style="font-weight: 700; color: #0d9488; font-family: monospace;">#CHAT-${c.conversationId}</td>
                    <td>
                        <strong>${c.customerName}</strong>
                        <div style="font-size: 11.5px; color: #64748b;">${c.customerEmail || '—'}</div>
                    </td>
                    <td>
                        <strong style="color: #0f766e;"><img src="/images/icons/staff.png" class="app-icon-sm" alt=""> ${c.assignedStaffName || 'Chưa nhận'}</strong>
                    </td>
                    <td><span style="font-size: 13px;">${stars}</span></td>
                    <td style="max-width: 260px;">${feedback}</td>
                    <td style="font-size: 12px; color: #475569;">${c.resolvedBy || '—'}</td>
                    <td style="font-size: 12px; color: #64748b; white-space: nowrap;">${c.resolvedAt || c.createdAt}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-outline" style="font-size: 12px; padding: 4px 9px; color: #0d9488; border-color: #99f6e4;" onclick="window.showAuditDetailModal(${c.conversationId})" title="Xem trọn vẹn chi tiết biên bản tư vấn & chat">
                            <img src="/images/icons/preview-eye.png" class="app-icon-sm" alt=""> Chi tiết
                        </button>
                    </td>
                </tr>
                `;
            }).join('');

            if (btnToggle) {
                if (allAuditDisputesData.length > 5) {
                    btnToggle.style.display = 'inline-flex';
                    btnToggle.innerHTML = showAllAudit
                        ? '<img src="/images/icons/arrow-left.png" class="app-icon-sm" alt="" style="transform: rotate(90deg);"> Thu gọn về 5 biên bản gần nhất'
                        : `<img src="/images/icons/arrow-square-right.png" class="app-icon-sm" alt="" style="transform: rotate(90deg);"> Xem tất cả (${allAuditDisputesData.length}) biên bản tư vấn ▼`;
                } else {
                    btnToggle.style.display = 'none';
                }
            }
        }

        async function loadAuditDisputes(staffName = '', maxRating = '', search = '') {
            const tbody = document.getElementById('audit-disputes-body');
            if (!tbody) return;

            try {
                let url = '/api/users/AuditDisputes?';
                const params = new URLSearchParams();
                if (staffName) params.append('staffName', staffName);
                if (maxRating) params.append('maxRating', maxRating);
                if (search) params.append('search', search);

                const res = await fetch(url + params.toString(), {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (!res.ok) {
                    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">Chưa có dữ liệu tra cứu khiếu nại.</td></tr>';
                    return;
                }
                allAuditDisputesData = await res.json() || [];
                renderAuditDisputesTable();

            } catch (err) {
                console.error("Lỗi tra cứu khiếu nại:", err);
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red;">Lỗi tải biên bản tư vấn.</td></tr>';
            }
        }

        // Toggle Audit Limit
        const btnToggleAuditLimit = document.getElementById('btnToggleAuditLimit');
        if (btnToggleAuditLimit) {
            btnToggleAuditLimit.addEventListener('click', () => {
                showAllAudit = !showAllAudit;
                renderAuditDisputesTable();
            });
        }

        // Modal xem chi tiết nhân viên
        window.showStaffDetailModal = function(staffId) {
            const s = allStaffPerformanceData.find(x => String(x.id) === String(staffId));
            if (!s) return;

            const resolvePercent = s.totalConsulted > 0 ? Math.round(s.totalResolved / s.totalConsulted * 100) : 100;
            const starsDisplay = s.totalRatings > 0 ? `${s.avgRating} / 5.0 ⭐ (${s.totalRatings} lượt đánh giá)` : 'Chưa có lượt đánh giá nào';

            let roleName = 'Nhân viên tư vấn';
            if (s.primaryRole === 'Admin') roleName = 'Quản trị viên tối cao (Admin)';
            else if (s.primaryRole === 'Manager') roleName = 'Quản lý điều hành (Manager)';
            else if (s.primaryRole === 'Accountant') roleName = 'Kế toán viên (Accountant)';

            const detailHtml = `
                <div style="font-family: 'Inter', sans-serif; text-align: left; line-height: 1.6;">
                    <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0;">
                        <div style="width: 52px; height: 52px; border-radius: 50%; background: #ccfbf1; color: #0f766e; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700;">
                            ${(s.fullName || s.userName || 'NV').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 700;">${s.fullName || s.userName}</h3>
                            <div style="font-size: 13px; color: #64748b;">${s.email} • <strong>${roleName}</strong></div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                            <div style="font-size: 12px; color: #64748b;">Tổng cuộc tư vấn</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0f766e;">${s.totalConsulted} cuộc</div>
                            <div style="font-size: 12px; color: #16a34a;">Đã giải quyết: ${s.totalResolved}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                            <div style="font-size: 12px; color: #64748b;">Tỷ lệ xử lý thành công</div>
                            <div style="font-size: 20px; font-weight: 700; color: ${resolvePercent >= 80 ? '#16a34a' : '#d97706'};">${resolvePercent}%</div>
                            <div style="font-size: 12px; color: #64748b;">Mục tiêu KPI: ≥ 85%</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                            <div style="font-size: 12px; color: #64748b;">Đánh giá trung bình</div>
                            <div style="font-size: 18px; font-weight: 700; color: #d97706;">${starsDisplay}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                            <div style="font-size: 12px; color: #64748b;">Tỷ lệ khách hài lòng</div>
                            <div style="font-size: 20px; font-weight: 700; color: ${s.satisfactionRate >= 80 ? '#16a34a' : '#dc2626'};">${s.satisfactionRate}%</div>
                            <div style="font-size: 12px; color: ${s.disputeCount > 0 ? '#dc2626' : '#16a34a'}; font-weight: 600;">${s.disputeCount > 0 ? `⚠️ ${s.disputeCount} khiếu nại (≤ 2 sao)` : '✓ Không có khiếu nại'}</div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
                        <button class="btn btn-primary" onclick="window.searchDisputesForStaff('${s.fullName || s.userName}'); Popup.close();">
                            <img src="/images/icons/review-chat.png" class="app-icon-sm" alt=""> Xem các biên bản tư vấn của nhân viên này
                        </button>
                    </div>
                </div>
            `;

            Popup.info('Hồ Sơ & Hiệu Suất Nhân Viên', detailHtml);
        };

        // Modal xem chi tiết biên bản tư vấn / khiếu nại
        window.showAuditDetailModal = function(conversationId) {
            const c = allAuditDisputesData.find(x => String(x.conversationId) === String(conversationId));
            if (!c) return;

            const stars = c.rating ? '⭐'.repeat(c.rating) + ` (${c.rating}/5 sao)` : 'Khách chưa gửi đánh giá';
            const statusText = c.status === 'Resolved' ? 'Đã giải quyết thành công' : 'Đang xử lý';

            const detailHtml = `
                <div style="font-family: 'Inter', sans-serif; text-align: left; line-height: 1.6;">
                    <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <strong style="color: #0d9488; font-size: 16px; font-family: monospace;">#CHAT-${c.conversationId}</strong>
                            <span style="background: ${c.status === 'Resolved' ? '#dcfce7' : '#fef3c7'}; color: ${c.status === 'Resolved' ? '#15803d' : '#b45309'}; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700;">${statusText}</span>
                        </div>
                        <div style="font-size: 13px; color: #475569;">
                            Khởi tạo: <strong>${c.createdAt}</strong> • Kết thúc/Cập nhật: <strong>${c.resolvedAt || 'Chưa đóng'}</strong>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                            <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 4px;">👤 THÔNG TIN KHÁCH HÀNG</div>
                            <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${c.customerName}</div>
                            <div style="font-size: 12.5px; color: #64748b;">${c.customerEmail || 'Khách vãng lai'}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                            <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 4px;">🎧 NHÂN VIÊN PHỤ TRÁCH</div>
                            <div style="font-size: 14px; font-weight: 700; color: #0f766e;">${c.assignedStaffName || 'Chưa nhận tư vấn'}</div>
                            <div style="font-size: 12.5px; color: #64748b;">Người chốt/đóng: ${c.resolvedBy || '—'}</div>
                        </div>
                    </div>

                    <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
                        <div style="font-size: 12px; color: #92400e; font-weight: 700; margin-bottom: 4px;">⭐ ĐÁNH GIÁ & Ý KIẾN CỦA KHÁCH HÀNG:</div>
                        <div style="font-size: 15px; font-weight: 700; color: #b45309; margin-bottom: 6px;">${stars}</div>
                        <div style="font-size: 13.5px; color: #78350f; font-style: italic;">
                            ${c.ratingComment ? `"${c.ratingComment}"` : '(Khách hàng không để lại nhận xét bằng chữ)'}
                        </div>
                    </div>

                    ${c.lastMessageSnippet ? `
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 16px;">
                            <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 4px;">💬 TIN NHẮN GẦN NHẤT TRONG CUỘC HỘI THOẠI:</div>
                            <div style="font-size: 13px; color: #334155; line-height: 1.5;">${c.lastMessageSnippet}</div>
                        </div>
                    ` : ''}

                    <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
                        <a href="/admin/chat.html?convId=${c.conversationId}" class="btn btn-primary" style="text-decoration: none;">
                            <img src="/images/icons/chat.png" class="app-icon-sm" alt="" style="filter: brightness(0) invert(1);"> Mở trang Live Chat để xem toàn bộ tin nhắn
                        </a>
                    </div>
                </div>
            `;

            Popup.info('Biên Bản Tư Vấn & Khiếu Nại', detailHtml);
        };

        window.searchDisputesForStaff = function(staffName) {
            const input = document.getElementById('auditSearchInput');
            if (input) {
                input.value = staffName;
                loadAuditDisputes(staffName, '', '');
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };

        // Event listeners for Staff Performance & Audit
        const btnRefreshStaff = document.getElementById('btnRefreshStaffPerf');
        if (btnRefreshStaff) {
            btnRefreshStaff.addEventListener('click', () => {
                loadStaffPerformance();
                loadAuditDisputes();
            });
        }

        const btnAuditSearch = document.getElementById('btnAuditSearch');
        if (btnAuditSearch) {
            btnAuditSearch.addEventListener('click', () => {
                const searchVal = document.getElementById('auditSearchInput')?.value.trim() || '';
                const ratingVal = document.getElementById('auditRatingFilter')?.value || '';
                loadAuditDisputes('', ratingVal, searchVal);
            });
        }

        const auditSearchInput = document.getElementById('auditSearchInput');
        if (auditSearchInput) {
            auditSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    btnAuditSearch?.click();
                }
            });
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
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<img src="/images/icons/pending-hourglass.png" class="app-icon" alt=""> Đang tạo...'; }
    const restore = () => { if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Tải hóa đơn'; } };

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
    '<button onclick="window.print()" style="padding:10px 28px;font-size:14px;cursor:pointer;background:#000;color:#fff;border:none;border-radius:4px;"><img src="/images/icons/print.png" class="app-icon" alt=""> In / Lưu PDF</button>' +
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

window.clearDateFilters = function() {
    const s = document.getElementById('adminBookingStartDate');
    const e = document.getElementById('adminBookingEndDate');
    if (s) s.value = '';
    if (e) e.value = '';
    if (window.filterAdminBookings) window.filterAdminBookings();
};

window.exportBookingsToExcel = function() {
    const list = window.lastFilteredBookings || (window.adminGroupedBookings ? Object.values(window.adminGroupedBookings) : []);
    if (!list || list.length === 0) {
        if (window.Popup) window.Popup.show('Thông báo', 'Không có dữ liệu đơn hàng để xuất.', 'info');
        else alert('Không có dữ liệu đơn hàng để xuất.');
        return;
    }

    const formatPrice = (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

    // CSV header with UTF-8 BOM để Excel hiển thị tiếng Việt chuẩn 100%
    let csv = '\uFEFF"Mã đơn hàng","Khách hàng","Số điện thoại","Email","Du thuyền","Ngày đi","Số phòng","Tổng tiền","Phương thức thanh toán","Trạng thái","Ngày đặt","Ghi chú"\n';

    list.forEach(b => {
        const firstItem = (b.items && b.items.length > 0) ? b.items[0] : b;
        const allPay = (b.items || []).reduce((acc, it) => acc.concat(it.payments || []), b.payments || []);
        const payMethod = allPay.length > 0 ? (allPay[0].paymentMethod || 'Chưa chọn') : 'Chưa chọn';
        
        let statusName = firstItem.status === 'Confirmed' ? 'Thành công' : (firstItem.status === 'Cancelled' ? 'Đã hủy' : (firstItem.status === 'AwaitingConfirmation' ? 'Chờ xác nhận' : 'Chờ thanh toán'));
        const dateStr = firstItem.createdAt ? new Date(firstItem.createdAt).toLocaleString('vi-VN') : '';
        const depStr = b.departureDate ? new Date(b.departureDate).toLocaleDateString('vi-VN') : '';
        const roomsCount = b.items ? b.items.reduce((sum, it) => sum + (it.numberOfRooms || 1), 0) : 1;

        const clean = (str) => '"' + (str ? String(str).replace(/"/g, '""').replace(/\n/g, ' ') : '') + '"';

        csv += [
            clean(b.bookingCode),
            clean(b.contactName),
            clean(b.contactPhone),
            clean(b.contactEmail),
            clean(b.cruiseName),
            clean(depStr),
            clean(roomsCount),
            clean(formatPrice(b.totalPrice)),
            clean(payMethod),
            clean(statusName),
            clean(dateStr),
            clean(b.note)
        ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    a.download = `BaoCao_DatPhong_DuThuyenViet_${dateStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.Popup) window.Popup.show('Thành công', 'Đã tải xuống file báo cáo Excel/CSV thành công!', 'success');
};

window.filterAdminBookings = function() {
    const searchEl = document.getElementById('adminBookingSearch');
    const statusEl = document.getElementById('adminBookingStatusFilter');
    const methodEl = document.getElementById('adminBookingMethodFilter');
    const startEl = document.getElementById('adminBookingStartDate');
    const endEl = document.getElementById('adminBookingEndDate');
    
    const searchTerm = (searchEl ? searchEl.value : '').toLowerCase();
    const statusFilter = statusEl ? statusEl.value : 'all';
    const methodFilter = methodEl ? methodEl.value : 'all';
    
    const tbody = document.getElementById('bookings-table-body');
    if (!tbody) return;

    if (!window.adminGroupedBookings) return;

    const filtered = Object.values(window.adminGroupedBookings).filter(b => {
        let firstItem = (b.items && b.items.length > 0) ? b.items[0] : b;
        let bStatus = firstItem.status;
        
        // Check Status
        if (statusFilter !== 'all' && bStatus !== statusFilter) return false;

        // Check Payment Method
        const allPay = (b.items || []).reduce((acc, it) => acc.concat(it.payments || []), b.payments || [])
            .filter(p => p.status !== 'Superseded');
        allPay.sort((p1, p2) => {
            if (p1.status === 'Success' && p2.status !== 'Success') return -1;
            if (p2.status === 'Success' && p1.status !== 'Success') return 1;
            return (p2.paymentId || 0) - (p1.paymentId || 0);
        });
        const rawMethod = allPay.length > 0 ? (allPay[0].paymentMethod || '') : '';
        if (methodFilter !== 'all') {
            if (methodFilter === 'Cash' && rawMethod !== 'Cash') return false;
            if (methodFilter === 'VNPAY' && rawMethod !== 'VNPAY') return false;
            if (methodFilter === 'PayPal' && rawMethod !== 'PayPal') return false;
            if (methodFilter === 'VietQR' && rawMethod !== 'VietQR' && rawMethod !== 'BankTransfer') return false;
        }

        // Check Date Range (Từ ngày - Đến ngày)
        if (startEl && startEl.value) {
            const startD = new Date(startEl.value);
            startD.setHours(0, 0, 0, 0);
            const itemD = firstItem.createdAt ? new Date(firstItem.createdAt) : null;
            if (itemD && itemD < startD) return false;
        }
        if (endEl && endEl.value) {
            const endD = new Date(endEl.value);
            endD.setHours(23, 59, 59, 999);
            const itemD = firstItem.createdAt ? new Date(firstItem.createdAt) : null;
            if (itemD && itemD > endD) return false;
        }
        
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

    window.lastFilteredBookings = filtered;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#6b7280; padding:20px;">Không tìm thấy đơn nào phù hợp.</td></tr>';
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
        
        // Badge Phương thức thanh toán
        const allPay = (b.items || []).reduce((acc, it) => acc.concat(it.payments || []), b.payments || [])
            .filter(p => p.status !== 'Superseded');
        allPay.sort((p1, p2) => {
            if (p1.status === 'Success' && p2.status !== 'Success') return -1;
            if (p2.status === 'Success' && p1.status !== 'Success') return 1;
            return (p2.paymentId || 0) - (p1.paymentId || 0);
        });
        let methodBadge = '<span style="color:#94a3b8; font-size:12px; font-style:italic;">Chưa chọn</span>';
        if (allPay.length > 0) {
            const rawMethod = allPay[0].paymentMethod || '';
            const pStatus = allPay[0].status || '';
            let extra = '';
            if (pStatus === 'Cancelled') extra = ' <span style="font-size:10px; color:#ef4444; font-weight:normal;">(Đã hủy)</span>';
            else if (pStatus === 'Failed') extra = ' <span style="font-size:10px; color:#ef4444; font-weight:normal;">(Lỗi)</span>';

            if (rawMethod === 'VNPAY') {
                methodBadge = `<span class="role-badge" style="background:#e0f2fe; color:#0369a1; font-weight:600; white-space:nowrap; display:inline-block;"><img src="/images/icons/vnpay.png" class="app-icon" alt=""> VNPAY${extra}</span>`;
            } else if (rawMethod === 'PayPal') {
                methodBadge = `<span class="role-badge" style="background:#eff6ff; color:#1d4ed8; font-weight:600; white-space:nowrap; display:inline-block;"><img src="/images/icons/paypal.png" class="app-icon" alt=""> PayPal${extra}</span>`;
            } else if (rawMethod === 'VietQR' || rawMethod === 'BankTransfer') {
                methodBadge = `<span class="role-badge" style="background:#ecfdf5; color:#047857; font-weight:600; white-space:nowrap; display:inline-block;"><img src="/images/icons/vietqr.png" class="app-icon" alt=""> VietQR${extra}</span>`;
            } else if (rawMethod === 'Cash') {
                methodBadge = `<span class="role-badge" style="background:#fef9c3; color:#a16207; font-weight:600; white-space:nowrap; display:inline-block;"><img src="/images/icons/cash-vnd.png" class="app-icon" alt=""> Tiền mặt${extra}</span>`;
            } else {
                methodBadge = `<span class="role-badge" style="background:#f1f5f9; color:#475569; font-weight:600; white-space:nowrap; display:inline-block;">${rawMethod}${extra}</span>`;
            }
        }

        // Badge Trạng thái
        let statusHtml = '';
        if (bStatus === 'Pending') statusHtml = '<span class="role-badge" style="background:#fef3c7; color:#d97706; white-space:nowrap; display:inline-block; padding: 4px 10px;">Chờ thanh toán</span>';
        else if (bStatus === 'AwaitingConfirmation') statusHtml = '<span class="role-badge" style="background:#e0e7ff; color:#4338ca; white-space:nowrap; display:inline-block; padding: 4px 10px;">Chờ xác nhận</span>';
        else if (bStatus === 'Confirmed') statusHtml = '<span class="role-badge" style="background:#dcfce3; color:#16a34a; white-space:nowrap; display:inline-block; padding: 4px 10px;">Thành công</span>';
        else if (bStatus === 'Cancelled') statusHtml = '<span class="role-badge" style="background:#fee2e2; color:#dc2626; white-space:nowrap; display:inline-block; padding: 4px 10px;">Đã hủy</span>';
        else statusHtml = `<span style="white-space:nowrap;">${bStatus}</span>`;

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

        actionsHtml += `<button class="btn-sm btn-outline" style="border-color:#0d9488; color:#0d9488;" onclick="downloadInvoiceDirectly('${b.bookingCode}', this)">Tải hóa đơn</button>`;
        
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
                    <button onclick="copyToClipboard('${b.bookingCode}')" style="background:none; border:none; cursor:pointer; padding:0 5px;" title="Sao chép"><img src="/images/icons/clipboard.png" class="app-icon" alt="📋"></button>
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
                                <span style="font-size: 14px;">${hasDeparted ? '<img src="/images/icons/note-edit.png" class="app-icon" alt="">' : '<img src="/images/icons/push-pin.png" class="app-icon" alt="">'}</span>
                                <span style="font-size: 11px; font-weight: 700; color: ${hasDeparted ? '#64748b' : '#e11d48'}; letter-spacing: 0.5px;">YÊU CẦU ĐẶC BIỆT</span>
                            </div>
                            <span style="font-size: 10px; color: ${hasDeparted ? '#94a3b8' : '#fda4af'}; font-weight: 600;">Chi tiết <img src="/images/icons/arrow-up-right.png" class="app-icon-sm" alt="↗"></span>
                        </div>
                        <div style="color: ${hasDeparted ? '#64748b' : '#881337'}; font-size: 13px; font-weight: 500; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap;">${b.note.replace(/</g, '&lt;')}</div>
                    </div>` : ''}
                </div>
            </td>
            <td>
                <div style="${opc}">
                    ${b.cruiseName} 
                    ${hasDeparted ? '<span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-left:4px;"><img src="/images/icons/cruise-yacht.png" class="app-icon-sm" alt=""> Đã khởi hành</span>' : ''}
                    <br>
                    <small class="text-muted">Ngày đi: ${b.departureDate ? new Date(b.departureDate).toLocaleDateString('vi-VN') : ''}</small>
                </div>
            </td>
            <td style="font-weight: 600; color: #ef4444;"><div style="${opc}">${formatPrice(b.totalPrice)}</div></td>
            <td style="white-space: nowrap;"><div style="${opc}">${methodBadge}</div></td>
            <td style="white-space: nowrap;"><div style="${opc}">${statusHtml}</div></td>
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
        window.Popup.info('<img src="/images/icons/push-pin.png" class="app-icon" alt=""> Yêu cầu đặc biệt: ' + bookingCode, html);
    }
};
