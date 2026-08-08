

Hiện tại toàn bộ code nền tảng đã được đồng bộ chuẩn xác. Chúng ta sẽ chia nhau phụ trách 4 nhánh độc lập. Yêu cầu mọi người **chỉ code và push lên nhánh được phân công**, tuyệt đối không đụng vào `main`.

## 👤 Thành viên 1: Phụ trách nhánh `feature/auth` (Tài khoản & Bảo mật)
**Nhiệm vụ trọng tâm:** Nâng cấp trải nghiệm người dùng lúc đăng nhập/đăng ký và tăng cường bảo mật.
* **Về UI/UX (Giao diện):** 
  * Thiết kế lại trang Đăng nhập/Đăng ký cho lộng lẫy hơn (thêm ảnh nền du thuyền đẹp mắt, hiệu ứng nổi bật).
  * Chăm chút lại trang Hồ sơ cá nhân, thêm tính năng upload Avatar.
* **Về Backend & Cải tiến:** 
  * Làm thêm chức năng **"Quên mật khẩu"** (Forgot Password) gửi OTP hoặc link qua Email.
  * Tích hợp thêm Đăng nhập bằng Google / Facebook (OAuth2).

**Quy định File được phép chỉnh sửa:**
* **Backend:** `Controllers/AccountController.cs`, `Controllers/UsersController.cs`, `DTOs/LoginDTO.cs`, `DTOs/RegisterDTO.cs`, `DTOs/ChangePasswordDTO.cs`
* **Frontend:** `wwwroot/login.html`, `wwwroot/register.html`, `wwwroot/profile.html`, `wwwroot/js/auth.js`

---

## 👤 Thành viên 2: Phụ trách nhánh `feature/booking` (Thanh toán & Đặt phòng)
**Nhiệm vụ trọng tâm:** Làm cho quy trình "xuống tiền" của khách hàng trở nên cực kỳ mượt mà và chuyên nghiệp.
* **Về UI/UX (Giao diện):** 
  * Cải tiến trang `checkout.html`: Làm một thanh Tiến trình (Progress bar) ở trên cùng.
  * Thiết kế form nhập thông tin khách hàng đẹp và có validate.
* **Về Backend & Cải tiến:** 
  * Tích hợp cổng thanh toán thực tế (VNPay, MoMo, hoặc PayPal).
  * Viết API tự động gửi **Email xác nhận mã vé** sau khi thanh toán.

**Quy định File được phép chỉnh sửa:**
* **Backend:** `Controllers/BookingsController.cs`, `Models/Booking.cs`, `Models/BookingDetail.cs`
* **Frontend:** `wwwroot/booking.html`, `wwwroot/checkout.html`, `wwwroot/history.html`, `wwwroot/js/booking-page.js`, `wwwroot/js/checkout-page.js`, `wwwroot/js/history-page.js`, `wwwroot/css/checkout.css`, `wwwroot/css/booking.css`

---

## 👤 Thành viên 3: Phụ trách nhánh `feature/review-blog` (Đánh giá & Tin tức)
**Nhiệm vụ trọng tâm:** Tăng độ uy tín cho website thông qua review thật và SEO bằng bài viết.
* **Về UI/UX (Giao diện):** 
  * Nâng cấp khu vực hiển thị Đánh giá: Thêm bộ lọc (VD: Lọc xem đánh giá 5 sao, lọc xem đánh giá có hình ảnh).
  * Xây dựng giao diện trang **Cẩm nang/Tin tức (Blog)**.
* **Về Backend & Cải tiến:** 
  * Viết tính năng cho phép khách hàng **upload hình ảnh** khi đánh giá.
  * Xây dựng các API CRUD cho hệ thống Bài viết (Blog Posts).

**Quy định File được phép chỉnh sửa:**
* **Backend:** `Controllers/ReviewsController.cs`, `Models/Review.cs`, Khởi tạo `Controllers/BlogsController.cs`
* **Frontend:** `wwwroot/js/review.js`, Khởi tạo `wwwroot/blog.html`, `wwwroot/js/blog.js`

---

## 👑 Lead Developer: Phụ trách nhánh `feature/cruise` & System
**Nhiệm vụ trọng tâm:** Quản lý hệ thống cốt lõi và kiểm duyệt code.
* **Hoàn thiện Core UI:** Làm đẹp trang Chi tiết Du thuyền và trang Tìm kiếm. Bổ sung bộ lọc tìm kiếm nâng cao.
* **Khu vực Admin:** Nâng cấp trang quản trị để thêm/sửa Du thuyền, Lịch trình, Giá phòng.
* **Quản lý Code (Code Reviewer):** Duyệt code của 3 thành viên kia và merge vào `dev`.

**Quy định File được phép chỉnh sửa:**
* **Backend:** `Controllers/CruisesController.cs`, `Program.cs`, `appsettings.json`, SQL Database.
* **Frontend:** `wwwroot/index.html`, `wwwroot/search.html`, `wwwroot/cruise-detail.html`, `wwwroot/js/cruise.js`, `wwwroot/admin/cruise-editor.html`, `wwwroot/js/admin-cruise-editor.js`, Các file CSS/JS dùng chung (layout.css, navigation.js, header, footer).

---
**💡 QUY TẮC BẮT BUỘC:** 
**"File của ai người nấy sửa"**. Tuyệt đối không sửa đè vào file thuộc vùng hoạt động của nhánh khác. Nếu cần truy xuất dữ liệu chéo, hãy thảo luận với Lead để viết thêm API hỗ trợ.
