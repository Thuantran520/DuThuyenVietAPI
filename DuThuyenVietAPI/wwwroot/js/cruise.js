const API_URL = '/api';

const formatPrice = (price) => {
    if (!price) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
};

async function loadDestinations(selectId) {
    try {
        const response = await fetch(`${API_URL}/Destinations`);
        const data = await response.json();
        const select = document.getElementById(selectId);
        if (!select) return;

        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);

        data.forEach(dest => {
            const option = document.createElement('option');
            option.value = dest.destinationId;
            option.textContent = dest.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading destinations:', error);
    }
}

async function loadTopCruises() {
    try {
        const response = await fetch(`${API_URL}/Cruises?pageSize=6`);
        const data = await response.json();
        const container = document.getElementById('topCruisesList');
        if (!container) return;

        container.innerHTML = data.data.map(cruise => renderCruiseCard(cruise)).join('');
    } catch (error) {
        console.error('Error loading top cruises:', error);
    }
}

async function initSearchPage() {
    const form = document.getElementById('filterForm');
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('keyword')) {
        document.getElementById('filterKeyword').value = urlParams.get('keyword');
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const keyword = document.getElementById('filterKeyword').value;
        const destinationId = document.getElementById('filterDestination').value;
        
        let query = [];
        if (keyword) query.push(`keyword=${encodeURIComponent(keyword)}`);
        if (destinationId) query.push(`destinationId=${destinationId}`);
        
        const queryString = query.length ? `?${query.join('&')}` : '';
        window.history.pushState({}, '', `/search.html${queryString}`);
        performSearch(1);
    });

    setTimeout(() => {
        if (urlParams.has('destinationId')) {
            document.getElementById('filterDestination').value = urlParams.get('destinationId');
        }
        performSearch(1);
    }, 300);
}

window.performSearch = async function(page = 1) {
    const container = document.getElementById('searchResultsList');
    const paginationContainer = document.getElementById('pagination');
    
    try {
        container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">Đang tìm kiếm...</p>';
        const urlParams = new URLSearchParams(window.location.search);
        let url = `${API_URL}/Cruises?page=${page}&pageSize=9`;
        
        if (urlParams.has('keyword')) url += `&keyword=${encodeURIComponent(urlParams.get('keyword'))}`;
        if (urlParams.has('destinationId')) url += `&destinationId=${urlParams.get('destinationId')}`;

        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
            container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">Không tìm thấy kết quả nào.</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        container.innerHTML = data.data.map(cruise => renderCruiseCard(cruise)).join('');
        
        let paginationHtml = '';
        for (let i = 1; i <= data.totalPages; i++) {
            paginationHtml += `<button class="btn-page ${i === data.currentPage ? 'active' : ''}" onclick="performSearch(${i})">${i}</button>`;
        }
        paginationContainer.innerHTML = paginationHtml;

    } catch (error) {
        console.error('Error searching cruises:', error);
        container.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: red;">Có lỗi xảy ra khi tìm kiếm.</p>';
    }
};

