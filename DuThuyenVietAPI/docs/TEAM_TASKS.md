# 🚀 BẢNG PHÂN CHIA NHIỆM VỤ NÓM & QUY TẮC NHÁNH GIT (TEAM_TASKS.md)

Hiện tại toàn bộ code nền tảng đã được đồng bộ chuẩn xác. Chúng ta sẽ chia nhau phụ trách 4 nhánh độc lập. Yêu cầu mọi người **chỉ code và push lên nhánh được phân công**, tuyệt đối không đụng vào `main`.

---

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
  * Tích hợp ô nhập mã giảm giá (**Promotions**) ở sidebar trang đặt vé và tự động tính trừ tiền.
* **Về Backend & Cải tiến:** 
  * Tích hợp cổng thanh toán thực tế (VNPay, MoMo, hoặc PayPal).
  * Viết API tự động gửi **Email xác nhận mã vé** sau khi thanh toán.
  * **(Cập nhật):** Tích hợp logic **Mã Giảm Giá (Promotions)** vào luồng thanh toán. Xác thực mã và tính lại tổng tiền trực tiếp trên trang Checkout.

**Quy định File được phép chỉnh sửa:**
* **Backend:** `Controllers/BookingsController.cs`, `Models/Booking.cs`, `DTOs/BookingDTO.cs`
* **Frontend:** `wwwroot/booking.html`, `wwwroot/checkout.html`, `wwwroot/history.html`, `wwwroot/js/booking-page.js`, `wwwroot/js/checkout-page.js`, `wwwroot/js/history-page.js`, `wwwroot/css/checkout.css`, `wwwroot/css/booking.css`

---

## 👤 Thành viên 3: Phụ trách nhánh `feature/review-blog` (Đánh giá, Tin tức & Mã Khuyến Mãi)
**Nhiệm vụ trọng tâm:** Tăng độ uy tín cho website thông qua review thật, SEO bằng bài viết và Quản lý mã giảm giá Admin.
* **Về UI/UX (Giao diện):** 
  * Xây dựng giao diện trang **Cẩm nang/Tin tức (`wwwroot/blog.html`)** cho khách hàng xem bài viết.
  * Xây dựng giao diện Admin **Quản lý Bài viết (`wwwroot/admin/blog.html`)**.
  * Xây dựng giao diện Admin **Quản lý Mã Khuyến Mãi (`wwwroot/admin/promotions.html`)** (Chỉ Admin có quyền).
* **Về Backend & Cải tiến:** 
  * Viết tính năng cho phép khách hàng **upload hình ảnh** khi đánh giá.
  * Xây dựng các API CRUD cho hệ thống Bài viết (`BlogPostsController.cs`).
  * Xây dựng các API CRUD cho hệ thống Mã Khuyến Mãi (`PromotionsController.cs`).
  * **(Cập nhật):** Xây dựng giao diện Quản trị bài viết cho Admin (Thêm/Sửa/Xóa bài viết).

**Quy định File được phép chỉnh sửa:**
* **Backend:** `Controllers/ReviewsController.cs`, `Controllers/BlogPostsController.cs`, `Controllers/PromotionsController.cs`
* **Frontend:** `wwwroot/js/review.js`, `wwwroot/blog.html`, `wwwroot/js/blog.js`, `wwwroot/admin/blog.html`, `wwwroot/admin/promotions.html`, `wwwroot/js/promotions.js`

---

## 👑 Lead Developer: Phụ trách nhánh `feature/cruise` & System
**Nhiệm vụ trọng tâm:** Quản lý hệ thống cốt lõi, nâng cấp giao diện Admin Du Thuyền & Tiện ích.
* **Về UI/UX (Giao diện):** 
  * Thiết kế lại trang Admin **Quản lý Du Thuyền (`wwwroot/admin/cruise-editor.html`)** theo phong cách **Dashboard 2 Cột**: Cột trái Form nhập liệu (Tên, Giá, Loại phòng, Lịch trình, Tiện ích), Cột phải xem trước Card du thuyền sống động trực tiếp (Live Preview).
  * Xây dựng giao diện Admin **Quản lý Tiện ích (`wwwroot/admin/amenities.html`)** dạng **Danh sách Card/Grid icon** (Pool 🏊‍♂️, Spa 💆‍♀️, Wifi 📶) dễ dàng thêm/xóa nhanh.
* **Quản lý Code (Code Reviewer):** Duyệt code của 3 thành viên kia và merge vào `dev`.

**Quy định File được phép chỉnh sửa:**
* **Backend:** `Controllers/CruisesController.cs`, `Controllers/AmenitiesController.cs`, `Program.cs`, `appsettings.json`.
* **Frontend:** `wwwroot/index.html`, `wwwroot/search.html`, `wwwroot/cruise-detail.html`, `wwwroot/js/cruise.js`, `wwwroot/admin/cruise-editor.html`, `wwwroot/js/admin-cruise-editor.js`, `wwwroot/admin/amenities.html`, `wwwroot/css/cruise-editor.css`.

---

## 💡 QUY TẮC BẮT BUỘC KHI LÀM VIỆC:
1. **"File của ai người nấy sửa"**: Tuyệt đối không sửa đè vào file thuộc vùng hoạt động của nhánh khác.
2. **Push đúng nhánh**: Mỗi người chỉ push code lên nhánh `feature/...` tương ứng của mình.
3. **Chỉ Merge khi có sự đồng ý của Lead**: Nhánh `dev` và `main` chỉ gộp code sau khi build không lỗi.
