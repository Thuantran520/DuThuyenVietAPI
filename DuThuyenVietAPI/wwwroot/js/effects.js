// @ts-nocheck
/* ==========================================================================
   DuThuyenViet - Lottie Effects Helper
   ========================================================================== */
window.LottieEffects = {
    map: {
        'payment-success': '/effects/payment-success.json',
        '404-lost-in-bay': '/effects/404-lost-in-bay.json',
        'login-welcome': '/effects/login-welcome.json',
        'searching-cruise': '/effects/searching-cruise.json',
        'empty-trips': '/effects/empty-trips.json',
        'special-offer': '/effects/special-offer.json'
    },

    play: function(containerIdOrEl, effectName, options = {}) {
        const el = typeof containerIdOrEl === 'string' ? document.getElementById(containerIdOrEl) : containerIdOrEl;
        if (!el) return null;
        if (typeof lottie === 'undefined') {
            console.warn('Lottie library is not yet loaded.');
            return null;
        }

        const path = this.map[effectName] || effectName;
        el.innerHTML = '';
        return lottie.loadAnimation({
            container: el,
            renderer: 'svg',
            loop: options.loop !== false,
            autoplay: options.autoplay !== false,
            path: path,
            ...options
        });
    },

    initAuto: function() {
        if (typeof lottie === 'undefined') return;
        document.querySelectorAll('[data-lottie]').forEach(el => {
            if (el.dataset.lottieLoaded) return;
            const effectName = el.getAttribute('data-lottie');
            if (effectName) {
                el.dataset.lottieLoaded = 'true';
                window.LottieEffects.play(el, effectName);
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.LottieEffects.initAuto();
});

