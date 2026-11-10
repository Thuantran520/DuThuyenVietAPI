using System;
using System.Collections.Generic;

namespace DuThuyenVietAPI.Models;

public partial class ChatConversation
{
    public int ConversationId { get; set; }
    public string SessionId { get; set; } = null!;
    public string CustomerName { get; set; } = null!;
    public string? CustomerEmail { get; set; }
    public string Status { get; set; } = "Open"; // "Open", "StaffReplied", "Resolved"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastStaffReplyAt { get; set; }
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    public string? LastMessageSnippet { get; set; }
    public int UnreadStaffCount { get; set; } = 0;
    public int UnreadCustomerCount { get; set; } = 0;

    // Assigned staff consultant in charge
    public string? AssignedStaffId { get; set; }
    public string? AssignedStaffName { get; set; }

    // Customer Rating & Resolution info
    public int? Rating { get; set; } // 1 - 5 stars
    public string? RatingComment { get; set; }
    public DateTime? RatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolvedBy { get; set; }

    public virtual ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
