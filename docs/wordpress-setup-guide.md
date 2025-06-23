# WordPress Integration Setup Guide

## Hướng dẫn thiết lập WordPress Application Password

### Bước 1: Kiểm tra WordPress Version

WordPress Application Passwords được hỗ trợ từ **WordPress 5.6+**. Kiểm tra version WordPress của bạn:

1. Đăng nhập WordPress Admin
2. Vào **Dashboard** → **Updates**
3. Đảm bảo WordPress version ≥ 5.6

### Bước 2: Tạo Application Password

#### Cách 1: Từ User Profile (Khuyến nghị)

1. **Đăng nhập WordPress Admin**
2. **Vào Users → Your Profile** (hoặc Users → All Users → Edit user)
3. **Scroll xuống phần "Application Passwords"**
4. **Nhập tên ứng dụng**: `AI Content Agent`
5. **Click "Add New Application Password"**
6. **Copy password được tạo** (dạng: `xxxx xxxx xxxx xxxx`)

#### Cách 2: Sử dụng Plugin (Nếu không thấy Application Passwords)

Nếu không thấy section "Application Passwords":

1. **Install plugin**: [Application Passwords](https://wordpress.org/plugins/application-passwords/)
2. **Activate plugin**
3. **Làm theo Cách 1**

### Bước 3: Kiểm tra REST API

Kiểm tra WordPress REST API có hoạt động:

```bash
# Test REST API availability
curl https://your-site.com/wp-json/wp/v2

# Should return JSON with site info
```

### Bước 4: Test Authentication

```bash
# Test authentication với Application Password
curl -u "username:xxxx xxxx xxxx xxxx" https://your-site.com/wp-json/wp/v2/users/me

# Should return user info if successful
```

### Bước 5: Cấu hình trong AI Content Agent

1. **Site URL**: `https://your-site.com` (không có trailing slash)
2. **Username**: WordPress username (thường là admin)
3. **Application Password**: Password vừa tạo (giữ nguyên spaces)

### Troubleshooting

#### Lỗi "Authentication failed"

**Nguyên nhân có thể**:

- Application Password chưa được tạo
- Username không đúng
- Password bị copy sai (thiếu spaces)
- WordPress version < 5.6

**Giải pháp**:

1. Kiểm tra lại username trong WordPress Admin
2. Tạo lại Application Password
3. Copy chính xác password (bao gồm spaces)
4. Đảm bảo Site URL đúng format

#### Lỗi "REST API not found"

**Nguyên nhân**:

- WordPress REST API bị disable
- Plugin security block REST API
- Server configuration issue

**Giải pháp**:

1. Check plugin security (Wordfence, etc.)
2. Add to wp-config.php: `add_filter('rest_enabled', '__return_true');`
3. Contact hosting provider

#### Lỗi "Access forbidden"

**Nguyên nhân**:

- User không có quyền publish posts
- Plugin security restrictions

**Giải pháp**:

1. Đảm bảo user có role Administrator hoặc Editor
2. Check plugin security settings
3. Add user capabilities nếu cần

### Security Best Practices

1. **Sử dụng unique application name** cho mỗi integration
2. **Revoke unused Application Passwords** thường xuyên
3. **Monitor WordPress login logs** để detect unauthorized access
4. **Use strong WordPress passwords** cho main account
5. **Enable 2FA** cho WordPress admin account

### Example Configuration

```json
{
  "siteUrl": "https://myblog.com",
  "username": "admin",
  "applicationPassword": "1234 5678 9012 3456"
}
```

### Testing Commands

```bash
# Test site accessibility
curl -I https://your-site.com

# Test REST API
curl https://your-site.com/wp-json/wp/v2

# Test authentication
curl -u "username:password" https://your-site.com/wp-json/wp/v2/users/me

# Test post creation (dry run)
curl -X POST -u "username:password" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Post","content":"Test content","status":"draft"}' \
  https://your-site.com/wp-json/wp/v2/posts
```

---

**Lưu ý**: Application Password khác với WordPress login password. Đây là password riêng biệt được tạo cho API access.
