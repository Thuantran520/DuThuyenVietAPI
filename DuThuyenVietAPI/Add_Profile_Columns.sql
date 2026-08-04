-- Chạy đoạn script này trong SSMS (SQL Server Management Studio)
-- Để thêm 2 cột FullName và AvatarUrl vào bảng AspNetUsers

USE DuThuyenVietDB;
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[AspNetUsers]') AND name = 'FullName'
)
BEGIN
    ALTER TABLE [dbo].[AspNetUsers] ADD [FullName] nvarchar(256) NULL;
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[AspNetUsers]') AND name = 'AvatarUrl'
)
BEGIN
    ALTER TABLE [dbo].[AspNetUsers] ADD [AvatarUrl] nvarchar(max) NULL;
END
GO

PRINT 'Thêm cột FullName và AvatarUrl thành công!';
