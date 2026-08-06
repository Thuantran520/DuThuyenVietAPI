const token = localStorage.getItem('auth_token');
if (token) {
    const jwtData = JSON.parse(atob(token.split('.')[1]));
    console.log("JWT Claims:", jwtData);
}
