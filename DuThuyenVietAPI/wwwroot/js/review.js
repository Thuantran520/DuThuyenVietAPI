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

        const jwtData = (() => {
            const token = localStorage.getItem('auth_token');
            if (!token) return null;
            try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
        })();
        const currentUserId = jwtData ? jwtData['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] : null;
        const currentRole = jwtData ? (jwtData['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || '') : '';
        const isStaff = currentRole.includes('Admin') || currentRole.includes('Manager') || currentRole.includes('Staff');
        const isAdminOrManager = currentRole.includes('Admin') || currentRole.includes('Manager');

        listEl.innerHTML = data.reviews.map(r => {
            // --- Staff Reply Section ---
            let staffReplyHtml = '';
            if (r.staffReply) {
                let replyActions = '';
                // Nút Sửa: nhân viên sửa reply của chính mình HOẶC admin/manager sửa bất kỳ
                const canEditReply = isStaff && (isAdminOrManager || r.staffReplyUserId === currentUserId);
                // Nút Xóa: chỉ admin/manager
                const canDeleteReply = isAdminOrManager;

                if (canEditReply) {
                    replyActions += `<button onclick="window.editStaffReply(${r.reviewId}, ${cruiseId}, '${(r.staffReply || '').replace(/'/g, "\\'").replace(/\n/g, '\\n')}')"
                        style="background:none; border:none; color:#16a34a; cursor:pointer; font-size:0.8rem; font-weight:600; padding:0 6px; opacity:0.8;"
                        title="Sửa phản hồi">✏️ Sửa</button>`;
                }
                if (canDeleteReply) {
                    replyActions += `<button onclick="window.deleteStaffReply(${r.reviewId}, ${cruiseId})"
                        style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.8rem; font-weight:600; padding:0 6px; opacity:0.8;"
                        title="Xóa phản hồi">🗑️ Xóa</button>`;
                }

                staffReplyHtml = `
                    <div style="margin-top:12px; background:#f0fdf4; border-left:4px solid #22c55e; padding:10px 14px; border-radius:0 8px 8px 0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <strong style="color:#166534; font-size:0.9rem;">💬 Phản hồi từ Đội ngũ:</strong>
                            <span style="display:flex; gap:2px;">${replyActions}</span>
                        </div>
                        <p style="margin:0; color:#15803d; font-size:0.95rem; line-height:1.5;" id="reply-text-${r.reviewId}">${r.staffReply}</p>
                    </div>
                `;
            }

            // --- Review Owner Actions ---
            const currentName = jwtData ? (jwtData['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || '') : '';
            const isOwner = currentName === r.userName || (jwtData && r.userName.includes(currentName));
            
            let actionsHtml = '';
            if (isOwner) {
                actionsHtml += `<button onclick="window.editReview(${r.reviewId}, ${r.rating}, '${r.comment.replace(/'/g, "\\'")}', ${cruiseId})" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:0.85rem; font-weight:600;">Sửa đánh giá</button>`;
            }

            // Nút "Trả lời": chỉ hiện khi chưa có reply (thêm mới), hoặc ẩn để dùng nút Sửa trong reply block
            if (isStaff && !r.staffReply) {
                actionsHtml += `<button onclick="window.replyReview(${r.reviewId}, ${cruiseId})" style="background:none; border:none; color:#10b981; cursor:pointer; font-size:0.85rem; font-weight:600; margin-left:12px;">💬 Trả lời</button>`;
            }

            return `
            <div style="padding:16px 0; border-bottom:1px solid #f1f5f9;" id="review-${r.reviewId}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <span style="font-weight:700; color:#0f172a;">${r.userName}</span>
                        <span style="color:#fbbf24; margin-left:10px; font-size:1.1rem;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    <div style="text-align:right;">
                        <small style="color:#94a3b8; display:block;">${new Date(r.createdAt).toLocaleDateString('vi-VN')}</small>
                        <div style="margin-top:4px;">${actionsHtml}</div>
                    </div>
                </div>
                <p style="color:#374151; line-height:1.6; margin:0;" id="review-comment-${r.reviewId}">${r.comment}</p>
                ${staffReplyHtml}
            </div>
            `;
        }).join('');

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
                Gửi đánh giá
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
            const formWrap = document.getElementById('review-form-wrap');
            if (formWrap) formWrap.innerHTML = `
                <div style="background:#dcfce7; border:1px solid #bbf7d0; border-radius:12px; padding:14px 20px; text-align:center; color:#166534; font-weight:600;">
                    ✅ Bạn đã gửi đánh giá thành công! Cảm ơn bạn.
                </div>
            `;
            window.loadCruiseReviews(cruiseId, 1);
        } else {
            if (window.Popup) window.Popup.show('Lỗi', data.message || 'Không thể gửi đánh giá.', 'error');
            if (btn) { btn.disabled = false; btn.innerText = 'Gửi đánh giá'; }
        }
    } catch(e) {
        if (window.Popup) window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
        if (btn) { btn.disabled = false; btn.innerText = 'Gửi đánh giá'; }
        console.error('submitReview error:', e);
    }
};

// =============================================
// Sửa đánh giá (chính chủ) — dùng Popup
// =============================================
window.editReview = function(reviewId, oldRating, oldComment, cruiseId) {
    if (!window.Popup) return;
    window.Popup.prompt(
        'Sửa đánh giá',
        `Điểm (1-5) hiện tại: ${oldRating} | Nhập nội dung đánh giá mới:`,
        oldComment,
        async (newComment) => {
            if (!newComment || !newComment.trim()) return;
            const token = localStorage.getItem('auth_token');
            try {
                const res = await fetch(`${REVIEW_API}/Reviews/${reviewId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rating: oldRating, comment: newComment.trim(), cruiseId })
                });
                const data = await res.json();
                if (res.ok) {
                    window.Popup.show('Thành công', 'Đã cập nhật đánh giá.', 'success');
                    window.loadCruiseReviews(cruiseId, 1);
                } else {
                    window.Popup.show('Lỗi', data.message || 'Không thể sửa đánh giá.', 'error');
                }
            } catch(e) {
                window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            }
        }
    );
};

// =============================================
// Trả lời đánh giá (Staff) — dùng Popup
// =============================================
window.replyReview = function(reviewId, cruiseId) {
    if (!window.Popup) return;
    window.Popup.prompt(
        '💬 Phản hồi đánh giá',
        'Nhập nội dung phản hồi của nhân viên:',
        '',
        async (replyText) => {
            if (!replyText || !replyText.trim()) return;
            const token = localStorage.getItem('auth_token');
            try {
                const res = await fetch(`${REVIEW_API}/Reviews/${reviewId}/reply`, {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ replyText: replyText.trim() })
                });
                const data = await res.json();
                if (res.ok) {
                    window.Popup.show('Thành công', 'Đã phản hồi đánh giá.', 'success');
                    window.loadCruiseReviews(cruiseId, 1);
                } else {
                    window.Popup.show('Lỗi', data.message || 'Không thể phản hồi.', 'error');
                }
            } catch(e) {
                window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            }
        }
    );
};

// =============================================
// Sửa phản hồi nhân viên (Staff chỉ sửa của mình, Admin/Manager sửa mọi reply)
// =============================================
window.editStaffReply = function(reviewId, cruiseId, currentReply) {
    if (!window.Popup) return;
    window.Popup.prompt(
        '✏️ Sửa phản hồi nhân viên',
        'Chỉnh sửa nội dung phản hồi:',
        currentReply,
        async (newReply) => {
            if (!newReply || !newReply.trim()) return;
            const token = localStorage.getItem('auth_token');
            try {
                const res = await fetch(`${REVIEW_API}/Reviews/${reviewId}/reply`, {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ replyText: newReply.trim() })
                });
                const data = await res.json();
                if (res.ok) {
                    window.Popup.show('Thành công', 'Đã cập nhật phản hồi.', 'success');
                    window.loadCruiseReviews(cruiseId, 1);
                } else {
                    window.Popup.show('Lỗi', data.message || 'Không thể sửa phản hồi.', 'error');
                }
            } catch(e) {
                window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            }
        }
    );
};

// =============================================
// Xóa phản hồi nhân viên (chỉ Admin/Manager)
// =============================================
window.deleteStaffReply = function(reviewId, cruiseId) {
    if (!window.Popup) return;
    window.Popup.confirm(
        '🗑️ Xóa phản hồi nhân viên',
        'Bạn có chắc chắn muốn xóa phản hồi của nhân viên không? Hành động này không thể hoàn tác.',
        async () => {
            const token = localStorage.getItem('auth_token');
            try {
                const res = await fetch(`${REVIEW_API}/Reviews/${reviewId}/reply`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (res.ok) {
                    window.Popup.show('Đã xóa', 'Phản hồi nhân viên đã được xóa.', 'success');
                    window.loadCruiseReviews(cruiseId, 1);
                } else {
                    window.Popup.show('Lỗi', data.message || 'Không thể xóa phản hồi.', 'error');
                }
            } catch(e) {
                window.Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            }
        },
        true, // isDanger = true → nút đỏ
        'Xóa phản hồi'
    );
};
