"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, MapPin, ChevronDown, User, Menu } from "lucide-react";
import { getUser, isAuthenticated, logout } from "@/lib/auth";
import { CITY_KEY, filterCityOptions, formatCityDisplay, resolveRouteCity, resolveStoredCity, ALL_CITY_VALUE } from "@/lib/city-selection";
import { canEnterConsole, getDefaultConsolePath } from "@/lib/console-auth";
import { NotificationBell } from "@/components/NotificationBell";
import type { UserRole } from "@/types/api";

export const HOT_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉', '天津', '沈阳', '西安', '苏州'];
export const OTHER_CITIES = Array.from(new Set([
  '阿坝', '阿克苏', '阿拉善', '安康', '安庆', '鞍山', '安顺', '安阳', '澳门', '巴中', '白城', '百色', '白山', '保定', '宝鸡', '保山', '包头', '北海', '本溪', '蚌埠', '毕节', '滨州', '博尔塔拉', '亳州', '沧州', '长春', '常德', '昌吉', '长沙', '长治', '常州', '朝阳', '潮州', '郴州', '承德', '赤峰', '池州', '重庆', '崇左', '楚雄', '滁州', '大理', '大连', '大庆', '大同', '大兴安岭', '达州', '丹东', '儋州', '德宏', '德阳', '德州', '迪庆', '定西', '东方', '东莞', '东营', '鄂尔多斯', '鄂州', '恩施', '佛山', '抚顺', '阜新', '阜阳', '福州', '抚州', '甘南', '赣州', '甘孜', '高雄', '固原', '广安', '广元', '广州', '贵港', '桂林', '贵阳', '哈尔滨', '哈密', '海北', '海口', '海南州', '海外', '海西', '邯郸', '汉中', '杭州', '鹤壁', '河池', '合肥', '和田', '河源', '菏泽', '贺州', '黑河', '衡水', '衡阳', '红河', '呼和浩特', '葫芦岛', '呼伦贝尔', '湖州', '淮安', '怀化', '淮南', '黄冈', '黄山', '黄石', '惠州', '吉安', '吉林', '济南', '济宁', '鸡西', '佳木斯', '嘉兴', '嘉峪关', '江门', '焦作', '揭阳', '晋城', '金华', '晋中', '锦州', '景德镇', '荆门', '荆州', '金昌', '九江', '酒泉', '喀什', '开封', '克拉玛依', '昆明', '兰州', '廊坊', '拉萨', '乐山', '凉山', '连云港', '聊城', '辽阳', '辽源', '丽江', '临沧', '临汾', '临夏', '临沂', '林芝', '丽水', '六盘水', '柳州', '六安', '陇南', '龙岩', '娄底', '六安', '漯河', '洛阳', '泸州', '吕梁', '马鞍山', '茂名', '眉山', '梅州', '绵阳', '牡丹江', '南昌', '南充', '南京', '南宁', '南平', '南通', '南阳', '内江', '宁波', '宁德', '怒江', '盘锦', '攀枝花', '平顶山', '平凉', '萍乡', '莆田', '濮阳', '齐齐哈尔', '黔东南', '潜江', '黔南', '黔西南', '钦州', '秦皇岛', '青岛', '庆阳', '清远', '泉州', '曲靖', '衢州', '日喀则', '日照', '三门峡', '三明', '三亚', '商洛', '商丘', '上饶', '山南', '汕头', '汕尾', '韶关', '绍兴', '邵阳', '神农架', '沈阳', '深圳', '十堰', '石家庄', '石嘴山', '双鸭山', '朔州', '四平', '松原', '绥化', '随州', '遂宁', '苏州', '宿迁', '宿州', '塔城', '泰安', '台北', '太原', '台州', '泰州', '唐山', '天津', '天门', '天水', '铁岭', '铜川', '通化', '通辽', '铜陵', '铜仁', '吐鲁番', '威海', '潍坊', '渭南', '文山', '温州', '乌海', '乌兰察布', '乌鲁木齐', '无锡', '吴忠', '梧州', '芜湖', '武威', '武汉', '西安', '项城', '香港', '湘潭', '湘西', '襄阳', '咸宁', '咸阳', '孝感', '锡林郭勒', '兴安', '邢台', '西宁', '新乡', '信阳', '新余', '忻州', '西双版纳', '宣城', '许昌', '徐州', '雅安', '延安', '延边', '盐城', '阳江', '阳泉', '扬州', '烟台', '宜宾', '宜昌', '伊春', '宜春', '伊犁', '银川', '营口', '鹰潭', '益阳', '永州', '岳阳', '榆林', '玉林', '运城', '云浮', '玉树', '玉溪', '枣庄', '张家界', '张家口', '张掖', '漳州', '湛江', '肇庆', '昭通', '郑州', '镇江', '中山', '中卫', '周口', '舟山', '珠海', '驻马店', '株洲', '淄博', '自贡', '资阳', '遵义'
]));

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [currentCity, setCurrentCity] = useState(ALL_CITY_VALUE);
  const [citySearch, setCitySearch] = useState("");
  const citySelectorRef = useRef<HTMLDivElement>(null);
  const cityOptions = citySearch ? filterCityOptions(citySearch, HOT_CITIES, OTHER_CITIES) : OTHER_CITIES;
  const displayedCity = formatCityDisplay(currentCity);

  const handleSearch = () => {
    const keyword = searchText.trim()
    const params = new URLSearchParams()
    if (keyword) params.set('keyword', keyword)
    if (currentCity && currentCity !== ALL_CITY_VALUE) params.set('city', currentCity)
    const qs = params.toString()
    router.push(`/search${qs ? `?${qs}` : ''}`)
  }

  const selectCity = (city: string) => {
    setCurrentCity(city)
    setShowCityDropdown(false)
    setCitySearch('')
    if (typeof window !== 'undefined') {
      if (city === ALL_CITY_VALUE) {
        localStorage.removeItem(CITY_KEY)
      } else {
        localStorage.setItem(CITY_KEY, city)
      }
      window.dispatchEvent(new CustomEvent('omni-city-updated', { detail: city }))
    }
    if (pathname.startsWith('/search')) {
      const params = new URLSearchParams(window.location.search)
      if (city === ALL_CITY_VALUE) params.delete('city')
      else params.set('city', city)
      const qs = params.toString()
      router.replace(`/search${qs ? `?${qs}` : ''}`)
    }
  }

  useEffect(() => {
    const checkAuth = () => {
      const auth = isAuthenticated()
      setLoggedIn(auth)
      if (auth) {
        const user = getUser()
        setNickname(user?.nickname || user?.phone || "")
        setAvatar(user?.avatar || null)
        setRole(user?.role || null)
        setPermissionCodes(user?.permissionCodes || [])
      } else {
        setNickname("")
        setAvatar(null)
        setRole(null)
        setPermissionCodes([])
      }
    }
    const handleCityUpdate = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (detail) setCurrentCity(detail)
    }
    const routeCity = pathname.startsWith('/search') ? new URLSearchParams(window.location.search).get('city') : null
    const storedCity = pathname.startsWith('/search') ? null : resolveStoredCity(localStorage.getItem(CITY_KEY))
    setCurrentCity(resolveRouteCity(pathname, routeCity, storedCity))
    checkAuth()
    // 监听路由变化重新检查
    window.addEventListener("focus", checkAuth)
    window.addEventListener('damai-user-updated', checkAuth)
    window.addEventListener('omni-city-updated', handleCityUpdate)
    return () => {
      window.removeEventListener("focus", checkAuth)
      window.removeEventListener('damai-user-updated', checkAuth)
      window.removeEventListener('omni-city-updated', handleCityUpdate)
    }
  }, [pathname])

  useEffect(() => {
    if (!showCityDropdown) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!citySelectorRef.current?.contains(event.target as Node)) {
        setShowCityDropdown(false)
        setCitySearch('')
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCityDropdown(false)
        setCitySearch('')
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showCityDropdown])

  const handleLogout = () => {
    setShowUserDropdown(false)
    logout()
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)]">
      <div className="max-w-[1200px] mx-auto flex items-center h-[72px] px-5 gap-6">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 flex items-center gap-2">
          <div className="h-[40px] w-[40px] flex items-center justify-center bg-transparent">
            <img
              src="/logo.svg"
              alt="万象"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="text-xl font-bold text-[#ff1268] tracking-wider">万象</span>
        </Link>

        {/* City Selector */}
        <div ref={citySelectorRef} className="relative flex-shrink-0 h-full flex items-center">
          <button
            type="button"
            aria-expanded={showCityDropdown}
            onClick={() => setShowCityDropdown(open => !open)}
            className="flex items-center gap-1 text-sm text-[#111] hover:text-[#ff1268] h-full transition-colors duration-200"
          >
            <MapPin className="w-4 h-4 text-[#ff1268]" />
            <span className="font-medium">{displayedCity}</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showCityDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showCityDropdown && (
            <div className="absolute left-0 top-full mt-3 w-[420px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_20px_60px_-18px_rgba(15,23,42,0.35)] z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Search */}
              <div className="relative mb-5">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="搜索城市..."
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  className="w-full bg-gray-50 border border-transparent rounded-full py-2 pl-9 pr-4 text-sm outline-none focus:bg-white focus:border-[#ff1268]/30 focus:ring-4 focus:ring-[#ff1268]/10 transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Current City */}
              <div className="mb-5 flex items-center gap-3">
                <span className="text-xs text-gray-400 font-medium tracking-wider">当前</span>
                <button className="flex items-center justify-center bg-[#ff1268] text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-sm shadow-[#ff1268]/20">
                  <MapPin className="w-3 h-3 mr-1" />
                  {displayedCity}
                </button>
              </div>

              {/* Hot Cities */}
              {!citySearch && (
                <div className="mb-5">
                  <span className="block text-xs text-gray-400 font-medium tracking-wider mb-3">热门</span>
                  <div className="grid grid-cols-4 gap-2">
                    {HOT_CITIES.map(city => (
                      <button 
                        key={city} 
                        onClick={() => selectCity(city)}
                        className="text-xs text-gray-700 bg-gray-50/80 hover:bg-[#fff4f8] hover:text-[#ff1268] py-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All / Filtered Cities */}
              <div className="flex flex-col">
                <span className="block text-xs text-gray-400 font-medium tracking-wider mb-3">
                  {citySearch ? '搜索结果' : '全部'}
                </span>
                <div className="grid max-h-[240px] grid-cols-5 gap-x-1 gap-y-2 overflow-y-auto pr-2 custom-scrollbar">
                  {cityOptions.map((city, index) => (
                    <button 
                      key={`${city}-${index}`} 
                      onClick={() => selectCity(city)}
                      className="text-[13px] text-gray-600 hover:text-[#ff1268] hover:bg-gray-50 py-1.5 rounded-lg transition-colors text-center truncate"
                    >
                      {city}
                    </button>
                  ))}
                  {cityOptions.length === 0 && (
                    <div className="col-span-5 text-center text-xs text-gray-400 py-6">
                      未能找到匹配的城市
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex items-center gap-6 ml-2">
          <Link
            href="/"
            className={`text-[16px] font-medium transition-colors ${
              pathname === '/' ? 'text-[#ff1268]' : 'text-[#111] hover:text-[#ff1268]'
            }`}
          >
            首页
          </Link>
          <Link
            href="/search"
            className={`text-[16px] font-medium transition-colors ${
              pathname.startsWith('/search') ? 'text-[#ff1268]' : 'text-[#111] hover:text-[#ff1268]'
            }`}
          >
            分类
          </Link>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="flex items-center bg-[#f5f5f5] rounded-full px-4 py-2 w-[260px]">
          <Search className="w-4 h-4 text-[#999] cursor-pointer" onClick={handleSearch} />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            placeholder="搜索明星、演出、体育赛事"
            className="bg-transparent border-none outline-none text-sm text-[#111] ml-2 w-full placeholder:text-[#999]"
          />
        </div>

        {loggedIn && <NotificationBell />}

        {/* User / Login */}
        <div className="relative flex-shrink-0 h-full flex items-center" onMouseLeave={() => setShowUserDropdown(false)}>
          {loggedIn ? (
            <button
              onMouseEnter={() => setShowUserDropdown(true)}
              onClick={() => router.push("/orders")}
              className="flex items-center gap-1 text-sm text-[#111] hover:text-[#ff1268] bg-transparent border-none cursor-pointer outline-none h-full"
            >
              {avatar ? (
                <img src={avatar} alt={nickname || '用户头像'} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
              <span className="max-w-[80px] truncate">{nickname}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          ) : (
            <button
              onMouseEnter={() => setShowUserDropdown(true)}
              onClick={() => router.push("/login?ru=/")}
              className="flex items-center gap-1 text-sm text-[#111] hover:text-[#ff1268] flex-shrink-0 bg-transparent border-none cursor-pointer outline-none h-full"
            >
              <User className="w-5 h-5" />
              <span>登录</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          )}

          {showUserDropdown && (
            <div
              className="absolute right-0 top-[60px] z-50 min-w-[140px] rounded-2xl border border-gray-100 bg-white/95 backdrop-blur-xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.1)] py-2 text-center overflow-hidden"
            >
              {!loggedIn && (
                <>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/login?ru=/") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    登录
                  </button>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/register") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    注册
                  </button>
                </>
              )}
              {loggedIn && (
                <>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/profile") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    个人信息
                  </button>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/profile/account") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    账号设置
                  </button>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/profile/attendees") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    实名观演人
                  </button>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/tickets") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    我的票夹
                  </button>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/subscriptions") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    想看与提醒
                  </button>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/history") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    浏览记录
                  </button>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/orders") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    订单管理
                  </button>
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push("/waitlist") }}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                  >
                    我的候补
                  </button>
                  {canEnterConsole(role, permissionCodes) && (
                    <button
                      onClick={() => { setShowUserDropdown(false); router.push(getDefaultConsolePath(role, permissionCodes)) }}
                      className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-[#fff4f8] hover:text-[#ff1268] border-none bg-transparent outline-none transition-colors"
                    >
                      进入后台
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="block w-full px-5 py-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 hover:text-red-500 border-none bg-transparent outline-none border-t border-gray-50 transition-colors mt-1 pt-3"
                  >
                    退出登录
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Mobile Menu */}
        <button className="lg:hidden">
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
