import { Smartphone } from "lucide-react";
import { footerLinks } from "@/lib/mock-data";

export function Footer() {
  const links = footerLinks.map((link) =>
    link.text === '商户入驻' ? { ...link, href: '/merchant' } : link
  )

  return (
    <footer className="bg-white border-t border-[#e5e5e5] mt-10">
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        {/* Links */}
        <div className="flex flex-wrap gap-4 justify-center mb-6">
          {links.map((link) => (
            <a
              key={link.text}
              href={link.href}
              className="text-[12px] text-[#999] hover:text-[#ff1268] transition-colors"
            >
              {link.text}
            </a>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-[#e5e5e5] pt-6 text-center">
          <div className="flex flex-wrap gap-2 justify-center text-[12px] text-[#999] mb-4">
            <a href="#" className="hover:text-[#ff1268]">京ICP证031057号</a>
            <span>|</span>
            <a href="#" className="hover:text-[#ff1268]">京ICP备11043884号</a>
            <span>|</span>
            <a href="#" className="hover:text-[#ff1268]">京公网安备11010502037341号</a>
          </div>

          <p className="text-[#111] mb-2 hover:text-[#ff1268] cursor-pointer">
            万象文化传媒发展有限公司 版权所有
          </p>
          <p className="text-[12px] text-[#999] mb-4">
            2003-2020 版权所有，保留所有权利
          </p>
          <p className="text-[12px] text-[#999]">
            热线电话：10103721
          </p>
        </div>

        {/* App Download CTA */}
        <div className="fixed right-5 bottom-10 flex flex-col items-center gap-2">
          <a
            href="#"
            className="bg-[#ff1268] text-white p-3 rounded-full shadow-lg hover:bg-[#e01058] transition-colors"
          >
            <Smartphone className="w-5 h-5" />
          </a>
          <span className="text-[12px] text-[#ff1268]">应用下载</span>
        </div>
      </div>
    </footer>
  );
}
