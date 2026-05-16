import { LoginHeader } from '@/components/LoginHeader'
import { LoginForm } from '@/components/LoginForm'
import { LoginFooter } from '@/components/LoginFooter'

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f5]">
      <LoginHeader />
      <div 
        className="flex-1 relative flex items-center justify-center bg-[length:100%_100%] bg-center bg-no-repeat py-12"
        style={{ backgroundImage: "url('/background.png')" }}
      >
        <div className="absolute inset-0 bg-[#1E1346]/40" /> {/* Subtle darkening overlay for readability */}

        <div className="relative w-full max-w-[1200px] mx-auto px-5 flex items-center justify-end">
          {/* 右侧登录表单 */}
          <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-right-10 duration-700">
            <LoginForm />
          </div>
        </div>
      </div>
      <LoginFooter />
    </div>
  )
}
