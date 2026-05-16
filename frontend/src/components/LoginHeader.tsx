import Link from 'next/link'

export function LoginHeader() {
  return (
    <div style={{ height: 90 }}>
      <div style={{ width: 1200, margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center' }}>
        <Link href="/" className="flex items-center gap-3 decoration-transparent">
          <div className="w-[48px] h-[48px] flex items-center justify-center bg-transparent">
            <img
              src="/logo.svg"
              alt="万象"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-2xl font-bold text-[#ff1268] tracking-widest">万象</span>
          <span className="text-xl text-gray-500 font-medium ml-2 border-l-2 border-gray-300 pl-4">买票上万象</span>
        </Link>
      </div>
    </div>
  )
}
