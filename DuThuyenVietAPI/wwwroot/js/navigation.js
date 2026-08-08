/* ==========================================================================
   DuThuyenViet - Global Header Navigation & Template Loader Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Header Template
    const headerContainer = document.querySelector('header.main-header');
    if (headerContainer) {
        try {
            const res = await fetch('/header.html');
            if (res.ok) {
                headerContainer.innerHTML = await res.text();
            }
        } catch (e) {
            console.error('Error loading header template:', e);
        } finally {
            // Always make header visible (fade in)
            headerContainer.style.opacity = '1';
        }
    }

    // 2. Load Footer Template
    const footerContainer = document.querySelector('footer.main-footer');
    if (footerContainer) {
        try {
            const res = await fetch('/footer.html');
            if (res.ok) {
                footerContainer.innerHTML = await res.text();
            }
        } catch (e) {
            console.error('Error loading footer template:', e);
        }
    }

    // 3. Initialize Top Nav links
    const token = localStorage.getItem('auth_token');
    const nav = document.getElementById('topNav');
    if (nav) {
        if (token) {
            let isAdmin = false;
            try {
                const jwtData = JSON.parse(atob(token.split('.')[1]));
                const role = jwtData['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || '';
                if (role.includes('Admin') || role.includes('Manager') || role.includes('Staff')) {
                    isAdmin = true;
                }
            } catch (e) {}

            const profileUrl = isAdmin ? '/admin/profile.html' : '/profile.html';
            let adminLink = '';
            if (isAdmin) {
                adminLink = `<a href="/admin/profile.html" class="nav-btn-admin">Quản trị</a>`;
            }

            nav.innerHTML = `
                <a href="/search.html">Tìm Du Thuyền</a>
                ${adminLink}
                <a href="/history.html">Lịch sử</a>
                <a href="${profileUrl}" class="nav-btn-account">Tài khoản</a>
                <a href="#" id="btnLogoutBtn" class="nav-btn-logout">Đăng xuất</a>
            `;
            
            const btnLogout = document.getElementById('btnLogoutBtn');
            if (btnLogout) {
                btnLogout.addEventListener('click', (e) => {
                    e.preventDefault();
                    localStorage.removeItem('auth_token');
                    window.location.reload();
                });
            }
        } else {
            nav.innerHTML = `
                <a href="/search.html">Tìm Du Thuyền</a>
                <a href="/login.html" style="font-weight: 600;">Đăng nhập</a>
                <a href="/register.html" class="nav-btn-account">Đăng ký</a>
            `;
        }
    }

    // 4. Dynamic Back Button Injection
    const container = document.querySelector('.breadcrumbs-container .container');
    if (container) {
        container.style.display = 'flex';
        container.style.justifyContent = 'space-between';
        container.style.alignItems = 'center';
        
        const backBtn = document.createElement('button');
        backBtn.className = 'btn-back';
        backBtn.innerHTML = '← Quay lại';
        backBtn.style.background = 'transparent';
        backBtn.style.border = '1px solid var(--border)';
        backBtn.style.padding = '6px 14px';
        backBtn.style.borderRadius = '8px';
        backBtn.style.cursor = 'pointer';
        backBtn.style.fontSize = '0.9rem';
        backBtn.style.fontWeight = '600';
        backBtn.style.color = 'var(--text-dark)';
        backBtn.style.display = 'flex';
        backBtn.style.alignItems = 'center';
        backBtn.style.gap = '6px';
        backBtn.style.transition = 'all 0.2s';
        
        backBtn.addEventListener('mouseenter', () => {
            backBtn.style.background = 'var(--bg-light)';
            backBtn.style.borderColor = 'var(--primary)';
            backBtn.style.color = 'var(--primary)';
        });
        backBtn.addEventListener('mouseleave', () => {
            backBtn.style.background = 'transparent';
            backBtn.style.borderColor = 'var(--border)';
            backBtn.style.color = 'var(--text-dark)';
        });
        
        backBtn.addEventListener('click', () => {
            if (document.referrer && document.referrer.includes(window.location.host)) {
                window.history.back();
            } else {
                window.location.href = '/index.html';
            }
        });
        
        container.appendChild(backBtn);
    }

    // 5. Path history tracker for breadcrumbs
    const referrer = document.referrer || '';
    if (referrer.includes('search.html')) {
        sessionStorage.setItem('came_from_search', 'true');
    } else if (referrer.includes('index.html') || referrer === '') {
        sessionStorage.setItem('came_from_search', 'false');
    }
    
    // Hide Search item in breadcrumbs if not coming from search journey
    const searchItem = document.getElementById('breadcrumb-search-item');
    if (searchItem && sessionStorage.getItem('came_from_search') !== 'true') {
        searchItem.remove();
    }
});
