export function LoginFooter() {
  const topLinks: Array<{ text: string; href?: string }> = [
    { text: '帮助中心', href: '/help' },
    { text: '公司介绍' },
    { text: '品牌识别' },
    { text: '公司大事记' },
    { text: '协议及隐私权政策' },
    { text: '廉正举报' },
    { text: '联系合作', href: '/merchant' },
    { text: '招聘信息' },
    { text: '防骗秘籍' },
  ]

  return (
    <footer style={{ backgroundColor: '#f8f8f8', height: 266 }}>
      <div style={{ width: 1200, margin: '0 auto', padding: '20px 0 0' }}>
        {/* Top links */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          {topLinks.map((link, i) => (
            <span key={link.text}>
              {link.href ? (
                <a
                  href={link.href}
                  style={{ color: '#111', fontSize: 13, textDecoration: 'none' }}
                >
                  {link.text}
                </a>
              ) : (
                <span style={{ color: '#111', fontSize: 13 }}>{link.text}</span>
              )}
              {i < 8 && (
                <span style={{ color: '#d1d1d1', margin: '0 8px' }}>|</span>
              )}
            </span>
          ))}
        </div>

        {/* Download and service */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, margin: '12px 0 10px' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '6px 32px',
              backgroundColor: '#d1d5db',
              color: '#fff',
              fontSize: 14,
              borderRadius: 3,
            }}
          >
            应用下载
          </span>
          <a
            href="/help"
            style={{
              display: 'inline-block',
              padding: '6px 32px',
              backgroundColor: '#ff1268',
              color: '#fff',
              fontSize: 14,
              borderRadius: 3,
              textDecoration: 'none',
            }}
          >
            在线客服
          </a>
        </div>

        {/* Copyright */}
        <div style={{ textAlign: 'center', fontSize: 12, color: '#999', lineHeight: '22px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>
            <span style={{ color: '#111' }}>
              万象网
            </span>
          </h3>
          <p style={{ margin: '0 0 8px' }}>客服热线：1010-XXXX</p>
          <p style={{ margin: 0 }}>举报投诉：请通过在线客服提交</p>
        </div>
      </div>
    </footer>
  )
}
