using System;

namespace DuThuyenVietAPI.Models;

public class StoredImage
{
    public int Id { get; set; }
    public string FileName { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public byte[] Data { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
