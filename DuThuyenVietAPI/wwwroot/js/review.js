/**
 * review.js — Module D: Review & Blog
 * Phụ trách: Thành viên D (feature/review-blog)
 * Chức năng: Hiển thị đánh giá phân trang + Form gửi đánh giá trên trang cruise-detail.html
 */

const REVIEW_API = '/api';

// =============================================
// Tải đánh giá từ API (phân trang)
// =============================================
window.loadCruiseReviews = async function(cruiseId, page = 1) {
    const listEl = document.getElementById('reviews-list');
    const paginationEl = document.getElementById('reviews-pagination');
    if (!listEl) return;

    listEl.innerHTML = '<p style="color:#888; text-align:center; padding:10px;">Đang tải đánh giá...</p>';

    try {
        const res = await fetch(`${REVIEW_API}/Reviews/Cruise/${cruiseId}?page=${page}&pageSize=5`);
        if (!res.ok) throw new Error('Lỗi tải reviews');
        const data = await res.json();

        if (data.total === 0) {
            listEl.innerHTML = '<p style="color:#888; text-align:center; padding:16px;">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        listEl.innerHTML = data.reviews.map(r => `
            <div style="padding:16px 0; border-bottom:1px solid #f1f5f9;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <span style="font-weight:700; color:#0f172a;">${r.userName}</span>
                        <span style="color:#fbbf24; margin-left:10px; font-size:1.1rem;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    <small style="color:#94a3b8;">${new Date(r.createdAt).toLocaleDateString('vi-VN')}</small>
                </div>
                <p style="color:#374151; line-height:1.6; margin:0;">${r.comment}</p>
            </div>
        `).join('');

        // Phân trang
        if (paginationEl && data.totalPages > 1) {
            let pHtml = '';
            for (let i = 1; i <= data.totalPages; i++) {
                const active = i === data.currentPage;
                pHtml += `<button onclick="window.loadCruiseReviews(${cruiseId}, ${i})" style="padding:6px 14px; border-radius:6px; border:1px solid ${active ? 'var(--primary)' : '#e2e8f0'}; background:${active ? 'var(--primary)' : 'white'}; color:${active ? 'white' : '#334155'}; cursor:pointer; font-weight:${active ? '700' : '400'};">${i}</button>`;
            }
            paginationEl.innerHTML = pHtml;
        } else if (paginationEl) {
            paginationEl.innerHTML = '';
        }
    } catch (e) {
        listEl.innerHTML = '<p style="color:#ef4444; text-align:center;">Không thể tải đánh giá.</p>';
        console.error('loadCruiseReviews error:', e);
    }
};

// =============================================
// Hiển thị form gửi đánh giá (nếu đủ điều kiện)
// =============================================
window.loadReviewForm = async function(cruiseId) {
    const formWrap = document.getElementById('review-form-wrap');
    if (!formWrap) return;

    const token = localStorage.getItem('auth_token');

    // Chưa đăng nhập → hiển thị gợi ý
    if (!token) {
        formWrap.innerHTML = `
            <div style="background:#f1f5f9; border-radius:12px; padding:16px 20px; border:1px dashed #cbd5e1; text-align:center;">
                <p style="color:#64748b; margin:0;">
                    <a href="/login.html" style="color:var(--primary); font-weight:600;">Đăng nhập</a> để viết đánh giá của bạn
                </p>
            </div>
        `;
        return;
    }

    // Kiểm tra quyền review từ API
    try {
        const res = await fetch(`${REVIEW_API}/Reviews/CanReview/${cruiseId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const canData = await res.json();

        if (!canData.canReview) {
            formWrap.innerHTML = `
                <div style="background:#f8fafc; border-radius:12px; padding:14px 20px; border:1px solid #e2e8f0; color:#64748b; text-align:center; font-size:0.95rem;">
                    ℹ️ ${canData.reason || 'Bạn không thể đánh giá lúc này.'}
                </div>
            `;
            return;
        }
    } catch(e) {
        console.error('CanReview check error:', e);
        return;
    }

    // Render form đánh giá với star-rating tương tác
    formWrap.innerHTML = `
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border:1px solid #bbf7d0; border-radius:14px; padding:20px 24px;">
            <h4 style="font-size:1.1rem; font-weight:700; margin-bottom:16px; color:#166534;">✍️ Viết đánh giá của bạn</h4>

            <div style="margin-bottom:14px;">
                <label style="font-weight:600; color:#374151; display:block; margin-bottom:8px;">Điểm đánh giá *</label>
                <div id="star-rating-wrap" style="display:flex; gap:6px; cursor:pointer;">
                    ${[1,2,3,4,5].map(i => `<span data-star="${i}" style="font-size:2rem; color:#d1d5db; transition:color 0.15s; user-select:none;" title="${i} sao">★</span>`).join('')}
                </div>
                <input type="hidden" id="review-rating" value="0">
                <div id="star-label" style="font-size:0.85rem; color:#64748b; margin-top:4px; height:18px;"></div>
            </div>

            <div style="margin-bottom:16px;">
                <label style="font-weight:600; color:#374151; display:block; margin-bottom:8px;">Nội dung đánh giá *</label>
                <textarea id="review-comment" rows="4"
                    placeholder="Chia sẻ trải nghiệm của bạn về du thuyền này..."
                    style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; font-family:inherit; font-size:0.95rem; resize:vertical; outline:none; transition:border 0.2s;"
                    onfocus="this.style.borderColor='var(--primary)'"
                    onblur="this.style.borderColor='#d1d5db'"
                ></textarea>
            </div>

            <button id="btn-submit-review" onclick="window.submitReview(${cruiseId})"
                class="btn-primary" style="padding:10px 28px; font-weight:600; border-radius:8px;">
                Gửi đánh giá 🚀
            </button>
        </div>
    `;

    // Tương tác star rating
    const stars = formWrap.querySelectorAll('[data-star]');
    const ratingInput = formWrap.querySelector('#review-rating');
    const starLabel = formWrap.querySelector('#star-label');
    const labels = ['', 'Rất tệ 😞', 'Tệ 😕', 'Bình thường 😐', 'Tốt 😊', 'Xuất sắc 🤩'];

    stars.forEach(star => {
        star.addEventListener('mouseenter', () => {
            const val = parseInt(star.getAttribute('data-star'));
            stars.forEach(s => { s.style.color = parseInt(s.getAttribute('data-star')) <= val ? '#f59e0b' : '#d1d5db'; });
            if (starLabel) starLabel.innerText = labels[val] || '';
        });
        star.addEventListener('click', () => {
            const val = parseInt(star.getAttribute('data-star'));
            ratingInput.value = val;
            stars.forEach(s => { s.style.color = parseInt(s.getAttribute('data-star')) <= val ? '#f59e0b' : '#d1d5db'; });
        });
    });

    formWrap.querySelector('#star-rating-wrap').addEventListener('mouseleave', () => {
        const current = parseInt(ratingInput.value);
        stars.forEach(s => { s.style.color = parseInt(s.getAttribute('data-star')) <= current ? '#f59e0b' : '#d1d5db'; });
        if (starLabel) starLabel.innerText = current > 0 ? labels[current] : '';
    });
};

// =============================================
// Gửi đánh giá lên API
// =============================================
window.submitReview = async function(cruiseId) {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const rating = parseInt(document.getElementById('review-rating').value);
    const comment = document.getElementById('review-comment').value.trim();

    if (rating < 1 || rating > 5) {
        if (window.Popup) window.Popup.show('Thông báo', 'Vui lòng chọn số sao đánh giá.', 'info');
        return;
    }
    if (!comment) {
        if (window.Popup) window.Popup.show('Thông báo', 'Vui lòng nhập nội dung đánh giá.', 'info');
        return;
    }

    const btn = document.getElementById('btn-submit-review');
    if (btn) { btn.disabled = true; btn.innerText = 'Đang gửi...'; }

    try {
        const res = await fetch(`${REVIEW_API}/Reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ cruiseId, rating, comment })
        });
        const data = await res.json();

        if (res.ok) {
            if (window.Popup) window.Popup.show('Thành công', 'Cảm ơn bạn đã đánh giá!', 'success');
            // Ẩn form, hiện thông báo thành công
            const formWrap = document.getElementById('review-form-wrap');
            if (formWrap) formWrap.innerHTML = `
                <div style="background:#dcfce7; border:1px solid #bbf7d0; border-radius:12px; padding:14px 20px; text-align:center; color:#166534; font-weight:600;">
                    ✅ Bạn đã gửi đánh giá thành công! Cảm ơn bạn.
                </div>
            `;
            // Tải lại danh sách reviews
            window.loadCruiseReviews(cruiseId, 1);
        } else {
            if (window.Popup) window.Popup.show('Lỗi', data.message || 'Không thể gửi đánh giá.', 'error');
            if (btn) { btn.disabled = false; btn.innerText = 'Gửi đánh giá 🚀'; }
        }
    } catch(e) {
        if (window.Popup) window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
        if (btn) { btn.disabled = false; btn.innerText = 'Gửi đánh giá 🚀'; }
        console.error('submitReview error:', e);
    }
};
