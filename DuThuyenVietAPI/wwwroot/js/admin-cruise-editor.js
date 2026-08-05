document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.replace('/login.html');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const cruiseId = urlParams.get('id');
    
    if (cruiseId) {
        document.getElementById('editor-title').innerText = 'Chỉnh sửa Du Thuyền';
        loadCruise(cruiseId);
    }

    document.getElementById('btn-save-cruise').addEventListener('click', saveCruise);

    async function loadCruise(id) {
        try {
            const res = await fetch(`/api/Cruises/${id}`);
            if (res.ok) {
                const c = await res.json();
                document.getElementById('edit-name').value = c.name;
                document.getElementById('edit-dest').value = c.destinationId || '1';
                document.getElementById('edit-cabins').value = c.totalCabins || 20;
                document.getElementById('edit-shortdesc').value = c.shortDescription || '';
                document.getElementById('edit-desc').value = c.description || '';
                
                const thumbUrl = c.thumbnailUrl || (c.images && c.images.length > 0 ? c.images[0] : '');
                document.getElementById('edit-thumb').value = thumbUrl;
                document.getElementById('preview-thumb').src = thumbUrl || '/images/default-cruise.jpg';
            } else {
                Popup.show('Lỗi', 'Không tìm thấy thông tin du thuyền.', 'error');
            }
        } catch (err) {
            console.error(err);
            Popup.show('Lỗi', 'Lỗi tải dữ liệu du thuyền.', 'error');
        }
    }

    async function saveCruise() {
        const btn = document.getElementById('btn-save-cruise');
        btn.innerText = 'Đang lưu...';
        btn.disabled = true;

        const data = {
            destinationId: parseInt(document.getElementById('edit-dest').value) || 1,
            name: document.getElementById('edit-name').value,
            totalCabins: parseInt(document.getElementById('edit-cabins').value) || 20,
            shortDescription: document.getElementById('edit-shortdesc').value,
            description: document.getElementById('edit-desc').value,
            thumbnailUrl: document.getElementById('edit-thumb').value
        };

        const method = cruiseId ? 'PUT' : 'POST';
        const url = cruiseId ? `/api/Cruises/${cruiseId}` : '/api/Cruises';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 
                    'Authorization': 'Bearer ' + token, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(data)
            });
            
            if (res.ok) {
                Popup.show('Thành công', 'Lưu du thuyền thành công!', 'success');
                setTimeout(() => {
                    window.location.href = '/admin/profile.html';
                }, 1500);
            } else {
                let errorMsg = 'Lỗi không xác định.';
                try {
                    const errObj = await res.json();
                    errorMsg = errObj.message || errObj.title || JSON.stringify(errObj);
                } catch(e) {
                    errorMsg = await res.text();
                }
                Popup.show('Lỗi', 'Lưu thất bại: ' + errorMsg, 'error');
            }
        } catch (error) {
            console.error(error);
            Popup.show('Lỗi', 'Lỗi kết nối đến máy chủ.', 'error');
        } finally {
            btn.innerText = 'Lưu Thay Đổi';
            btn.disabled = false;
        }
    }
});
