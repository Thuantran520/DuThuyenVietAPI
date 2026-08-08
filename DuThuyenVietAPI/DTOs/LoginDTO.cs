namespace DuThuyenVietAPI.DTOs;

public class LoginDTO
{
    public string UsernameOrEmail { get; set; }
    public string Password { get; set; }
    public bool LoginAsAdmin { get; set; }
}