async function loadCruiseDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const container = document.getElementById('cruiseDetailContainer');
    
    if (!id) {
        container.innerHTML = '<p class="text-center" style="color: red;">Không tìm thấy mã du thuyền.</p>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/Cruises/${id}`);
        if (!response.ok) throw new Error('Not found');
        const cruise = await response.json();
        

        let cabinsHtml = '';
        if (cruise.cabins && cruise.cabins.length > 0) {
            cabinsHtml = cruise.cabins.map(cabin => `
                <div class="cabin-card luxury-card mb-4" style="display: flex; gap: 20px; padding: 20px;">
                    <img src="${cabin.imageUrl || '/images/default-cabin.jpg'}" alt="${cabin.name}" class="cabin-img" style="width: 250px; height: 180px; object-fit: cover; border-radius: 12px; box-shadow: var(--shadow);">
                    <div class="cabin-info" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h4 style="font-size: 1.3rem; margin-bottom: 10px;">${cabin.name}</h4>
                            <p class="text-muted"><i class="icon-users"></i> Sức chứa: ${cabin.maxOccupancy} người</p>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                            <div class="price" style="font-size: 1.4rem; color: var(--primary); font-weight: 700;">${formatPrice(cabin.basePrice)} <span style="font-size: 1rem; color: #666; font-weight: 400;">/ đêm</span></div>
                            <button class="btn-primary" style="padding: 12px 25px; border-radius: 8px; font-weight: 600;" onclick="window.bookCabin(${cabin.cabinTypeId})">Đặt Phòng</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            cabinsHtml = '<p>Không có phòng nào.</p>';
        }

        let schedulesHtml = '';
        if (cruise.schedules && cruise.schedules.length > 0) {
            schedulesHtml = cruise.schedules.map(s => `
                <div class="schedule-item mb-2 p-3 border rounded" id="schedule-box-${s.scheduleId}" style="transition: all 0.2s;">
                    <strong>${new Date(s.departureDate).toLocaleDateString('vi-VN')}</strong> - ${s.durationLabel}
                    <button class="btn-secondary float-right" id="btn-schedule-${s.scheduleId}" onclick="window.selectSchedule(${s.scheduleId})" style="padding: 5px 10px; font-size: 14px;">Chọn lịch này</button>
                </div>
            `).join('');
        } else {
            schedulesHtml = '<p>Chưa có lịch trình mở nào.</p>';
        }

        let reviewsHtml = '';
        if (cruise.recentReviews && cruise.recentReviews.length > 0) {
            reviewsHtml = cruise.recentReviews.map(r => `
                <div class="review-item mb-3 pb-3 border-bottom">
                    <div class="rating-stars" style="color: #fde047;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                    <p class="mb-1">${r.comment}</p>
                    <small class="text-muted">${new Date(r.createdAt).toLocaleDateString('vi-VN')}</small>
                </div>
            `).join('');
        } else {
            reviewsHtml = '<p>Chưa có đánh giá nào.</p>';
        }

        let heroImage = cruise.images && cruise.images.length > 0 ? cruise.images[0] : '/images/default-cruise.jpg';
        // Logic mở thư viện ảnh
        const imagesJson = JSON.stringify(cruise.images || [heroImage]).replace(/"/g, '&quot;');
        let galleryButton = `<button class="btn-secondary" style="position: absolute; bottom: 20px; right: 20px; background: white; color: black; border-radius: 8px; font-weight: 600; box-shadow: var(--shadow);" onclick="window.Popup.gallery('Thư viện ảnh', JSON.parse('${imagesJson}'))"><i class="icon-camera"></i> Xem tất cả ảnh</button>`;
        let amenitiesHtml = '';
        if (cruise.amenities && cruise.amenities.length > 0) {
            amenitiesHtml = cruise.amenities.map(a => `
                <div class="amenity-card" style="display: flex; align-items: center; gap: 15px; padding: 15px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-light);">
                    <span style="font-size: 1.5rem; color: var(--primary);">${a.iconClass || '✨'}</span>
                    <span style="font-weight: 500; font-size: 1.1rem;">${a.name}</span>
                </div>
            `).join('');
        } else {
            amenitiesHtml = '<p>Không có tiện nghi nào.</p>';
        }

        container.innerHTML = `
            <div class="cruise-detail-header mb-4 text-center">
                <h1 class="cruise-title" style="font-size: 3rem; font-family: var(--font-heading); color: var(--text-dark); margin-bottom: 15px;">${cruise.name}</h1>
                <div class="cruise-meta d-flex justify-content-center align-items-center" style="font-size: 1.1rem; gap: 20px; color: #555;">
                    <span class="rating">⭐ <strong>${cruise.averageRating}</strong> (${cruise.reviewCount} đánh giá)</span>
                    <span>•</span>
                    <span class="destination">📍 ${cruise.destinationName}</span>
                </div>
            </div>
            
            <div class="hero-image-wrapper mb-5" style="position: relative; width: 100%; height: 500px; border-radius: 16px; overflow: hidden; box-shadow: var(--shadow);">
                <img src="${heroImage}" alt="${cruise.name}" style="width: 100%; height: 100%; object-fit: cover;">
                ${galleryButton}
            </div>

            <div class="row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 60px;">
                <div class="main-content">
                    <div class="cruise-section mb-5">
                        <h3 class="section-heading mb-3" style="font-size: 1.8rem; border-bottom: 2px solid var(--border); padding-bottom: 10px;">Về Du Thuyền</h3>
                        <p style="font-size: 1.1rem; line-height: 1.8; color: #444;">${cruise.description || cruise.shortDescription || 'Chưa có mô tả'}</p>
                    </div>

                    <div class="cruise-section mb-5">
                        <h3 class="section-heading mb-4" style="font-size: 1.8rem;">Tiện Nghi Nổi Bật</h3>
                        <div class="amenities-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
                            ${amenitiesHtml}
                        </div>
                    </div>

                    <div class="cruise-section mb-5">
                        <h3 class="section-heading mb-4" style="font-size: 1.8rem;">Các Loại Phòng</h3>
                        <div class="cabin-list">
                            ${cabinsHtml}
                        </div>
                    </div>

                    <div class="cruise-section mb-5">
                        <h3 class="section-heading mb-4" style="font-size: 1.8rem;">Đánh giá từ khách hàng</h3>
                        <div class="reviews-list">
                            ${reviewsHtml}
                        </div>
                    </div>
                </div>
                
                <div class="sidebar">
                    <div class="booking-widget luxury-card" style="position: sticky; top: 120px; padding: 30px; background: var(--white); border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin-bottom: 20px;">
                            Từ ${formatPrice(cruise.cabins && cruise.cabins.length > 0 ? cruise.cabins[0].basePrice : 0)} <span style="font-size: 1rem; color: #666; font-weight: 400;">/ đêm</span>
                        </div>
                        <h4 class="mb-3" style="font-size: 1.2rem; font-weight: 600;">Chọn Lịch Khởi Hành</h4>
                        <div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
                            ${schedulesHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading details:', error);
        container.innerHTML = `<p class="text-center" style="color: red;">Du thuyền không tồn tại hoặc có lỗi xảy ra.</p>`;
    }
}

window.selectedScheduleId = null;

window.selectSchedule = function(scheduleId) {
    window.selectedScheduleId = scheduleId;
    
    // Reset all
    document.querySelectorAll('.schedule-item').forEach(el => {
        el.style.borderColor = 'var(--border)';
        el.style.background = 'transparent';
    });
    document.querySelectorAll('.schedule-item button').forEach(el => {
        el.className = 'btn-secondary float-right';
        el.innerText = 'Chọn lịch này';
    });

    // Highlight selected
    const box = document.getElementById(`schedule-box-${scheduleId}`);
    const btn = document.getElementById(`btn-schedule-${scheduleId}`);
    if(box && btn) {
        box.style.borderColor = 'var(--primary)';
        box.style.background = 'var(--bg-light)';
        btn.className = 'btn-primary float-right';
        btn.innerText = 'Đã chọn ✓';
    }
};

window.bookCabin = function(cabinTypeId) {
    if (!window.selectedScheduleId) {
        if(window.Popup) {
            window.Popup.show('Thông báo', 'Vui lòng chọn Lịch Khởi Hành trước khi đặt phòng.', 'warning');
        } else {
            alert('Vui lòng chọn Lịch Khởi Hành trước khi đặt phòng.');
        }
        return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const cruiseId = urlParams.get('id');
    window.location.href = `/booking.html?cruiseId=${cruiseId}&scheduleId=${window.selectedScheduleId}&cabinTypeId=${cabinTypeId}`;
};

function renderCruiseCard(cruise) {
    return `
        <div class="cruise-card">
            <img src="${cruise.thumbnailUrl || '/images/default-cruise.jpg'}" alt="${cruise.name}" class="cruise-img" onerror="this.src='/images/default-cruise.jpg'">
            <div class="cruise-card-body">
                <h3 class="cruise-title"><a href="/cruise-detail.html?id=${cruise.cruiseId}">${cruise.name}</a></h3>
                <div class="cruise-meta">
                    <span class="rating">⭐ ${cruise.averageRating} (${cruise.reviewCount})</span>
                    <span class="destination">📍 ${cruise.destinationName}</span>
                </div>
                <p class="cruise-desc">${cruise.shortDescription || ''}</p>
                <div class="cruise-footer">
                    <span class="price">Từ ${formatPrice(cruise.startingPrice)}</span>
                    <a href="/cruise-detail.html?id=${cruise.cruiseId}" class="btn-secondary">Xem Chi Tiết</a>
                </div>
            </div>
        </div>
    `;
}
