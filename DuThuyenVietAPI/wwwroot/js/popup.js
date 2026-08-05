// Thư viện Popup/Toast dùng chung cho toàn dự án
window.Popup = (function() {
    let toastContainer = null;
    let modalOverlay = null;

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
            
            document.getElementById('modal-cancel').addEventListener('click', close);
        }
    }

    function close() {
        if (modalOverlay) {
            modalOverlay.classList.remove('show');
            setTimeout(() => {
                document.getElementById('modal-input').style.display = 'none';
                document.getElementById('modal-input').value = '';
                document.getElementById('modal-confirm').className = 'modal-btn modal-btn-confirm';
            }, 200);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

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

        confirm: function(title, message, onConfirm, isDanger = false) {
            if(!modalOverlay) init();
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-body').innerText = message;
            
            const btnConfirm = document.getElementById('modal-confirm');
            btnConfirm.innerText = 'Xác nhận';
            if (isDanger) {
                btnConfirm.className = 'modal-btn modal-btn-danger';
                btnConfirm.innerText = 'Xóa';
            } else {
                btnConfirm.className = 'modal-btn modal-btn-confirm';
            }
            
            const newBtn = btnConfirm.cloneNode(true);
            btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);
            
            newBtn.addEventListener('click', () => {
                close();
                if (onConfirm) onConfirm();
            });

            modalOverlay.classList.add('show');
        },

        prompt: function(title, message, placeholder, onComplete) {
            if(!modalOverlay) init();
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-body').innerText = message;
            
            const input = document.getElementById('modal-input');
            input.style.display = 'block';
            input.placeholder = placeholder || '';
            input.type = 'text'; // Can be adjusted
            
            const btnConfirm = document.getElementById('modal-confirm');
            btnConfirm.className = 'modal-btn modal-btn-confirm';
            btnConfirm.innerText = 'Lưu';
            
            const newBtn = btnConfirm.cloneNode(true);
            btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);
            
            newBtn.addEventListener('click', () => {
                const val = document.getElementById('modal-input').value;
                if (!val) {
                    input.style.borderColor = 'red';
                    return;
                }
                close();
                if (onComplete) onComplete(val);
            });

            modalOverlay.classList.add('show');
            setTimeout(() => input.focus(), 100);
        },

        gallery: function(title, imagesArray) {
            if(!modalOverlay) init();
            document.getElementById('modal-title').innerText = title;
            
            const card = modalOverlay.querySelector('.modal-card');
            card.classList.add('gallery-modal');

            const body = document.getElementById('modal-body');
            let imagesHtml = imagesArray.map(img => `<img src="${img}" alt="Gallery Image" loading="lazy">`).join('');
            body.innerHTML = `<div class="gallery-grid">${imagesHtml}</div>`;
            
            document.getElementById('modal-input').style.display = 'none';
            
            const btnConfirm = document.getElementById('modal-confirm');
            btnConfirm.style.display = 'none'; // Hide confirm btn for gallery
            
            const btnCancel = document.getElementById('modal-cancel');
            btnCancel.innerText = 'Đóng';
            
            const newBtn = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(newBtn, btnCancel);
            
            newBtn.addEventListener('click', () => {
                close();
                setTimeout(() => {
                    card.classList.remove('gallery-modal');
                    btnConfirm.style.display = 'inline-block';
                }, 300);
            });

            modalOverlay.classList.add('show');
        }
    };
})();
