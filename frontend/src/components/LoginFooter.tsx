export function LoginFooter() {
  return (
    <footer style={{ backgroundColor: '#f8f8f8', height: 266 }}>
      <div style={{ width: 1200, margin: '0 auto', padding: '20px 0 0' }}>
        {/* Top links */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          {[
            { text: '帮助中心', href: 'https://help.damai.cn/' },
            { text: '公司介绍', href: 'https://help.damai.cn/helpPage.htm?pageId=69&categoryId=30' },
            { text: '品牌识别', href: 'https://help.damai.cn/helpPage.htm?pageId=70&categoryId=30' },
            { text: '公司大事记', href: 'https://help.damai.cn/helpPage.htm?pageId=72&categoryId=30' },
            { text: '协议及隐私权政策', href: 'https://help.damai.cn/helpPage.htm?pageId=40&categoryId=14' },
            { text: '廉正举报', href: '#' },
            { text: '联系合作', href: 'https://help.damai.cn/helpPage.htm?pageId=58&categoryId=5' },
            { text: '招聘信息', href: '#' },
            { text: '防骗秘籍', href: 'https://x.damai.cn/markets/special/fangzhapian' },
          ].map((link, i) => (
            <span key={link.text}>
              <a
                href={link.href}
                style={{ color: '#111', fontSize: 13, textDecoration: 'none' }}
              >
                {link.text}
              </a>
              {i < 8 && (
                <span style={{ color: '#d1d1d1', margin: '0 8px' }}>|</span>
              )}
            </span>
          ))}
        </div>

        {/* Download and service */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, margin: '12px 0 10px' }}>
          <a
            href="#"
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
            应用下载
          </a>
          <a
            href="https://ai.alimebot.taobao.com/intl/index.htm?from=EtbcRzNj3U"
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
            <a href="#" style={{ color: '#111', textDecoration: 'none' }}>
              万象网
            </a>
          </h3>
          <p style={{ margin: '0 0 8px' }}>客服热线：1010-XXXX</p>
          <p style={{ margin: 0 }}>举报投诉邮箱：omni_tousu@member.alibaba.com</p>
        </div>
      </div>
    </footer>
  )
}
