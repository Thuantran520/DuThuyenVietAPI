// @ts-nocheck
/* ==========================================================================
   DuThuyenViet - Global Header Navigation & Template Loader Script
   ========================================================================== */

// 0. Global Auth Status Helper
window.getAuthStatus = function() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token || token === 'null' || token === 'undefined') {
            return { isLoggedIn: false, isAdmin: false, user: null, token: null };
        }
        const parts = token.split('.');
        if (parts.length !== 3) {
            localStorage.removeItem('auth_token');
            return { isLoggedIn: false, isAdmin: false, user: null, token: null };
        }
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('auth_token');
            return { isLoggedIn: false, isAdmin: false, user: null, token: null };
        }
        const rawRole = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload['role'] || [];
        const roles = Array.isArray(rawRole) ? rawRole : [rawRole.toString()];
        const isAdmin = roles.some(r => ['admin', 'manager', 'accountant', 'staff'].includes(r.toLowerCase()));
        return {
            isLoggedIn: true,
            isAdmin: isAdmin,
            user: payload,
            token: token
        };
    } catch (e) {
        localStorage.removeItem('auth_token');
        return { isLoggedIn: false, isAdmin: false, user: null, token: null };
    }
};

// Immediate Route Guard for Admin & Protected paths
(function checkImmediateGuards() {
    const path = window.location.pathname.toLowerCase();
    const isAdminPath = path.includes('/admin/');
    const isHistoryPath = path.includes('history.html');
    const isCustomerProfile = (path.endsWith('/profile.html') || path.includes('/profile.html')) && !isAdminPath;

    const auth = window.getAuthStatus();

    if (isAdminPath) {
        if (!auth.isLoggedIn) {
            window.location.replace('/login.html');
            return;
        }
        if (!auth.isAdmin) {
            window.location.replace('/404.html');
            return;
        }
    }

    if ((isHistoryPath || isCustomerProfile) && !auth.isLoggedIn) {
        window.location.replace('/login.html');
        return;
    }
})();

// Function to render top navigation links based on auth state
function renderTopNav() {
    const nav = document.getElementById('topNav');
    if (!nav) return;

    const auth = window.getAuthStatus();

    if (!auth.isLoggedIn) {
        // Visitor / Guest navigation: strictly no Admin or Logout links
        nav.innerHTML = `
            <a href="/search.html">Tìm Du Thuyền</a>
            <a href="/login.html" style="font-weight: 600;">Đăng nhập</a>
            <a href="/register.html" class="nav-btn-account">Đăng ký</a>
        `;
        return;
    }

    // Logged in user navigation
    const profileUrl = auth.isAdmin ? '/admin/profile.html' : '/profile.html';
    const adminLink = auth.isAdmin ? `<a href="/admin/profile.html" class="nav-btn-admin"><img src="/images/icons/admin-crown.png" class="app-icon-sm" alt=""> Quản trị</a>` : '';

    nav.innerHTML = `
        <a href="/search.html">Tìm Du Thuyền</a>
        ${adminLink}
        <a href="/history.html">Lịch sử</a>
        <a href="${profileUrl}" class="nav-btn-account"><img src="/images/icons/user.png" class="app-icon-sm" alt=""> Tài khoản</a>
        <a href="#" id="btnLogoutBtn" class="nav-btn-logout">Đăng xuất</a>
    `;

    const btnLogout = document.getElementById('btnLogoutBtn');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('auth_token');
            sessionStorage.clear();
            window.location.href = '/index.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Top Nav attempt if DOM already contains #topNav
    renderTopNav();

    // 2. Load Header Template
    const headerContainer = document.querySelector('header.main-header');
    if (headerContainer) {
        try {
            const res = await fetch('/header.html');
            if (res.ok) {
                headerContainer.innerHTML = await res.text();
                // Render Top Nav after header template is injected
                renderTopNav();
            }
        } catch (e) {
            console.error('Error loading header template:', e);
        } finally {
            // Always make header visible (fade in)
            headerContainer.style.opacity = '1';
        }
    }

    // 3. Load Footer Template
    const footerContainer = document.querySelector('footer.main-footer');
    if (footerContainer) {
        try {
            const res = await fetch('/footer.html');
            if (res.ok) {
                footerContainer.innerHTML = await res.text();
                // Toggle auth-dependent items in footer
                const auth = window.getAuthStatus();
                const footerHistory = document.getElementById('footerHistoryItem');
                if (footerHistory) {
                    footerHistory.style.display = auth.isLoggedIn ? 'block' : 'none';
                }
            }
        } catch (e) {
            console.error('Error loading footer template:', e);
        }
    }

    // 3.5 Clean any rogue breadcrumb separator elements or empty items
    document.querySelectorAll('.breadcrumbs li').forEach(li => {
        const cleanText = li.textContent.replace(/[\/\s\\]/g, '');
        if (!cleanText && !li.querySelector('img, svg, a')) {
            li.remove();
        }
    });

    // 4. Dynamic Back Button Injection
    const container = document.querySelector('.breadcrumbs-container .container');
    if (container) {
        container.style.display = 'flex';
        container.style.justifyContent = 'space-between';
        container.style.alignItems = 'center';
        
        const backBtn = document.createElement('button');
        backBtn.className = 'btn-back';
        backBtn.innerHTML = '<img src="/images/icons/arrow-left.png" class="app-icon-sm" alt="←"> Quay lại';
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

    // Dynamic injection of Live Chat & Popup Ads on customer pages
    if (!window.location.pathname.toLowerCase().includes('/admin/')) {
        if (!document.querySelector('script[src*="live-chat.js"]')) {
            const chatScript = document.createElement('script');
            chatScript.src = '/js/live-chat.js?v=1';
            document.body.appendChild(chatScript);
        }
        if (!document.querySelector('script[src*="popup-ad.js"]')) {
            const adScript = document.createElement('script');
            adScript.src = '/js/popup-ad.js?v=1';
            document.body.appendChild(adScript);
        }
    }
});

// Global Helper to Generate SEO Slugs
window.generateSlug = function(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .normalize('NFD') 
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '') // Keep letters, numbers, spaces, hyphens
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Remove duplicate hyphens
};
