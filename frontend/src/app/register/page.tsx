import { LoginHeader } from '@/components/LoginHeader'
import { RegisterForm } from '@/components/RegisterForm'
import { LoginFooter } from '@/components/LoginFooter'

export default function RegisterPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f5]">
      <LoginHeader />
      <div 
        className="flex-1 relative flex items-center justify-center bg-[length:100%_100%] bg-center bg-no-repeat py-12"
        style={{ backgroundImage: "url('/background.png')" }}
      >
        <div className="absolute inset-0 bg-[#1E1346]/40" />

        <div className="relative w-full max-w-[1200px] mx-auto px-5 flex items-center justify-end">
          <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-right-10 duration-700">
            <RegisterForm />
          </div>
        </div>
      </div>
      <LoginFooter />
    </div>
  )
}
