using System;

namespace DuThuyenVietAPI.Models;

public partial class ChatMessage
{
    public int MessageId { get; set; }
    public int ConversationId { get; set; }
    public string SenderType { get; set; } = string.Empty; // "Customer", "Staff"
    public string SenderName { get; set; } = string.Empty;
    public string MessageText { get; set; } = string.Empty;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; } = false;

    public virtual ChatConversation? Conversation { get; set; }
}

