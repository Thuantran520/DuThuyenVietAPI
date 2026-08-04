document.addEventListener('DOMContentLoaded', async function () {

    // ==========================================
    // 1. TRANG ĐĂNG KÝ
    // ==========================================
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            const btn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const spinner = document.getElementById('spinner');
            const alertBox = document.getElementById('alert-box');

            btn.disabled = true; btnText.style.display = 'none'; spinner.style.display = 'block'; alertBox.style.display = 'none';

            try {
                const response = await fetch('/api/account/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });

                const textData = await response.text();
                let data = {};
                try { data = JSON.parse(textData); } catch (e) { data = { message: textData }; }

                alertBox.style.display = 'block';
                if (response.ok) {
                    alertBox.className = 'alert-success';
                    alertBox.innerHTML = 'Đăng ký thành công! Hãy đăng nhập.';
                    registerForm.reset();
                } else {
                    alertBox.className = 'alert-error';
                    let errorMsg = data.message || data.title || 'Vui lòng kiểm tra lại thông tin.';
                    if (data.errors) {
                        const firstError = Object.values(data.errors)[0];
                        if (Array.isArray(firstError)) errorMsg = firstError[0];
                    }
                    alertBox.innerHTML = errorMsg;
                }
            } catch (error) {
                alertBox.style.display = 'block'; alertBox.className = 'alert-error'; alertBox.innerHTML = 'Lỗi kết nối máy chủ.';
            } finally {
                btn.disabled = false; btnText.style.display = 'block'; spinner.style.display = 'none';
            }
        });
    }

    // ==========================================
    // 2. TRANG ĐĂNG NHẬP
    // ==========================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            const btn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const spinner = document.getElementById('spinner');
            const alertBox = document.getElementById('alert-box');

            btn.disabled = true; btnText.style.display = 'none'; spinner.style.display = 'block'; alertBox.style.display = 'none';

            try {
                const response = await fetch('/api/account/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                alertBox.style.display = 'block';
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('auth_token', data.token);
                    alertBox.className = 'alert-success';
                    alertBox.innerHTML = 'Đăng nhập thành công! Đang chuyển hướng...';
                    setTimeout(() => { window.location.href = 'profile.html'; }, 1000);
                } else if (response.status === 401) {
                    alertBox.className = 'alert-error'; alertBox.innerHTML = 'Email hoặc mật khẩu không đúng.';
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
    // 3. TRANG PROFILE & CRUD
    // ==========================================
    const profileContent = document.getElementById('profile-content');
    if (profileContent) {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            alert('Vui lòng đăng nhập để xem trang này!');
            window.location.href = 'login.html';
            return;
        }

        // --- Fetch Profile Data ---
        async function loadProfile() {
            try {
                const response = await fetch('/api/account/profile', {
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    document.getElementById('val-fullname-title').innerText = data.fullName || data.userName;
                    document.getElementById('val-email-subtitle').innerText = data.email;
                    
                    document.getElementById('val-fullname').innerText = data.fullName || 'Chưa cập nhật';
                    document.getElementById('val-phone').innerText = data.phoneNumber || 'Chưa cập nhật';
                    document.getElementById('input-fullname').value = data.fullName || '';
                    document.getElementById('input-phone').value = data.phoneNumber || '';

                    // Avatar logic
                    const letter = document.getElementById('avatarLetter');
                    const img = document.getElementById('avatarImage');
                    if (data.avatarUrl) {
                        img.src = data.avatarUrl;
                        img.style.display = 'block';
                        letter.style.display = 'none';
                    } else {
                        img.style.display = 'none';
                        letter.style.display = 'block';
                        letter.innerText = data.email.charAt(0).toUpperCase();
                    }

                    // Roles
                    const rolesContainer = document.getElementById('val-roles');
                    rolesContainer.innerHTML = '';
                    if (data.roles && data.roles.length > 0) {
                        data.roles.forEach(role => {
                            rolesContainer.innerHTML += `<span class="role-badge">${role}</span>`;
                        });
                    } else {
                        rolesContainer.innerHTML = `<span style="color: #9ca3af">Chưa có quyền</span>`;
                    }

                    document.getElementById('loader').style.display = 'none';
                    profileContent.style.display = 'block';
                } else {
                    localStorage.removeItem('auth_token');
                    window.location.href = 'login.html';
                }
            } catch (error) {
                console.error(error);
                alert('Lỗi lấy thông tin.');
            }
        }
        
        loadProfile();

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
            viewActions.style.display = 'none'; editActions.style.display = 'block';
        });

        btnCancel.addEventListener('click', () => {
            valFullname.style.display = 'block'; formFullname.style.display = 'none';
            valPhone.style.display = 'block'; formPhone.style.display = 'none';
            viewActions.style.display = 'block'; editActions.style.display = 'none';
        });

        // --- Save Profile ---
        const btnSave = document.getElementById('btnSaveProfile');
        btnSave.addEventListener('click', async () => {
            const fullName = document.getElementById('input-fullname').value;
            const phoneNumber = document.getElementById('input-phone').value;
            
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
                    await loadProfile(); // Reload data
                    btnCancel.click(); // Exit edit mode
                } else {
                    alert('Lưu thất bại.');
                }
            } catch (error) {
                alert('Lỗi kết nối.');
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
                    avatarStatus.innerText = "Thay đổi ảnh thành công!";
                    avatarStatus.style.color = "#15803d";
                    await loadProfile();
                } else {
                    const errText = await response.text();
                    avatarStatus.innerText = "Lỗi: " + errText;
                    avatarStatus.style.color = "#b91c1c";
                }
            } catch (error) {
                avatarStatus.innerText = "Lỗi kết nối.";
            }
        });
    }

    // ==========================================
    // 4. LOGOUT
    // ==========================================
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', function () {
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
        });
    }

});
