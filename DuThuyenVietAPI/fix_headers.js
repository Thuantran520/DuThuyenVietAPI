const fs = require('fs');
const path = require('path');

const files = ['index.html', 'search.html', 'cruise-detail.html', 'booking.html', 'checkout.html', 'history.html'];

const navRegex = /<nav[^>]*>[\s\S]*?<\/nav>/;
const newNav = `<nav id="topNav">\n                <a href="/search.html">Tìm Du Thuyền</a>\n            </nav>`;

const headerScript = `
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const token = localStorage.getItem('auth_token');
            const nav = document.getElementById('topNav');
            if (nav) {
                if (token) {
                    nav.innerHTML += \`
                        <a href="/history.html">Lịch sử</a>
                        <a href="/profile.html" style="background: var(--primary); color: white; padding: 5px 15px; border-radius: 20px; font-weight: 600;">👤 Tài khoản</a>
                        <a href="#" id="btnLogoutBtn" style="color: #ef4444;">Đăng xuất</a>
                    \`;
                    document.getElementById('btnLogoutBtn').addEventListener('click', (e) => {
                        e.preventDefault();
                        localStorage.removeItem('auth_token');
                        window.location.reload();
                    });
                } else {
                    nav.innerHTML += \`
                        <a href="/login.html" style="font-weight: 600;">Đăng nhập</a>
                        <a href="/register.html" style="background: var(--primary); color: white; padding: 5px 15px; border-radius: 20px; font-weight: 600;">Đăng ký</a>
                    \`;
                }
            }
        });
    </script>
`;

for (const file of files) {
    const filePath = path.join(__dirname, 'wwwroot', file);
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace nav
    content = content.replace(navRegex, newNav);
    
    // Remove old inline header logic if any in booking/checkout/history
    content = content.replace(/const token = getToken\(\);[\s\S]*?<\/nav>[\s\S]*?innerHTML \+= `[\s\S]*?`;[\s\S]*?}/, ''); // naive cleanup, better to just remove the specific chunks
    
    // Actually, for booking, checkout, history, it's inside DOMContentLoaded. Let's just do a string replacement for the exact old logic.
    const oldLogic1 = `            // Header logic
            const token = getToken();
            const nav = document.getElementById('topNav');
            if (token) {
                nav.innerHTML += \`
                    <a href="/history.html">Lịch sử đặt vé</a>
                    <a href="/profile.html">Cá nhân</a>
                    <a href="#" id="btnLogoutBtn">Đăng xuất</a>
                \`;
                document.getElementById('btnLogoutBtn').addEventListener('click', (e) => {
                    e.preventDefault();
                    localStorage.removeItem('auth_token');
                    window.location.href = '/login.html';
                });
            } else {
                nav.innerHTML += \`
                    <a href="/login.html">Đăng nhập</a>
                    <a href="/register.html">Đăng ký</a>
                \`;
            }`;
            
    content = content.replace(oldLogic1, '');

    // Add new script before </body>
    if (!content.includes('👤 Tài khoản')) {
        content = content.replace('</body>', headerScript + '\n</body>');
    }
    
    fs.writeFileSync(filePath, content);
}
console.log("Headers updated.");
