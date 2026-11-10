// @ts-nocheck
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    const adsContainer = document.getElementById('adsContainer');
    const adModal = document.getElementById('adModal');
    const btnOpenModal = document.getElementById('btnOpenAdModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelAd = document.getElementById('btnCancelAd');
    const adForm = document.getElementById('adForm');

    let allAds = [];

    // Fields
    const adId = document.getElementById('adId');
    const adTitle = document.getElementById('adTitle');
    const adPosition = document.getElementById('adPosition');
    const adDescription = document.getElementById('adDescription');
    const adImageUrl = document.getElementById('adImageUrl');
    const fileAdImage = document.getElementById('fileAdImage');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const adLinkUrl = document.getElementById('adLinkUrl');
    const adLinkText = document.getElementById('adLinkText');
    const adPromoCode = document.getElementById('adPromoCode');
    const adFontFamily = document.getElementById('adFontFamily');
    const adTitleColorPicker = document.getElementById('adTitleColorPicker');
    const adTitleColor = document.getElementById('adTitleColor');
    const adBgPreset = document.getElementById('adBgPreset');
    const adBackgroundColor = document.getElementById('adBackgroundColor');
    const adIsActive = document.getElementById('adIsActive');
    const livePreviewBox = document.getElementById('livePreviewBox');

    // Live preview updater inside modal
    function updateLivePreview() {
        if (!livePreviewBox) return;
        const font = adFontFamily.value;
        const title = adTitle.value || 'Tiêu đề quảng cáo';
        const desc = adDescription.value || 'Nội dung mô tả ưu đãi dành cho khách hàng...';
        const img = adImageUrl.value;
        const linkText = adLinkText.value || 'Khám Phá Ngay';
        const code = adPromoCode.value;
        const titleColor = adTitleColor.value || '#0f172a';
        const bg = adBackgroundColor.value || '#ffffff';
        const isDark = bg.includes('#042f2e') || bg.includes('#0f172a');
        const bodyColor = isDark ? '#cbd5e1' : '#475569';

        let html = `
            <div style="font-family: ${font}; color: ${bodyColor};">
                ${img ? `<img src="${img}" style="width: 100%; max-height: 140px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;" alt="Banner">` : ''}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div>
                        <h4 style="margin: 0 0 6px; font-size: 18px; font-weight: 700; color: ${titleColor};">${title}</h4>
                        <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5;">${desc}</p>
                    </div>
                </div>
                ${code ? `
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(13,148,136,0.1); border: 1px dashed #0d9488; padding: 4px 10px; border-radius: 6px; margin-bottom: 12px; font-size: 12px;">
                        <span style="color: #0f766e; font-weight: 600;">Mã ưu đãi:</span>
                        <strong style="color: #0d9488; font-family: monospace; font-size: 14px;">${code}</strong>
                    </div>
                ` : ''}
                <div style="display: flex; justify-content: flex-end;">
                    <span style="background: #0d9488; color: white; padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                        <img src="/images/icons/cruise-yacht.png" class="app-icon-sm" alt="" style="filter: brightness(0) invert(1);"> ${linkText}
                    </span>
                </div>
            </div>
        `;
        livePreviewBox.style.background = bg;
        livePreviewBox.innerHTML = html;
    }

    // Color pickers / inputs sync
    adTitleColorPicker.addEventListener('input', (e) => {
        adTitleColor.value = e.target.value;
        updateLivePreview();
    });
    adTitleColor.addEventListener('input', (e) => {
        adTitleColorPicker.value = e.target.value;
        updateLivePreview();
    });

    adBgPreset.addEventListener('change', () => {
        if (adBgPreset.value === 'custom') {
            adBackgroundColor.style.display = 'block';
        } else {
            adBackgroundColor.style.display = 'none';
            adBackgroundColor.value = adBgPreset.value;
        }
        updateLivePreview();
    });
    adBackgroundColor.addEventListener('input', updateLivePreview);

    [adTitle, adDescription, adImageUrl, adLinkText, adPromoCode, adFontFamily].forEach(el => {
        el.addEventListener('input', updateLivePreview);
        el.addEventListener('change', updateLivePreview);
    });

    // Upload image
    fileAdImage.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            Popup.show('Đang tải...', 'Đang xử lý hình ảnh banner...', 'info');
            const res = await fetch('/api/Upload/image', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                adImageUrl.value = data.imageUrl;
                imagePreview.src = data.imageUrl;
                imagePreviewContainer.style.display = 'block';
                updateLivePreview();
                Popup.show('Thành công', 'Đã tải lên hình ảnh banner.', 'success');
            } else {
                Popup.show('Lỗi', 'Không thể tải lên hình ảnh.', 'error');
            }
        } catch (err) {
            Popup.show('Lỗi', 'Lỗi kết nối máy chủ khi tải ảnh.', 'error');
        }
    });

    // Load All Ads
    window.loadAds = async function() {
        if (!adsContainer) return;
        try {
            const res = await fetch('/api/PopupAds', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) {
                adsContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ef4444;">Không thể tải danh sách quảng cáo.</div>';
                return;
            }
            allAds = await res.json();
            renderAds();
        } catch {
            adsContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ef4444;">Lỗi kết nối máy chủ.</div>';
        }
    };

    const posLabels = {
        'center': 'Giữa màn hình (Modal)',
        'bottom-right': 'Góc dưới phải (Float)'
    };

    function renderAds() {
        if (!adsContainer) return;
        if (allAds.length === 0) {
            adsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
                    <img src="/images/icons/special-offer.png" class="app-icon-xl" alt="" style="margin-bottom: 12px;">
                    <h3 style="font-family: 'Playfair Display', serif; color: #0f172a; margin-bottom: 6px;">Chưa có Popup Quảng Cáo nào</h3>
                    <p style="color: #64748b; font-size: 14px;">Bấm nút "+ Tạo Popup Mới" ở góc trên để tạo chiến dịch marketing đầu tiên.</p>
                </div>
            `;
            return;
        }

        adsContainer.innerHTML = allAds.map(ad => {
            const posText = posLabels[ad.position] || ad.position;
            const isDark = ad.backgroundColor && (ad.backgroundColor.includes('#042f2e') || ad.backgroundColor.includes('#0f172a'));
            const descColor = isDark ? '#cbd5e1' : '#475569';

            return `
                <div class="ad-card">
                    <div class="ad-preview-box" style="background: ${ad.backgroundColor || '#ffffff'}; font-family: ${ad.fontFamily || 'Inter'};">
                        <span class="ad-pos-badge">${posText}</span>
                        ${ad.imageUrl ? `<img src="${ad.imageUrl}" class="ad-preview-img" alt="Ad">` : ''}
                        <h4 style="margin: 0 0 6px; font-size: 17px; font-weight: 700; color: ${ad.titleColor || '#0f172a'};">${ad.title}</h4>
                        <p style="margin: 0; font-size: 12.5px; color: ${descColor}; line-height: 1.4;">${ad.description || ''}</p>
                        ${ad.promoCode ? `
                            <div style="margin-top: 10px;">
                                <span style="background: rgba(13,148,136,0.15); color: #0f766e; border: 1px dashed #0d9488; padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 700; font-family: monospace;">
                                    🎟️ ${ad.promoCode}
                                </span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="ad-body">
                        <div class="ad-meta-row">
                            <span>Trạng thái: 
                                <strong style="color: ${ad.isActive ? '#15803d' : '#dc2626'};">${ad.isActive ? '● Đang hiển thị' : '○ Đang tạm dừng'}</strong>
                            </span>
                            <span>${new Date(ad.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div class="ad-actions">
                            <button class="btn btn-outline" style="font-size: 12px; padding: 7px 11px; font-weight: 600; color: #0f766e;" onclick="window.previewAd(${ad.id})" title="Xem thử Popup như trải nghiệm của khách hàng">
                                <img src="/images/icons/preview-eye.png" class="app-icon-sm" alt=""> Xem Thử
                            </button>
                            <button class="btn btn-outline" style="flex: 1; font-size: 12px; padding: 7px 10px;" onclick="window.toggleAd(${ad.id})">
                                ${ad.isActive ? 'Tạm Dừng' : 'Bật Hiển Thị'}
                            </button>
                            <button class="btn btn-primary" style="font-size: 12px; padding: 7px 12px;" onclick="window.editAd(${ad.id})">
                                <img src="/images/icons/edit-pencil.png" class="app-icon-sm" alt=""> Sửa
                            </button>
                            <button class="btn btn-outline" style="font-size: 12px; padding: 7px 10px; color: #dc2626; border-color: #fecaca;" onclick="window.deleteAd(${ad.id})">
                                <img src="/images/icons/delete-trash.png" class="app-icon-sm" alt="">
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Modal Handlers
    function openModal(isEdit = false) {
        document.getElementById('adModalTitle').innerHTML = isEdit
            ? '<img src="/images/icons/edit-pencil.png" class="app-icon" alt=""> Chỉnh Sửa Popup Quảng Cáo'
            : '<img src="/images/icons/special-offer.png" class="app-icon" alt=""> Tạo Popup Quảng Cáo Mới';
        adModal.classList.add('active');
        const modalBody = document.getElementById('adModalBody');
        if (modalBody) modalBody.scrollTop = 0;
        updateLivePreview();
    }

    function closeModal() {
        adModal.classList.remove('active');
    }

    if (btnOpenModal) {
        btnOpenModal.addEventListener('click', () => {
            adId.value = '';
            adForm.reset();
            adPosition.value = 'center';
            adBgPreset.value = '#ffffff';
            adBackgroundColor.value = '#ffffff';
            adBackgroundColor.style.display = 'none';
            adTitleColor.value = '#0f172a';
            adTitleColorPicker.value = '#0f172a';
            adFontFamily.value = "'Inter', sans-serif";
            adIsActive.checked = true;
            imagePreviewContainer.style.display = 'none';
            openModal(false);
        });
    }

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelAd) btnCancelAd.addEventListener('click', closeModal);
    if (adModal) {
        adModal.addEventListener('click', (e) => {
            if (e.target === adModal) closeModal();
        });
    }

    // Preview Ad Live on Screen (Xem thử như khách hàng thấy)
    window.previewAd = (id) => {
        const ad = allAds.find(x => x.id === id);
        if (!ad) return;

        // Xóa preview cũ nếu có
        const oldPreview = document.getElementById('admin-ad-preview-screen');
        if (oldPreview) oldPreview.remove();

        let position = (ad.position || 'center').toLowerCase();
        if (position === 'top-banner') position = 'bottom-right';
        const font = ad.fontFamily || "'Inter', sans-serif";
        const titleColor = ad.titleColor || '#0f172a';
        const bg = ad.backgroundColor || '#ffffff';
        const isDark = bg.includes('#042f2e') || bg.includes('#0f172a');
        const bodyColor = isDark ? '#cbd5e1' : '#475569';
        const linkText = ad.linkText || 'Khám Phá Ngay';

        const wrap = document.createElement('div');
        wrap.id = 'admin-ad-preview-screen';

        if (position === 'center') {
            wrap.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px);
                z-index: 9999999; display: flex; align-items: center; justify-content: center;
                padding: 20px; font-family: ${font}; animation: adFadeIn 0.3s ease-out;
            `;
            wrap.innerHTML = `
                <div style="position: relative; width: 100%; max-width: 520px; background: ${bg}; border-radius: 20px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.35); overflow: hidden; color: ${bodyColor};">
                    <button type="button" id="btnAdminClosePreview" style="position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.1); background: white; color: #475569; font-size: 20px; cursor: pointer; z-index: 10; display:flex; align-items:center; justify-content:center;">&times;</button>
                    ${ad.imageUrl ? `<div style="max-height: 220px; overflow: hidden;"><img src="${ad.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;"></div>` : ''}
                    <div style="padding: 26px;">
                        <span style="background: #0d9488; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Xem Thử Ưu Đãi</span>
                        <h3 style="margin: 10px 0; font-size: 22px; font-weight: 700; color: ${titleColor};">${ad.title}</h3>
                        <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.5;">${ad.description || ''}</p>
                        ${ad.promoCode ? `<div style="background: rgba(13,148,136,0.1); border: 1.5px dashed #0d9488; padding: 8px 14px; border-radius: 8px; margin-bottom: 18px; display:inline-block; font-size: 13px; color: #0d9488; font-weight: 700; font-family: monospace;">Mã: ${ad.promoCode}</div>` : ''}
                        <div style="display: flex; justify-content: flex-end; gap: 10px;">
                            <button type="button" id="btnAdminDismissPreview" style="background: transparent; border: none; color: #64748b; font-size: 14px; cursor: pointer; padding: 8px 14px;">Bỏ qua</button>
                            <span style="background: #0d9488; color: white; padding: 10px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                                <img src="/images/icons/cruise-yacht.png" class="app-icon-sm" alt="" style="filter: brightness(0) invert(1);"> ${linkText}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        } else if (position === 'bottom-right') {
            wrap.style.cssText = `
                position: fixed; bottom: 84px; right: 24px; width: 340px; max-width: calc(100vw - 48px);
                background: ${bg}; border-radius: 16px; box-shadow: 0 16px 36px rgba(0,0,0,0.22);
                z-index: 9999999; overflow: hidden; font-family: ${font}; color: ${bodyColor}; animation: adSlideUp 0.35s ease-out;
            `;
            wrap.innerHTML = `
                <button type="button" id="btnAdminClosePreview" style="position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(15,23,42,0.6); color: white; font-size: 18px; cursor: pointer; z-index: 10; display:flex; align-items:center; justify-content:center;">&times;</button>
                ${ad.imageUrl ? `<img src="${ad.imageUrl}" style="width: 100%; max-height: 140px; object-fit: cover; display: block;">` : ''}
                <div style="padding: 16px;">
                    <h4 style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: ${titleColor};">${ad.title}</h4>
                    <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.45;">${ad.description || ''}</p>
                    ${ad.promoCode ? `<div style="font-size: 12px; margin-bottom: 12px; color: #0d9488; font-weight: 700;">Mã: ${ad.promoCode}</div>` : ''}
                    <div style="display: flex; justify-content: flex-end;">
                        <span style="background: #0d9488; color: white; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;">${linkText}</span>
                    </div>
                </div>
            `;
        }
        document.body.appendChild(wrap);

        const closePreview = () => {
            wrap.remove();
        };

        const btnC = document.getElementById('btnAdminClosePreview');
        if (btnC) btnC.addEventListener('click', closePreview);
        const btnD = document.getElementById('btnAdminDismissPreview');
        if (btnD) btnD.addEventListener('click', closePreview);
        if (position === 'center') {
            wrap.addEventListener('click', (e) => {
                if (e.target === wrap) closePreview();
            });
        }
    };

    // Edit Ad
    window.editAd = (id) => {
        const ad = allAds.find(x => x.id === id);
        if (!ad) return;

        adId.value = ad.id;
        adTitle.value = ad.title || '';
        adDescription.value = ad.description || '';
        adPosition.value = ad.position || 'center';
        adImageUrl.value = ad.imageUrl || '';
        if (ad.imageUrl) {
            imagePreview.src = ad.imageUrl;
            imagePreviewContainer.style.display = 'block';
        } else {
            imagePreviewContainer.style.display = 'none';
        }
        adLinkUrl.value = ad.linkUrl || '';
        adLinkText.value = ad.linkText || 'Khám Phá Ngay';
        adPromoCode.value = ad.promoCode || '';
        adFontFamily.value = ad.fontFamily || "'Inter', sans-serif";
        adTitleColor.value = ad.titleColor || '#0f172a';
        adTitleColorPicker.value = ad.titleColor && ad.titleColor.startsWith('#') ? ad.titleColor : '#0f172a';
        
        const presetMatch = ['#ffffff', 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', 'linear-gradient(135deg, #042f2e 0%, #0f172a 100%)'].includes(ad.backgroundColor);
        if (presetMatch) {
            adBgPreset.value = ad.backgroundColor;
            adBackgroundColor.style.display = 'none';
            adBackgroundColor.value = ad.backgroundColor;
        } else {
            adBgPreset.value = 'custom';
            adBackgroundColor.style.display = 'block';
            adBackgroundColor.value = ad.backgroundColor || '#ffffff';
        }

        adIsActive.checked = ad.isActive;
        openModal(true);
    };

    // Toggle Status
    window.toggleAd = async (id) => {
        try {
            const res = await fetch(`/api/PopupAds/${id}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                window.loadAds();
            } else {
                Popup.show('Lỗi', 'Không thể đổi trạng thái.', 'error');
            }
        } catch {
            Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
        }
    };

    // Delete Ad
    window.deleteAd = (id) => {
        Popup.confirm('Xóa Popup Quảng Cáo', 'Bạn có chắc chắn muốn xóa quảng cáo này? Khách hàng sẽ không còn nhìn thấy popup nữa.', async () => {
            try {
                const res = await fetch(`/api/PopupAds/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    Popup.show('Thành công', 'Đã xóa popup quảng cáo.', 'success');
                    window.loadAds();
                } else {
                    Popup.show('Lỗi', 'Không thể xóa quảng cáo.', 'error');
                }
            } catch {
                Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            }
        });
    };

    // Submit Form
    if (adForm) {
        adForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = adId.value;
            const payload = {
                title: adTitle.value.trim(),
                description: adDescription.value.trim(),
                position: adPosition.value,
                imageUrl: adImageUrl.value.trim(),
                linkUrl: adLinkUrl.value.trim(),
                linkText: adLinkText.value.trim() || 'Khám Phá Ngay',
                promoCode: adPromoCode.value.trim(),
                fontFamily: adFontFamily.value,
                titleColor: adTitleColor.value.trim() || '#0f172a',
                backgroundColor: adBackgroundColor.value.trim() || '#ffffff',
                isActive: adIsActive.checked
            };

            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/PopupAds/${id}` : '/api/PopupAds';

            try {
                const res = await fetch(url, {
                    method,
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    Popup.show('Thành công', id ? 'Đã cập nhật quảng cáo.' : 'Đã tạo quảng cáo mới.', 'success');
                    closeModal();
                    window.loadAds();
                } else {
                    const err = await res.json().catch(() => ({}));
                    Popup.show('Lỗi', err.message || 'Không thể lưu quảng cáo.', 'error');
                }
            } catch {
                Popup.show('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            }
        });
    }

    window.loadAds();
});
