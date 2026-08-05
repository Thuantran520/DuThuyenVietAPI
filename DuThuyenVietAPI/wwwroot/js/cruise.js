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
        
        let imagesHtml = '';
        if (cruise.images && cruise.images.length > 0) {
            imagesHtml = cruise.images.map(img => `<img src="${img}" alt="${cruise.name}" class="gallery-img">`).join('');
        } else {
            imagesHtml = `<img src="/images/default-cruise.jpg" alt="${cruise.name}" class="gallery-img">`;
        }

        let amenitiesHtml = '';
        if (cruise.amenities && cruise.amenities.length > 0) {
            amenitiesHtml = cruise.amenities.map(a => `<span class="amenity-item">${a.iconClass || '✨'} ${a.name}</span>`).join('');
        } else {
            amenitiesHtml = '<p>Không có tiện nghi nào.</p>';
        }

        let cabinsHtml = '';
        if (cruise.cabins && cruise.cabins.length > 0) {
            cabinsHtml = cruise.cabins.map(cabin => `
                <div class="cabin-card">
                    <img src="${cabin.imageUrl || '/images/default-cabin.jpg'}" alt="${cabin.name}" class="cabin-img">
                    <div class="cabin-info">
                        <h4>${cabin.name}</h4>
                        <p>Sức chứa: ${cabin.maxOccupancy} người</p>
                        <p class="price">${formatPrice(cabin.basePrice)} / đêm</p>
                        <button class="btn-primary w-100 mt-2">Đặt Phòng</button>
                    </div>
                </div>
            `).join('');
        } else {
            cabinsHtml = '<p>Không có phòng nào.</p>';
        }

        let schedulesHtml = '';
        if (cruise.schedules && cruise.schedules.length > 0) {
            schedulesHtml = cruise.schedules.map(s => `
                <div class="schedule-item mb-2 p-3 border rounded">
                    <strong>${new Date(s.departureDate).toLocaleDateString('vi-VN')}</strong> - ${s.durationLabel}
                    <button class="btn-primary float-right" style="padding: 5px 10px; font-size: 14px;">Chọn lịch này</button>
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

        container.innerHTML = `
            <div class="cruise-detail-header mb-4">
                <h1 class="cruise-title" style="font-size: 2.5rem;">${cruise.name}</h1>
                <div class="cruise-meta" style="font-size: 1.1rem; justify-content: flex-start; gap: 20px;">
                    <span class="rating">⭐ ${cruise.averageRating} (${cruise.reviewCount} đánh giá)</span>
                    <span class="destination">📍 ${cruise.destinationName}</span>
                </div>
            </div>
            
            <div class="image-gallery mb-4">
                ${imagesHtml}
            </div>

            <div class="row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 40px;">
                <div class="main-content">
                    <div class="cruise-description mb-4">
                        <h3>Về Du Thuyền</h3>
                        <p>${cruise.description || cruise.shortDescription || 'Chưa có mô tả'}</p>
                    </div>

                    <div class="cruise-amenities mb-4">
                        <h3>Tiện Nghi</h3>
                        <div class="amenities-list">
                            ${amenitiesHtml}
                        </div>
                    </div>

                    <div class="cruise-cabins mb-4">
                        <h3>Các Loại Phòng</h3>
                        <div class="cabin-grid">
                            ${cabinsHtml}
                        </div>
                    </div>

                    <div class="cruise-reviews mb-4">
                        <h3>Đánh giá gần đây</h3>
                        <div class="reviews-list mt-3">
                            ${reviewsHtml}
                        </div>
                    </div>
                </div>
                
                <div class="sidebar">
                    <div class="booking-widget p-4 border rounded" style="background: var(--white); position: sticky; top: 100px;">
                        <h3 class="mb-3">Lịch Khởi Hành</h3>
                        ${schedulesHtml}
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading details:', error);
        container.innerHTML = '<p class="text-center" style="color: red;">Du thuyền không tồn tại hoặc có lỗi xảy ra.</p>';
    }
}

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
