/* ==========================================================================
   DuThuyenViet - Cruise Detail Page Logic & Breadcrumb Sync
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadCruiseDetail === 'function') {
        loadCruiseDetail();
    }
    
    // Set dynamic breadcrumb name when data loads
    const checkNameInterval = setInterval(() => {
        const cruiseTitleEl = document.querySelector('.cruise-detail-title h1, h1');
        if (cruiseTitleEl && cruiseTitleEl.innerText && cruiseTitleEl.innerText !== 'Chi Tiết Du Thuyền' && !cruiseTitleEl.innerText.includes('Đang tải')) {
            const breadcrumbName = document.getElementById('breadcrumb-cruise-name');
            if (breadcrumbName) {
                breadcrumbName.innerText = cruiseTitleEl.innerText;
            }
            clearInterval(checkNameInterval);
        }
    }, 500);
    setTimeout(() => clearInterval(checkNameInterval), 10000);
});
