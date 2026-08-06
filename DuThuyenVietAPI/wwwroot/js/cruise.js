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

window.loadHomeCruises = async function(page = 1) {
    try {
        const container = document.getElementById('topCruisesList');
        const paginationContainer = document.getElementById('homePagination');
        if (!container) return;

        container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">Đang tải...</p>';
        
        const response = await fetch(`${API_URL}/Cruises?page=${page}&pageSize=6`);
        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
            container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">Chưa có dữ liệu du thuyền.</p>';
            if(paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        container.innerHTML = data.data.map(cruise => renderCruiseCard(cruise)).join('');
        
        if(paginationContainer) {
            let paginationHtml = '';
            for (let i = 1; i <= data.totalPages; i++) {
                paginationHtml += `<button class="btn-page ${i === data.currentPage ? 'active' : ''}" onclick="window.loadHomeCruises(${i})">${i}</button>`;
            }
            paginationContainer.innerHTML = paginationHtml;
        }
    } catch (error) {
        console.error('Error loading home cruises:', error);
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
            window.selectedCabins = {};
            window.cabinData = {};
            cabinsHtml = cruise.cabins.map(cabin => {
                window.cabinData[cabin.cabinTypeId] = { price: cabin.basePrice, totalRooms: cabin.totalRooms || 10 };
                return `
                <div class="cabin-card luxury-card mb-4" style="display: flex; gap: 20px; padding: 20px;">
                    <img src="${cabin.imageUrl || '/images/default-cabin.jpg'}" alt="${cabin.name}" class="cabin-img" style="width: 250px; height: 180px; object-fit: cover; border-radius: 12px; box-shadow: var(--shadow);">
                    <div class="cabin-info" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h4 style="font-size: 1.3rem; margin-bottom: 10px;">${cabin.name}</h4>
                            <p class="text-muted"><i class="icon-users"></i> Sức chứa: ${cabin.maxOccupancy} người | 🛏️ Tổng số phòng: ${cabin.totalRooms || 'Không giới hạn'}</p>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                            <div class="price" style="font-size: 1.4rem; color: var(--primary); font-weight: 700;">${formatPrice(cabin.basePrice)} <span style="font-size: 1rem; color: #666; font-weight: 400;">/ phòng</span></div>
                            <div class="room-selector" style="display: flex; align-items: center; gap: 15px; background: var(--bg-light); padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border);">
                                <button onclick="window.updateCabinCount(${cabin.cabinTypeId}, -1)" style="border: none; background: #e2e8f0; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; font-weight: bold; color: #333;">-</button>
                                <span id="cabin-count-${cabin.cabinTypeId}" style="font-size: 1.2rem; font-weight: 600; min-width: 20px; text-align: center;">0</span>
                                <button onclick="window.updateCabinCount(${cabin.cabinTypeId}, 1)" style="border: none; background: var(--primary); width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; font-weight: bold; color: white;">+</button>
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            cabinsHtml += `<div id="cabin-total-summary" style="display: none; position: sticky; bottom: 20px; z-index: 10;"></div>`;
        } else {
            cabinsHtml = '<p>Không có phòng nào.</p>';
        }

        let schedulesHtml = '';
        if (cruise.schedules && cruise.schedules.length > 0) {
            schedulesHtml = cruise.schedules.map(s => `
                <div class="schedule-item mb-3 p-3" id="schedule-box-${s.scheduleId}" style="margin-bottom: 16px; transition: all 0.3s ease; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="window.selectSchedule(${s.scheduleId})">
                    <div>
                        <div style="font-weight: 700; color: #1e293b; font-size: 1.1rem; margin-bottom: 4px;">📅 ${new Date(s.departureDate).toLocaleDateString('vi-VN')}</div>
                        <div style="color: #64748b; font-size: 0.95rem;">⏱️ ${s.durationLabel}</div>
                    </div>
                    <button class="btn-outline" id="btn-schedule-${s.scheduleId}" style="padding: 8px 16px; font-size: 0.95rem; border-radius: 8px; border: 1px solid var(--primary); color: var(--primary); background: transparent; font-weight: 600; pointer-events: none;">Chọn</button>
                </div>
            `).join('');
        } else {
            schedulesHtml = '<p>Chưa có lịch trình mở nào.</p>';
        }

        // Reviews section sẽ được load động từ API (feature/review)
        const reviewsHtml = `
            <div id="reviews-summary" style="display:flex; align-items:center; gap:20px; margin-bottom:20px; padding:16px; background:#fffbeb; border-radius:12px; border:1px solid #fde68a;">
                <div style="text-align:center;">
                    <div style="font-size:3rem; font-weight:800; color:#f59e0b; line-height:1;">${cruise.averageRating || '—'}</div>
                    <div style="color:#fde047; font-size:1.3rem; margin:4px 0;">${cruise.averageRating ? ('★'.repeat(Math.round(cruise.averageRating)) + '☆'.repeat(5 - Math.round(cruise.averageRating))) : '☆☆☆☆☆'}</div>
                    <div style="font-size:0.85rem; color:#92400e; font-weight:500;">${cruise.reviewCount || 0} đánh giá</div>
                </div>
            </div>
            <div id="review-form-wrap" style="margin-bottom:28px;"></div>
            <div id="reviews-list"><p style="color:#888;">Đang tải đánh giá...</p></div>
            <div id="reviews-pagination" style="display:flex; gap:8px; margin-top:16px;"></div>
        `;

        let heroImage = cruise.images && cruise.images.length > 0 ? cruise.images[0] : '/images/default-cruise.jpg';
        // Logic mở thư viện ảnh
        const imagesJson = JSON.stringify(cruise.images || [heroImage]).replace(/"/g, '&quot;');
        let galleryButton = `<button class="btn-secondary" style="position: absolute; bottom: 20px; right: 20px; background: white; color: black; border-radius: 8px; font-weight: 600; box-shadow: var(--shadow);" onclick="window.Popup.gallery('Thư viện ảnh', JSON.parse('${imagesJson}'))"><i class="icon-camera"></i> Xem tất cả ảnh</button>`;

        container.innerHTML = `
            <div class="cruise-detail-header mb-4 text-center">
                <h1 class="cruise-title" style="font-size: 3rem; font-family: var(--font-heading); color: var(--text-dark); margin-bottom: 15px;">${cruise.name}</h1>
                <div class="cruise-meta d-flex justify-content-center align-items-center" style="font-size: 1.1rem; gap: 20px; color: #555;">
                    <span class="rating">⭐ <strong>${cruise.averageRating}</strong> (${cruise.reviewCount} đánh giá)</span>
                    <span>•</span>
                    <span class="destination">📍 ${cruise.destinationName}</span>
                </div>
                <div class="cruise-itinerary mt-3" style="font-size: 1.15rem; color: var(--primary); font-weight: 500;">
                    ⚓ ${cruise.shortDescription || 'Chưa cập nhật hành trình'}
                </div>
            </div>
            
            <div class="hero-image-wrapper mb-5" style="position: relative; width: 100%; height: 500px; border-radius: 16px; overflow: hidden; box-shadow: var(--shadow);">
                <img src="${heroImage}" alt="${cruise.name}" style="width: 100%; height: 100%; object-fit: cover;">
                ${galleryButton}
            </div>

            <div class="row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 60px; margin-top: 60px;">
                <div class="main-content">
                    <div class="cruise-section mb-5">
                        <h3 class="section-heading mb-4" style="font-size: 1.8rem;">Tổng Quan</h3>
                        <p style="font-size: 1.1rem; line-height: 1.8; color: #444;">${cruise.description || cruise.shortDescription || 'Chưa có mô tả'}</p>
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
                    <div class="booking-widget luxury-card" style="position: sticky; top: 120px; padding: 30px; background: var(--white); border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 15px 50px rgba(0,0,0,0.1);">
                        <div class="price-tag text-center mb-4" style="padding-bottom: 20px; border-bottom: 1px solid #eee;">
                            <p style="color: #666; margin-bottom: 5px; text-transform: uppercase; font-size: 0.9rem; font-weight: 600; letter-spacing: 1px;">Giá tham khảo</p>
                            <div style="font-size: 2.2rem; font-weight: 700; color: var(--primary);">
                                ${formatPrice(cruise.cabins && cruise.cabins.length > 0 ? cruise.cabins[0].basePrice : 0)}
                            </div>
                            <span style="font-size: 1rem; color: #888; font-weight: 400;">/ Khách</span>
                        </div>
                        
                        <div class="booking-benefits mb-4" style="font-size: 0.95rem; color: #555;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                <span style="color: #10b981; font-size: 1.2rem;">✓</span> Hủy phòng miễn phí
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                <span style="color: #10b981; font-size: 1.2rem;">✓</span> Không thu phí đặt chỗ
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="color: #10b981; font-size: 1.2rem;">✓</span> Hỗ trợ 24/7
                            </div>
                        </div>

                        <div class="schedule-section" style="margin-top: 25px; padding-top: 25px; border-top: 1px solid #eee;">
                            <h4 class="mb-3" style="font-size: 1.2rem; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                📅 Chọn Lịch Khởi Hành
                            </h4>
                            <div class="schedule-list" style="max-height: 350px; overflow-y: auto; padding-right: 10px;">
                                ${schedulesHtml}
                            </div>
                        </div>
                        
                        <div class="help-box mt-4 p-3 text-center" style="background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
                            <p style="margin-bottom: 5px; font-weight: 500; color: #334155;">Cần hỗ trợ?</p>
                            <a href="tel:19001234" style="color: var(--primary); font-weight: 700; font-size: 1.2rem; text-decoration: none;">📞 1900 1234</a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load reviews và form sau khi HTML đã được render
        setTimeout(() => {
            window.loadCruiseReviews(id, 1);
            window.loadReviewForm(id);
        }, 100);

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
        el.style.borderColor = '#e2e8f0';
        el.style.background = 'transparent';
        const btn = el.querySelector('button');
        if(btn) {
            btn.className = 'btn-outline';
            btn.innerText = 'Chọn';
            btn.style.background = 'transparent';
            btn.style.color = 'var(--primary)';
        }
    });

    // Highlight selected
    const box = document.getElementById(`schedule-box-${scheduleId}`);
    const btn = document.getElementById(`btn-schedule-${scheduleId}`);
    if(box && btn) {
        box.style.borderColor = 'var(--primary)';
        box.style.background = '#f0fdf4';
        btn.className = 'btn-primary';
        btn.innerText = 'Đã chọn ✓';
        btn.style.background = 'var(--primary)';
        btn.style.color = 'white';
        
        // Auto scroll to cabins after slight delay for better UX
        setTimeout(() => {
            const cabinSection = document.querySelector('.cabin-list');
            if (cabinSection) {
                cabinSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    }
};

window.selectedCabins = {}; 
window.cabinData = {};

window.updateCabinCount = function(cabinId, delta) {
    const data = window.cabinData[cabinId];
    if (!data) return;
    
    let current = window.selectedCabins[cabinId] || 0;
    let next = current + delta;
    
    if (next < 0) next = 0;
    if (next > data.totalRooms) {
        if(window.Popup) window.Popup.show('Thông báo', `Chỉ còn ${data.totalRooms} phòng trống loại này.`, 'info');
        next = data.totalRooms;
    }
    
    window.selectedCabins[cabinId] = next;
    document.getElementById(`cabin-count-${cabinId}`).innerText = next;
    
    updateTotalSelectedPrice();
};

window.updateTotalSelectedPrice = function() {
    let total = 0;
    let selectedCount = 0;
    for (const [id, count] of Object.entries(window.selectedCabins)) {
        if (count > 0) {
            total += window.cabinData[id].price * count;
            selectedCount += count;
        }
    }
    
    const summaryEl = document.getElementById('cabin-total-summary');
    if (selectedCount > 0) {
        summaryEl.style.display = 'block';
        summaryEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: #fff; border-radius: 12px; border: 2px solid var(--primary); margin-top: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
                <div>
                    <span style="font-size: 1.1rem; color: #555;">Đã chọn <strong>${selectedCount}</strong> phòng</span>
                    <div style="font-size: 1.6rem; font-weight: 700; color: #ef4444;">Tổng: ${formatPrice(total)}</div>
                </div>
                <button class="btn-primary" style="font-size: 1.2rem; padding: 14px 30px; border-radius: 10px; font-weight: bold; text-transform: uppercase;" onclick="window.bookMultipleCabins()">Tiếp tục đặt phòng</button>
            </div>
        `;
    } else {
        summaryEl.style.display = 'none';
    }
};

window.bookMultipleCabins = function() {
    if (!window.selectedScheduleId) {
        if(window.Popup) {
            window.Popup.show('Thông báo', 'Vui lòng chọn Lịch Khởi Hành ở bên phải trước khi đặt phòng.', 'warning');
        } else {
            alert('Vui lòng chọn Lịch Khởi Hành trước khi đặt phòng.');
        }
        return;
    }
    
    let selected = [];
    for (const [id, count] of Object.entries(window.selectedCabins)) {
        if (count > 0) selected.push(`${id}:${count}`);
    }
    
    if (selected.length === 0) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const cruiseId = urlParams.get('id');
    window.location.href = `/booking.html?cruiseId=${cruiseId}&scheduleId=${window.selectedScheduleId}&cabins=${selected.join(',')}`;
};

function renderCruiseCard(cruise) {
    return `
        <div class="cruise-card">
            <img src="${cruise.thumbnailUrl || '/images/default-cruise.jpg'}" alt="${cruise.name}" class="cruise-img" onerror="this.src='/images/default-cruise.jpg'">
            <div class="cruise-card-body">
                <h3 class="cruise-title"><a href="/cruise-detail.html?id=${cruise.cruiseId}">${cruise.name}</a></h3>
                <div class="cruise-meta mb-3">
                    <span class="rating">⭐ ${cruise.averageRating} (${cruise.reviewCount})</span>
                    <span class="destination">📍 ${cruise.destinationName}</span>
                </div>
                <div class="cruise-footer">
                    <span class="price">Từ ${formatPrice(cruise.startingPrice)}</span>
                    <a href="/cruise-detail.html?id=${cruise.cruiseId}" class="btn-secondary">Xem Chi Tiết</a>
                </div>
            </div>
        </div>
    `;
}

