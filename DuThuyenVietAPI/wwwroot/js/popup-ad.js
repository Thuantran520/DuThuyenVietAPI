// @ts-nocheck
/* ==========================================================================
   DuThuyenViet - Popup Ads & Marketing Promotions Client Engine
   ========================================================================== */

(function initPopupAdsEngine() {
    // Only run on public-facing pages (skip login, register, admin, checkout)
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/admin/') || path.includes('/login.html') || path.includes('/register.html') || path.includes('/checkout.html')) {
        return;
    }

    function onReady(fn) {
        if (document.readyState !== 'loading') {
            fn();
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    }

    onReady(async () => {
        try {
            // 1. Lấy danh sách các mã voucher khách đã từng dùng (từ localStorage hoặc API MyBookings)
            let usedPromoCodes = [];
            try {
                const storedUsed = localStorage.getItem('used_promotions');
                if (storedUsed) {
                    usedPromoCodes = JSON.parse(storedUsed);
                }
            } catch {}

            // Nếu user đã đăng nhập, kiểm tra lịch sử đặt phòng xem đã dùng voucher nào chưa
            const token = localStorage.getItem('auth_token');
            if (token && token !== 'null') {
                try {
                    const resBookings = await fetch('/api/Bookings/MyBookings', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (resBookings.ok) {
                        const myBookings = await resBookings.json();
                        myBookings.forEach(b => {
                            if (b.status !== 'Cancelled' && b.promotionCode) {
                                usedPromoCodes.push(b.promotionCode.toUpperCase());
                            }
                        });
                        localStorage.setItem('used_promotions', JSON.stringify([...new Set(usedPromoCodes)]));
                    }
                } catch {}
            }

            // 2. Tải danh sách quảng cáo đang hoạt động từ Backend
            const res = await fetch('/api/PopupAds/Active');
            if (!res.ok) return;

            const activeAds = await res.json();
            if (!activeAds || activeAds.length === 0) return;

            // 3. Lọc quảng cáo hợp lệ:
            // - Chưa bị đóng trong phiên hiện tại (sessionStorage)
            // - Nếu quảng cáo đính kèm mã discount và khách đã từng dùng mã này 1 lần rồi thì BỎ QUA ("nếu áp dụng discount dùng 1 lần này rồi thì bỏ qua")
            const eligibleAds = activeAds.filter(ad => {
                const isClosed = sessionStorage.getItem('dismissed_ad_' + ad.id);
                if (isClosed) return false;

                if (ad.promoCode && ad.promoCode.trim() !== '') {
                    const codeUpper = ad.promoCode.trim().toUpperCase();
                    if (usedPromoCodes.includes(codeUpper)) {
                        // Khách đã dùng mã này rồi -> Bỏ qua quảng cáo này!
                        return false;
                    }
                }
                return true;
            });

            if (eligibleAds.length === 0) return;

            // Hiển thị quảng cáo đầu tiên phù hợp sau một nhịp trễ nhẹ (800ms) để trang tải êm
            setTimeout(() => {
                renderPopupAd(eligibleAds[0]);
            }, 800);

        } catch (e) {
            console.warn('Popup Ads engine notice:', e);
        }
    });

    function renderPopupAd(ad) {
        // Prevent duplicate rendering
        if (document.getElementById('dutuyen-ad-overlay') || document.getElementById('dutuyen-ad-floating') || document.getElementById('dutuyen-ad-topbanner')) {
            return;
        }

        let position = (ad.position || 'center').toLowerCase();
        if (position === 'top-banner') position = 'bottom-right'; // Loại bỏ hoàn toàn kiểu top-banner theo yêu cầu
        const font = ad.fontFamily || "'Inter', sans-serif";
        const titleColor = ad.titleColor || '#0f172a';
        const bg = ad.backgroundColor || '#ffffff';
        const isDark = bg.includes('#042f2e') || bg.includes('#0f172a');
        const bodyColor = isDark ? '#cbd5e1' : '#475569';
        const linkUrl = ad.linkUrl || '/search.html';
        const linkText = ad.linkText || 'Khám Phá Ngay';

        if (position === 'center') {
            // Kiểu Modal Popup giữa màn hình có lớp phủ nền mờ (Backdrop)
            const overlay = document.createElement('div');
            overlay.id = 'dutuyen-ad-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(15, 23, 42, 0.65);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: adFadeIn 0.3s ease-out;
            `;

            const card = document.createElement('div');
            card.style.cssText = `
                position: relative;
                width: 100%;
                max-width: 520px;
                background: ${bg};
                border-radius: 20px;
                box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15);
                overflow: hidden;
                font-family: ${font};
                color: ${bodyColor};
                animation: adPopIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            `;

            card.innerHTML = `
                <button id="btnCloseAdModal" type="button" style="
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 1px solid rgba(0,0,0,0.1);
                    background: #ffffff;
                    color: #475569;
                    font-size: 20px;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 10;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    transition: all 0.2s ease;
                " title="Đóng quảng cáo">&times;</button>

                ${ad.imageUrl ? `
                    <div style="width: 100%; max-height: 240px; overflow: hidden; background: #0f172a;">
                        <img src="${ad.imageUrl}" alt="Banner" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                    </div>
                ` : ''}

                <div style="padding: 28px;">
                    <div style="display: inline-block; background: #0d9488; color: #ffffff; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                        Ưu Đãi Đặc Quyền
                    </div>
                    <h3 style="margin: 0 0 10px; font-size: 22px; font-weight: 700; color: ${titleColor}; line-height: 1.35;">
                        ${ad.title}
                    </h3>
                    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: ${bodyColor};">
                        ${ad.description || ''}
                    </p>

                    ${ad.promoCode ? `
                        <div style="background: rgba(13,148,136,0.1); border: 1.5px dashed #0d9488; border-radius: 10px; padding: 10px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <span style="font-size: 12px; color: #0f766e; font-weight: 600; display: block;">MÃ VOUCHER DÀNH CHO BẠN</span>
                                <strong style="font-family: monospace; font-size: 18px; color: #0d9488; letter-spacing: 1.5px;">${ad.promoCode}</strong>
                            </div>
                            <button id="btnCopyVoucher" type="button" style="background: #ffffff; border: 1px solid #14b8a6; color: #0d9488; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                <img src="/images/icons/clipboard.png" class="app-icon-sm" alt=""> Sao chép mã
                            </button>
                        </div>
                    ` : ''}

                    <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center;">
                        <button id="btnDismissAd" type="button" style="background: transparent; border: none; color: #64748b; font-size: 14px; font-weight: 500; cursor: pointer; padding: 10px 16px;">
                            Bỏ qua
                        </button>
                        <a href="${linkUrl}" id="btnGoToAd" style="
                            background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
                            color: #ffffff;
                            text-decoration: none;
                            padding: 11px 24px;
                            border-radius: 10px;
                            font-weight: 600;
                            font-size: 14px;
                            display: inline-flex;
                            align-items: center;
                            gap: 8px;
                            box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35);
                            transition: all 0.25s ease;
                        ">
                            <img src="/images/icons/cruise-yacht.png" class="app-icon-sm" alt="" style="filter: brightness(0) invert(1);">
                            ${linkText}
                        </a>
                    </div>
                </div>
            `;

            overlay.appendChild(card);
            document.body.appendChild(overlay);

            // Close actions
            const closeAd = () => {
                sessionStorage.setItem('dismissed_ad_' + ad.id, '1');
                overlay.style.animation = 'adFadeOut 0.25s ease-forward';
                setTimeout(() => overlay.remove(), 240);
            };

            document.getElementById('btnCloseAdModal').addEventListener('click', closeAd);
            document.getElementById('btnDismissAd').addEventListener('click', closeAd);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeAd();
            });

            // Copy voucher
            const btnCopy = document.getElementById('btnCopyVoucher');
            if (btnCopy) {
                btnCopy.addEventListener('click', () => {
                    navigator.clipboard.writeText(ad.promoCode).then(() => {
                        btnCopy.innerHTML = '<img src="/images/icons/check.png" class="app-icon-sm" alt=""> Đã chép!';
                        btnCopy.style.background = '#dcfce7';
                        btnCopy.style.color = '#15803d';
                        btnCopy.style.borderColor = '#86efac';
                    });
                });
            }

        } else if (position === 'bottom-right') {
            // Nổi góc dưới bên phải màn hình (đặt cao hơn nút live chat 24/7 để không chồng lấn)
            const floatBox = document.createElement('div');
            floatBox.id = 'dutuyen-ad-floating';
            floatBox.style.cssText = `
                position: fixed;
                bottom: 84px;
                right: 24px;
                width: 340px;
                max-width: calc(100vw - 48px);
                background: ${bg};
                border-radius: 16px;
                box-shadow: 0 16px 36px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06);
                z-index: 99980;
                overflow: hidden;
                font-family: ${font};
                color: ${bodyColor};
                animation: adSlideUp 0.35s ease-out;
            `;

            floatBox.innerHTML = `
                <button id="btnCloseAdFloat" type="button" style="
                    position: absolute; top: 10px; right: 10px; width: 28px; height: 28px;
                    border-radius: 50%; border: none; background: rgba(15,23,42,0.6);
                    color: #ffffff; font-size: 18px; line-height: 1; display: flex; align-items: center;
                    justify-content: center; cursor: pointer; z-index: 10;
                " title="Đóng">&times;</button>

                ${ad.imageUrl ? `<img src="${ad.imageUrl}" style="width: 100%; max-height: 140px; object-fit: cover; display: block;" alt="Banner">` : ''}

                <div style="padding: 16px;">
                    <h4 style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: ${titleColor};">${ad.title}</h4>
                    <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.45;">${ad.description || ''}</p>
                    ${ad.promoCode ? `
                        <div style="font-size: 12px; margin-bottom: 12px; color: #0d9488; font-weight: 600;">
                            Mã: <span style="background: #f0fdfa; border: 1px dashed #0d9488; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${ad.promoCode}</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: flex-end;">
                        <a href="${linkUrl}" style="background: #0d9488; color: white; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                            ${linkText}
                        </a>
                    </div>
                </div>
            `;

            document.body.appendChild(floatBox);

            document.getElementById('btnCloseAdFloat').addEventListener('click', () => {
                sessionStorage.setItem('dismissed_ad_' + ad.id, '1');
                floatBox.remove();
            });
        }
    }

    // CSS Keyframe Animations
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
        @keyframes adFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes adFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes adPopIn {
            0% { opacity: 0; transform: scale(0.9) translateY(20px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes adSlideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes adSlideDown {
            from { opacity: 0; transform: translateY(-100%); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(styleEl);
})();
