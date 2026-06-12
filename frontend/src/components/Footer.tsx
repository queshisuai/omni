import { footerLinks } from '@/lib/site-links'

export function Footer() {
  return (
    <footer className="bg-white border-t border-[#e5e5e5] mt-10">
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        {/* Links */}
        <div className="flex flex-wrap gap-4 justify-center mb-6">
          {footerLinks.map((link) => (
            link.href ? (
              <a
                key={link.text}
                href={link.href}
                className="text-[12px] text-[#999] hover:text-[#ff1268] transition-colors"
              >
                {link.text}
              </a>
            ) : (
              <span key={link.text} className="text-[12px] text-[#999]">
                {link.text}
              </span>
            )
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-[#e5e5e5] pt-6 text-center">
          <div className="flex flex-wrap gap-2 justify-center text-[12px] text-[#999] mb-4">
            <span>京ICP证031057号</span>
            <span>|</span>
            <span>京ICP备11043884号</span>
            <span>|</span>
            <span>京公网安备11010502037341号</span>
          </div>

          <p className="text-[#111] mb-2">
            万象文化传媒发展有限公司 版权所有
          </p>
          <p className="text-[12px] text-[#999] mb-4">
            2003-2020 版权所有，保留所有权利
          </p>
          <p className="text-[12px] text-[#999]">
            热线电话：10103721
          </p>
        </div>
      </div>
    </footer>
  );
}
