# 🚢 Du Thuyền Việt - Hệ Thống Đặt Vé & Quản Lý Du Thuyền

Chào mừng bạn đến với đồ án **Du Thuyền Việt** - Nền tảng đặt tour du thuyền online toàn diện kết hợp hệ thống quản trị chuyên nghiệp dành cho doanh nghiệp.

## 📖 Giới thiệu dự án

Dự án này được xây dựng nhằm mục đích cung cấp một giải pháp chuyển đổi số cho các doanh nghiệp kinh doanh tour du thuyền. Hệ thống bao gồm hai phân hệ chính:
- **Phân hệ Khách hàng:** Xem danh sách tour, tìm kiếm, đặt phòng (booking), quản lý thông tin cá nhân.
- **Phân hệ Quản trị (Admin/Staff):** Quản lý sản phẩm, danh mục, đơn đặt phòng, quản lý nhân sự/khách hàng, và thống kê doanh thu.

## 💻 Công nghệ sử dụng

- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Bootstrap
- **Backend:** C# / ASP.NET Core Web API
- **Cơ sở dữ liệu (Database):** SQL Server
- **ORM:** Entity Framework Core
- **Bảo mật (Authen & Author):** JWT (JSON Web Token) kết hợp ASP.NET Core Identity
- **Kiến trúc:** Client-Server thông qua các chuẩn RESTful API

---

## 👥 Danh sách thành viên nhóm và Phân công công việc

Dưới đây là thông tin các thành viên trong nhóm và các chức năng mà từng bạn đã đảm nhiệm trong suốt quá trình phát triển đồ án.

| STT | Họ và Tên | Mã Sinh Viên (MSSV) | Phân công công việc (Tasks) |
| :---: | :--- | :---: | :--- |
| **1** | Trần Phan Minh Thuận *(Nhóm trưởng)* | 23115371 | - Thiết kế Database và viết Script SQL.<br>- Xây dựng Backend (Auth, Quản lý User, Thống kê).<br>- Tích hợp JWT Token.<br>- Fix lỗi tối ưu hóa upload file ảnh trực tiếp lên Server. |
| **2** | Phạm Văn Thư | 2311553334 | - Code Frontend giao diện Quản trị (Admin Dashboard).<br>- Làm tính năng Quản lý Du thuyền, Danh mục, Đơn hàng.<br>- Ghép API cho các trang Admin. |
| **3** | Phạm Thanh Tài | 2311553867 | - Code Frontend giao diện Người dùng (Trang chủ, Tìm kiếm).<br>- Xây dựng luồng Đặt phòng (Booking), xem chi tiết sản phẩm.<br>- Viết báo cáo, kịch bản thuyết trình và làm slide đồ án. |
| **4** | Phạm Thị Ngọc Trâm | 2311559516 | - Code Frontend giao diện Quản trị | Báo cáo đồ án |


---

## 🚀 Hướng dẫn cài đặt và chạy dự án (Run Project)

**Yêu cầu hệ thống:**
- .NET 8.0 SDK (hoặc phiên bản tương ứng)
- SQL Server (và SQL Server Management Studio)
- Visual Studio 2022

**Các bước chạy:**
1. Clone dự án về máy:
   ```bash
   git clone https://github.com/your-username/DuThuyenVietAPI.git
   ```
2. Cập nhật chuỗi kết nối (`DefaultConnection`) trong file `appsettings.json` cho khớp với SQL Server của bạn.
3. Import file Database backup (`.bacpac` hoặc file `.sql`) vào SQL Server.
4. Mở Solution bằng Visual Studio, chọn project `DuThuyenVietAPI` làm Startup Project.
5. Nhấn `F5` hoặc `Ctrl + F5` để chạy dự án. Hệ thống sẽ tự động build backend và host giao diện frontend.

---

⭐ Đồ án môn học - Chúc nhóm đạt kết quả thật tốt! ⭐
