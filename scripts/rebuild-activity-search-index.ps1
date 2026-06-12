param(
    [string]$Gateway = "http://localhost:8088",
    [string]$Token
)

if (-not $Token) {
    throw "请传入后台登录 token：-Token <token>"
}

Invoke-RestMethod -Method Post `
    -Uri "$Gateway/api/ticket/admin/search-index/rebuild" `
    -Headers @{ Authorization = "Bearer $Token" }
