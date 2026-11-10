// @ts-nocheck
/* ==========================================================================
   DuThuyenViet - Search Page Initialization Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadDestinations === 'function') {
        loadDestinations('filterDestination');
    }
    if (typeof initSearchPage === 'function') {
        initSearchPage();
    }
});
