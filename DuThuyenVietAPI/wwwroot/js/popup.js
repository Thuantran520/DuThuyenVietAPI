// Thư viện Popup/Toast dùng chung cho toàn dự án
window.Popup = (function() {
    let toastContainer = null;
    let modalOverlay = null;
    let activeConfirmCallback = null;
    let activeCancelCallback = null;

    function init() {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.className = 'modal-overlay';
            modalOverlay.innerHTML = `
                <div class="modal-card">
                    <button class="modal-close-icon" id="modal-close-icon" title="Đóng">✕</button>
                    <h3 class="modal-title" id="modal-title"></h3>
                    <div class="modal-body" id="modal-body"></div>
                    <input type="text" class="modal-input" id="modal-input" style="display: none;">
                    <div class="modal-actions">
                        <button class="modal-btn modal-btn-cancel" id="modal-cancel">Hủy</button>
                        <button class="modal-btn modal-btn-confirm" id="modal-confirm">Xác nhận</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modalOverlay);
            
            document.getElementById('modal-cancel').addEventListener('click', () => {
                close();
                if (activeCancelCallback) activeCancelCallback();
            });
            document.getElementById('modal-close-icon').addEventListener('click', () => {
                close();
                if (activeCancelCallback) activeCancelCallback();
            });
            document.getElementById('modal-confirm').addEventListener('click', () => {
                console.log("modal-confirm element clicked in DOM. activeConfirmCallback exists:", !!activeConfirmCallback);
                if (activeConfirmCallback) activeConfirmCallback();
            });
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    close();
                    if (activeCancelCallback) activeCancelCallback();
                }
            });
        }
    }

    function close() {
        if (modalOverlay) {
            modalOverlay.classList.remove('show');
            setTimeout(() => {
                const input = document.getElementById('modal-input');
                if (input) {
                    input.style.display = 'none';
                    input.value = '';
                    input.style.borderColor = '#d1d5db';
                }
                const btnConfirm = document.getElementById('modal-confirm');
                if (btnConfirm) {
                    btnConfirm.className = 'modal-btn modal-btn-confirm';
                    btnConfirm.style.display = 'inline-block';
                }
                const btnCancel = document.getElementById('modal-cancel');
                if (btnCancel) {
                    btnCancel.style.display = 'inline-block';
                    btnCancel.innerText = 'Hủy';
                }
                activeConfirmCallback = null;
                activeCancelCallback = null;
            }, 200);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    // ===== GALLERY LIGHTBOX =====
    let galleryImages = [];
    let galleryCurrentIndex = 0;
    let lightboxOverlay = null;

    function initLightbox() {
        if (lightboxOverlay) return;
        lightboxOverlay = document.createElement('div');
        lightboxOverlay.id = 'lightbox-overlay';
        lightboxOverlay.innerHTML = `
            <div class="lightbox-backdrop"></div>
            <div class="lightbox-container">
                <button class="lightbox-close" id="lightbox-close" title="Đóng (Esc)">✕</button>
                <button class="lightbox-nav lightbox-prev" id="lightbox-prev" title="Ảnh trước (←)">&#8249;</button>
                <div class="lightbox-img-wrap">
                    <img id="lightbox-img" src="" alt="Gallery">
                    <div class="lightbox-loader" id="lightbox-loader"></div>
                </div>
                <button class="lightbox-nav lightbox-next" id="lightbox-next" title="Ảnh sau (→)">&#8250;</button>
                <div class="lightbox-counter" id="lightbox-counter">1 / 1</div>
            </div>
        `;
        document.body.appendChild(lightboxOverlay);

        document.getElementById('lightbox-close').onclick = closeLightbox;
        document.querySelector('.lightbox-backdrop').onclick = closeLightbox;
        document.getElementById('lightbox-prev').onclick = () => navigateLightbox(-1);
        document.getElementById('lightbox-next').onclick = () => navigateLightbox(1);

        document.addEventListener('keydown', (e) => {
            if (!lightboxOverlay.classList.contains('show')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
            if (e.key === 'ArrowRight') navigateLightbox(1);
        });
    }

    function openLightbox(images, startIndex) {
        initLightbox();
        galleryImages = images;
        galleryCurrentIndex = startIndex;
        lightboxOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
        updateLightboxImage();
    }

    function closeLightbox() {
        if (lightboxOverlay) {
            lightboxOverlay.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    function navigateLightbox(delta) {
        galleryCurrentIndex = (galleryCurrentIndex + delta + galleryImages.length) % galleryImages.length;
        updateLightboxImage();
    }

    function updateLightboxImage() {
        const img = document.getElementById('lightbox-img');
        const loader = document.getElementById('lightbox-loader');
        const counter = document.getElementById('lightbox-counter');
        const prevBtn = document.getElementById('lightbox-prev');
        const nextBtn = document.getElementById('lightbox-next');

        if (!img) return;

        loader.style.display = 'block';
        img.style.opacity = '0';

        const src = galleryImages[galleryCurrentIndex];
        img.onload = () => {
            loader.style.display = 'none';
            img.style.opacity = '1';
        };
        img.onerror = () => {
            loader.style.display = 'none';
            img.style.opacity = '1';
        };
        img.src = src;
        counter.innerText = `${galleryCurrentIndex + 1} / ${galleryImages.length}`;

        prevBtn.style.display = galleryImages.length <= 1 ? 'none' : 'flex';
        nextBtn.style.display = galleryImages.length <= 1 ? 'none' : 'flex';
    }

    return {
        show: function(title, message, type = 'success') {
            if(!toastContainer) init();
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            let icon = '🔔';
            if (type === 'success') icon = '✅';
            if (type === 'error') icon = '❌';

            toast.innerHTML = `
                <div class="toast-icon">${icon}</div>
                <div class="toast-content">
                    <h4>${title}</h4>
                    <p>${message}</p>
                </div>
            `;
            
            toastContainer.appendChild(toast);
            
            setTimeout(() => toast.classList.add('show'), 10);
            
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        confirm: function(title, message, onConfirm, isDanger = false, confirmBtnText = null) {
            console.log("Popup.confirm triggered. Title:", title, "Message:", message);
            if(!modalOverlay) init();
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-body').innerText = message;
            
            const btnConfirm = document.getElementById('modal-confirm');
            btnConfirm.innerText = confirmBtnText || 'Xác nhận';
            if (isDanger) {
                btnConfirm.className = 'modal-btn modal-btn-danger';
                if (!confirmBtnText) btnConfirm.innerText = 'Xóa';
            } else {
                btnConfirm.className = 'modal-btn modal-btn-confirm';
            }
            
            activeConfirmCallback = () => {
                console.log("activeConfirmCallback executing. Calling close() and onConfirm()...");
                close();
                if (onConfirm) onConfirm();
            };
            activeCancelCallback = null;

            modalOverlay.classList.add('show');
        },

        prompt: function(title, message, placeholder, onComplete) {
            if(!modalOverlay) init();
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-body').innerText = message;
            
            const input = document.getElementById('modal-input');
            input.style.display = 'block';
            input.placeholder = placeholder || '';
            input.type = 'text';
            
            const btnConfirm = document.getElementById('modal-confirm');
            btnConfirm.className = 'modal-btn modal-btn-confirm';
            btnConfirm.innerText = 'Lưu';
            
            activeConfirmCallback = () => {
                const val = input.value;
                if (!val) {
                    input.style.borderColor = 'red';
                    return;
                }
                close();
                if (onComplete) onComplete(val);
            };
            activeCancelCallback = null;

            modalOverlay.classList.add('show');
            setTimeout(() => input.focus(), 100);
        },

        gallery: function(title, imagesArray) {
            if(!modalOverlay) init();
            document.getElementById('modal-title').innerText = title;
            
            const card = modalOverlay.querySelector('.modal-card');
            card.classList.add('gallery-modal');

            const body = document.getElementById('modal-body');
            
            if (!imagesArray || imagesArray.length === 0) {
                body.innerHTML = '<p style="text-align:center; color:#64748b; padding:20px;">Không có ảnh nào.</p>';
            } else {
                const imagesHtml = imagesArray.map((img, idx) => `
                    <div class="gallery-thumb-wrap" onclick="window.Popup._openLightboxAt(${idx})" title="Nhấn để xem ảnh lớn">
                        <img src="${img}" alt="Ảnh ${idx + 1}" loading="lazy" onerror="this.src='/images/default-cruise.jpg'">
                        <div class="gallery-thumb-overlay"><span></span></div>
                    </div>
                `).join('');
                body.innerHTML = `
                    <div class="gallery-count-badge">${imagesArray.length} ảnh</div>
                    <div class="gallery-grid">${imagesHtml}</div>
                `;
            }
            
            const input = document.getElementById('modal-input');
            if (input) input.style.display = 'none';
            const btnConfirm = document.getElementById('modal-confirm');
            if (btnConfirm) btnConfirm.style.display = 'none';
            
            const btnCancel = document.getElementById('modal-cancel');
            if (btnCancel) btnCancel.innerText = 'Đóng';
            
            activeCancelCallback = () => {
                close();
                setTimeout(() => {
                    card.classList.remove('gallery-modal');
                }, 300);
            };
            activeConfirmCallback = null;

            // Store images for lightbox
            galleryImages = imagesArray;
            window.Popup._openLightboxAt = (idx) => openLightbox(imagesArray, idx);

            modalOverlay.classList.add('show');
        },

        _openLightboxAt: function(idx) {
            openLightbox(galleryImages, idx);
        }
    };
})();
