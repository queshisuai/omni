export const CITY_KEY = 'omni_current_city'
export const ALL_CITY_VALUE = '全部'
export const ALL_CITY_DISPLAY = '全国'

export function resolveInitialCity(cityParam: string | null | undefined) {
  const city = cityParam?.trim()
  return city || ALL_CITY_VALUE
}

export function resolveStoredCity(raw: string | null | undefined) {
  const city = raw?.trim()
  return city || ''
}

export function resolveRouteCity(pathname: string, cityParam: string | null | undefined, storedCity: string | null | undefined) {
  if (pathname.startsWith('/search')) {
    return resolveInitialCity(cityParam)
  }
  if (pathname === '/') {
    return ALL_CITY_VALUE
  }
  return resolveStoredCity(storedCity) || ALL_CITY_VALUE
}

export function resolveActivityCityParam(city: string | null | undefined) {
  const normalized = city?.trim()
  if (!normalized || normalized === ALL_CITY_VALUE) return undefined
  return normalized
}

export function formatCityDisplay(city: string | null | undefined) {
  const normalized = city?.trim()
  if (!normalized || normalized === ALL_CITY_VALUE) return ALL_CITY_DISPLAY
  return normalized
}

export function filterCityOptions(keyword: string, hotCities: string[], otherCities: string[]) {
  const query = keyword.trim()
  const source = [...hotCities, ...otherCities]
  return source
    .filter((city, index) => source.indexOf(city) === index)
    .filter(city => !query || city.includes(query))
}
