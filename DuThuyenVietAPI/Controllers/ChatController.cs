using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DuThuyenVietAPI.Models;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ChatController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public ChatController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Kiểm tra và tự động giải quyết các phiên chat mà nhân viên đã trả lời nhưng khách không phản hồi sau 5 phút
    /// </summary>
    private async Task CheckAutoResolveInactivityAsync()
    {
        try
        {
            var fiveMinutesAgo = DateTime.UtcNow.AddMinutes(-5);
            var inactiveChats = await _context.ChatConversations
                .Where(c => c.Status == "StaffReplied" && c.LastStaffReplyAt.HasValue && c.LastStaffReplyAt.Value <= fiveMinutesAgo)
                .ToListAsync();

            if (inactiveChats.Any())
            {
                foreach (var chat in inactiveChats)
                {
                    chat.Status = "Resolved";
                    chat.ResolvedAt = DateTime.UtcNow;
                    chat.ResolvedBy = "Tự động (5 phút)";

                    var autoMsg = new ChatMessage
                    {
                        ConversationId = chat.ConversationId,
                        SenderType = "Staff",
                        SenderName = "Hệ Thống",
                        MessageText = "✨ Phiên trò chuyện đã được tự động gắn cờ Đã giải quyết sau 5 phút không có phản hồi mới. Quý khách vui lòng gửi đánh giá chất lượng phục vụ hoặc gửi tin nhắn mới để tiếp tục.",
                        SentAt = DateTime.UtcNow,
                        IsRead = true
                    };
                    _context.ChatMessages.Add(autoMsg);
                }
                await _context.SaveChangesAsync();
            }
        }
        catch { }
    }

    public class StartChatDTO
    {
        public string SessionId { get; set; } = null!;
        public string? CustomerName { get; set; }
        public string? CustomerEmail { get; set; }
    }

    /// <summary>
    /// Khởi tạo hoặc lấy lại phiên chat của khách theo SessionId
    /// </summary>
    [HttpPost("StartOrGet")]
    public async Task<IActionResult> StartOrGetConversation([FromBody] StartChatDTO dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.SessionId))
            {
                return BadRequest(new { message = "SessionId là bắt buộc." });
            }

            await CheckAutoResolveInactivityAsync();

            var conversation = await _context.ChatConversations
                .Include(c => c.Messages.OrderBy(m => m.SentAt))
                .FirstOrDefaultAsync(c => c.SessionId == dto.SessionId && c.Status != "Resolved");

            // Nếu không có phiên đang mở hoặc phiên cũ đã giải quyết thì tạo mới
            if (conversation == null)
            {
                conversation = new ChatConversation
                {
                    SessionId = dto.SessionId,
                    CustomerName = string.IsNullOrWhiteSpace(dto.CustomerName) ? "Khách hàng" : dto.CustomerName.Trim(),
                    CustomerEmail = dto.CustomerEmail?.Trim(),
                    Status = "Open",
                    CreatedAt = DateTime.UtcNow,
                    LastMessageAt = DateTime.UtcNow,
                    LastMessageSnippet = "Phiên hỗ trợ đã bắt đầu.",
                    UnreadStaffCount = 0,
                    UnreadCustomerCount = 0
                };
                _context.ChatConversations.Add(conversation);
                await _context.SaveChangesAsync();

                // Tin nhắn chào mừng tự động từ hệ thống
                var welcomeMsg = new ChatMessage
                {
                    ConversationId = conversation.ConversationId,
                    SenderType = "Staff",
                    SenderName = "Tư Vấn Viên",
                    MessageText = "Xin chào Quý khách! Du Thuyền Việt rất hân hạnh được hỗ trợ. Chuyên viên tư vấn đang kết nối để giải đáp cho Quý khách.",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                };
                _context.ChatMessages.Add(welcomeMsg);
                await _context.SaveChangesAsync();

                conversation = await _context.ChatConversations
                    .Include(c => c.Messages)
                    .FirstOrDefaultAsync(c => c.ConversationId == conversation.ConversationId);
            }

            return Ok(new
            {
                conversationId = conversation!.ConversationId,
                status = conversation.Status,
                customerName = conversation.CustomerName,
                customerEmail = conversation.CustomerEmail,
                assignedStaffName = conversation.AssignedStaffName,
                rating = conversation.Rating,
                ratingComment = conversation.RatingComment,
                resolvedBy = conversation.ResolvedBy,
                resolvedAt = conversation.ResolvedAt,
                messages = conversation.Messages.OrderBy(m => m.SentAt).Select(m => new
                {
                    m.MessageId,
                    m.SenderType,
                    m.SenderName,
                    m.MessageText,
                    m.SentAt,
                    m.IsRead
                })
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Lấy danh sách tin nhắn theo ConversationId
    /// </summary>
    [HttpGet("Messages/{conversationId}")]
    public async Task<IActionResult> GetMessages(int conversationId)
    {
        try
        {
            await CheckAutoResolveInactivityAsync();

            var conversation = await _context.ChatConversations.FindAsync(conversationId);
            if (conversation == null) return NotFound(new { message = "Không tìm thấy cuộc trò chuyện." });

            var messages = await _context.ChatMessages
                .AsNoTracking()
                .Where(m => m.ConversationId == conversationId)
                .OrderBy(m => m.SentAt)
                .ToListAsync();

            return Ok(new
            {
                conversationId = conversation!.ConversationId,
                status = conversation.Status,
                customerName = conversation.CustomerName,
                customerEmail = conversation.CustomerEmail,
                assignedStaffName = conversation.AssignedStaffName,
                lastStaffReplyAt = conversation.LastStaffReplyAt,
                rating = conversation.Rating,
                ratingComment = conversation.RatingComment,
                ratedAt = conversation.RatedAt,
                resolvedAt = conversation.ResolvedAt,
                resolvedBy = conversation.ResolvedBy,
                messages
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    public class SendMessageDTO
    {
        public int ConversationId { get; set; }
        public string SenderType { get; set; } = "Customer"; // Customer hoặc Staff
        public string? SenderName { get; set; }
        public string MessageText { get; set; } = null!;
    }

    /// <summary>
    /// Gửi tin nhắn mới (Khách hoặc Nhân viên)
    /// </summary>
    [HttpPost("SendMessage")]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageDTO dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.MessageText))
            {
                return BadRequest(new { message = "Nội dung tin nhắn không được để trống." });
            }

            var conversation = await _context.ChatConversations.FindAsync(dto.ConversationId);
            if (conversation == null) return NotFound(new { message = "Không tìm thấy cuộc hội thoại." });

            var now = DateTime.UtcNow;
            string senderType = dto.SenderType == "Staff" ? "Staff" : "Customer";
            
            // Xử lý tên người gửi: nếu nhân viên chat thì gắn chuyên viên tư vấn phụ trách
            string senderName;
            if (senderType == "Staff")
            {
                var staffClaim = User.Identity?.Name;
                senderName = !string.IsNullOrWhiteSpace(dto.SenderName)
                    ? dto.SenderName
                    : (!string.IsNullOrWhiteSpace(staffClaim) ? staffClaim : (conversation.AssignedStaffName ?? "Chuyên viên Du Thuyền Việt"));

                // Gán chuyên viên phụ trách tư vấn khách hàng này
                conversation.AssignedStaffName = senderName;
                conversation.AssignedStaffId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                conversation.Status = "StaffReplied";
                conversation.LastStaffReplyAt = now;
                conversation.UnreadCustomerCount++;
                conversation.UnreadStaffCount = 0;
            }
            else
            {
                senderName = conversation.CustomerName;
                // Nếu khách nhắn tin sau khi cuộc trò chuyện đã Resolved thì tự động mở lại
                if (conversation.Status == "Resolved" || conversation.Status == "StaffReplied")
                {
                    conversation.Status = "Open";
                }
                conversation.UnreadStaffCount++;
                conversation.UnreadCustomerCount = 0;
            }

            var message = new ChatMessage
            {
                ConversationId = conversation.ConversationId,
                SenderType = senderType,
                SenderName = senderName,
                MessageText = dto.MessageText.Trim(),
                SentAt = now,
                IsRead = false
            };

            _context.ChatMessages.Add(message);

            // Cập nhật trạng thái cuộc hội thoại
            conversation.LastMessageAt = now;
            conversation.LastMessageSnippet = dto.MessageText.Length > 100
                ? dto.MessageText.Substring(0, 97) + "..."
                : dto.MessageText;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                messageId = message.MessageId,
                conversationId = conversation.ConversationId,
                status = conversation.Status,
                assignedStaffName = conversation.AssignedStaffName,
                sentAt = message.SentAt
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    public class RateChatDTO
    {
        public int ConversationId { get; set; }
        public int Rating { get; set; } // 1 - 5 stars
        public string? Comment { get; set; }
    }

    /// <summary>
    /// Đánh giá chất lượng phục vụ sau khi tư vấn (Khách hàng)
    /// </summary>
    [HttpPost("Rate")]
    public async Task<IActionResult> RateConversation([FromBody] RateChatDTO dto)
    {
        try
        {
            if (dto.Rating < 1 || dto.Rating > 5)
            {
                return BadRequest(new { message = "Số sao đánh giá phải từ 1 đến 5." });
            }

            var conversation = await _context.ChatConversations.FindAsync(dto.ConversationId);
            if (conversation == null) return NotFound(new { message = "Không tìm thấy cuộc trò chuyện." });

            conversation.Rating = dto.Rating;
            conversation.RatingComment = dto.Comment?.Trim();
            conversation.RatedAt = DateTime.UtcNow;

            var staffName = conversation.AssignedStaffName ?? "Chuyên viên";
            var ratingMsg = new ChatMessage
            {
                ConversationId = conversation.ConversationId,
                SenderType = "Staff",
                SenderName = "Hệ Thống",
                MessageText = $"⭐ Khách hàng đã đánh giá dịch vụ {dto.Rating}/5 sao: \"{dto.Comment ?? "Rất hài lòng"}\". Cảm ơn Quý khách đã tin chọn Du Thuyền Việt!",
                SentAt = DateTime.UtcNow,
                IsRead = true
            };
            _context.ChatMessages.Add(ratingMsg);

            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã gửi đánh giá thành công!", rating = dto.Rating });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Đánh dấu đã đọc các tin nhắn
    /// </summary>
    [HttpPost("MarkAsRead/{conversationId}")]
    public async Task<IActionResult> MarkAsRead(int conversationId, [FromQuery] string viewerType = "Customer")
    {
        try
        {
            var conversation = await _context.ChatConversations.FindAsync(conversationId);
            if (conversation == null) return NotFound();

            if (viewerType == "Staff")
            {
                conversation.UnreadStaffCount = 0;
            }
            else
            {
                conversation.UnreadCustomerCount = 0;
            }

            var unreadMessages = await _context.ChatMessages
                .Where(m => m.ConversationId == conversationId && !m.IsRead && m.SenderType != viewerType)
                .ToListAsync();

            foreach (var msg in unreadMessages)
            {
                msg.IsRead = true;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Danh sách toàn bộ cuộc trò chuyện cho Quản trị viên & Nhân viên
    /// </summary>
    [HttpGet("Admin/Conversations")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> GetAdminConversations([FromQuery] string? status = null)
    {
        try
        {
            await CheckAutoResolveInactivityAsync();

            var query = _context.ChatConversations.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && status.ToLower() != "all")
            {
                query = query.Where(c => c.Status.ToLower() == status.ToLower());
            }

            var list = await query
                .OrderByDescending(c => c.LastMessageAt)
                .Select(c => new
                {
                    c.ConversationId,
                    c.SessionId,
                    c.CustomerName,
                    c.CustomerEmail,
                    c.Status,
                    c.AssignedStaffName,
                    c.Rating,
                    c.RatingComment,
                    c.RatedAt,
                    c.ResolvedAt,
                    c.ResolvedBy,
                    c.CreatedAt,
                    c.LastMessageAt,
                    c.LastStaffReplyAt,
                    c.LastMessageSnippet,
                    c.UnreadStaffCount,
                    // Tính số giây còn lại trước khi tự động giải quyết (5 phút = 300 giây)
                    autoResolveRemainingSeconds = (c.Status == "StaffReplied" && c.LastStaffReplyAt.HasValue)
                        ? Math.Max(0, 300 - (int)(DateTime.UtcNow - c.LastStaffReplyAt.Value).TotalSeconds)
                        : (int?)null
                })
                .ToListAsync();

            return Ok(list);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Nút đánh dấu giải quyết thành công cuộc trò chuyện (Staff/Admin)
    /// </summary>
    [HttpPut("Admin/Resolve/{conversationId}")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> ResolveConversation(int conversationId)
    {
        try
        {
            var conversation = await _context.ChatConversations.FindAsync(conversationId);
            if (conversation == null) return NotFound(new { message = "Không tìm thấy cuộc trò chuyện." });

            var resolver = User.Identity?.Name ?? conversation.AssignedStaffName ?? "Chuyên viên hỗ trợ";
            conversation.Status = "Resolved";
            conversation.ResolvedAt = DateTime.UtcNow;
            conversation.ResolvedBy = resolver;
            conversation.UnreadStaffCount = 0;

            // Thêm một tin nhắn thông báo giải quyết thành công
            var systemMsg = new ChatMessage
            {
                ConversationId = conversation.ConversationId,
                SenderType = "Staff",
                SenderName = "Hệ Thống",
                MessageText = $"✨ Phiên tư vấn đã được giải quyết thành công bởi Chuyên viên {resolver}. Quý khách vui lòng dành chút thời gian đánh giá chất lượng phục vụ bên dưới!",
                SentAt = DateTime.UtcNow,
                IsRead = true
            };
            _context.ChatMessages.Add(systemMsg);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã đánh dấu cuộc trò chuyện là Giải quyết thành công.",
                status = "Resolved",
                resolvedBy = resolver
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }
}
