'use client'

import { useRef, useState } from 'react'
import { ArrowRight, Check, CircleAlert, LoaderCircle, Search, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { interpretAiTicketFinder, searchAiTicketFinder } from '@/lib/api'
import {
  AI_TICKET_FINDER_QUICK_EXAMPLES,
  buildFinderPurchaseHref,
  formatFinderConditions,
  getFinderErrorMessage,
} from '@/lib/ai-ticket-finder'
import { isAuthenticated } from '@/lib/auth'
import type { FinderClarification, TicketFinderResult, TicketIntent } from '@/types/api'

const EXAMPLE_QUERY = '例如：帮我找广州的天鹅湖演出，预算700元以内'

function formatSessionTime(value: string | null | undefined) {
  return value ? value.replace('T', ' ').slice(0, 16) : '场次时间待同步'
}

function formatPrice(value: number | null | undefined) {
  return value == null ? '价格待同步' : `¥${Number(value).toFixed(2).replace(/\.00$/, '')}`
}

function formatSaleStatus(value: string | null | undefined) {
  if (value === 'on_sale') return '售票中'
  if (value === 'coming_soon') return '待开票'
  if (value === 'sold_out') return '已售罄'
  return '销售状态待确认'
}

function saleStatusClass(value: string | null | undefined) {
  if (value === 'on_sale') return 'bg-[#ecfdf3] text-[#16803c]'
  if (value === 'sold_out') return 'bg-[#fef2f2] text-[#c24141]'
  return 'bg-[#fff8e8] text-[#a16207]'
}

function ResultCard({ result, onPurchase }: { result: TicketFinderResult; onPurchase: (result: TicketFinderResult) => void }) {
  return (
    <article className="border-b border-[#f0f1f3] py-6 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-[18px] font-semibold text-[#17191d]">{result.activityName}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#737780]">
            <span>{result.venueName || '场馆待同步'}</span>
            <span className="text-[#d4d6da]">·</span>
            <span>{result.city || '城市待同步'}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[#555a63]">
            <span>{formatSessionTime(result.sessionStartTime)}</span>
            <span className="text-[#d4d6da]">·</span>
            <span>{result.ticketTypeName || '票档待同步'}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-[20px] font-bold text-[#ff1268]">{formatPrice(result.price)}</span>
            <span className="text-[13px] text-[#737780]">余票 {result.availableQuantity ?? '暂未同步'}</span>
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${saleStatusClass(result.saleStatus)}`}>
              {formatSaleStatus(result.saleStatus)}
            </span>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => onPurchase(result)}
          className="h-10 w-full bg-[#ff1268] px-5 text-white hover:bg-[#e50f5d] lg:w-auto"
        >
          去购票
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </article>
  )
}

export default function TicketFinderPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [query, setQuery] = useState('')
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [intent, setIntent] = useState<TicketIntent | null>(null)
  const [clarification, setClarification] = useState<FinderClarification | null>(null)
  const [results, setResults] = useState<TicketFinderResult[]>([])
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState('')
  const [interpreting, setInterpreting] = useState(false)
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const busy = interpreting || searching

  const interpretQuery = async (nextQuery: string) => {
    if (busy) return
    if (!isAuthenticated()) {
      setError('请先登录后使用 AI 智能找票')
      return
    }
    setInterpreting(true)
    setError('')
    setIntent(null)
    setClarification(null)
    setResults([])
    setExplanation('')
    setHasSearched(false)
    try {
      const response = await interpretAiTicketFinder(nextQuery)
      const nextClarification = response.clarification?.required ? response.clarification : null
      setIntent(response.parsedIntent)
      setClarification(nextClarification)
    } catch (requestError) {
      setError(getFinderErrorMessage(requestError))
    } finally {
      setInterpreting(false)
    }
  }

  const handleInterpret = () => {
    const normalized = query.trim()
    if (!normalized) {
      setError('请先告诉我你想看的演出或场次')
      inputRef.current?.focus()
      return
    }
    void interpretQuery(normalized)
  }

  const handleClarification = () => {
    const answer = clarificationAnswer.trim()
    if (!answer) {
      setError('请补充确认条件后再继续')
      return
    }
    const nextQuery = `${query.trim()}；补充条件：${answer}`
    setQuery(nextQuery)
    setClarificationAnswer('')
    void interpretQuery(nextQuery)
  }

  const handleSearch = async () => {
    const normalized = query.trim()
    if (!normalized || !intent || clarification?.required || busy) return
    if (!isAuthenticated()) {
      setError('请先登录后使用 AI 智能找票')
      return
    }
    setSearching(true)
    setError('')
    setHasSearched(true)
    try {
      const response = await searchAiTicketFinder(normalized)
      setResults(response.results || [])
      setExplanation(response.explanation || '')
      if (response.parsedIntent) setIntent(response.parsedIntent)
    } catch (requestError) {
      setResults([])
      setExplanation('')
      setError(getFinderErrorMessage(requestError))
    } finally {
      setSearching(false)
    }
  }

  const handleAdjust = () => {
    setHasSearched(false)
    setIntent(null)
    setClarification(null)
    setClarificationAnswer('')
    setResults([])
    setExplanation('')
    setError('')
    inputRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleAdjustWithHint = (hint: string) => {
    setQuery(current => `${current.trim()}；${hint}`.replace(/^；/, ''))
    handleAdjust()
  }

  const handlePurchase = (result: TicketFinderResult) => {
    router.push(buildFinderPurchaseHref(result))
  }

  const conditions = formatFinderConditions(intent)
  const showLoginAction = error === '请先登录后使用 AI 智能找票'

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#17191d]">
      <Header />
      <main className="mx-auto w-full max-w-[1040px] px-5 py-10 md:py-14">
        <section className="rounded-[28px] border border-[#eceef1] bg-white px-6 py-8 shadow-[0_16px_50px_rgba(22,27,38,0.06)] md:px-10 md:py-11">
          <div className="max-w-[720px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#fff0f5] px-3 py-1.5 text-[12px] font-semibold text-[#e6005c]">
              <Sparkles className="h-3.5 w-3.5" />
              AI 智能找票
            </div>
            <h1 className="text-[30px] font-bold tracking-tight text-[#17191d] md:text-[38px]">告诉我你想看什么，我帮你筛选真实可购场次</h1>
            <p className="mt-3 text-[14px] leading-6 text-[#737780]">用一句话描述演出、城市、时间、人数或预算，不需要填写复杂筛选项。</p>
          </div>

          <div className="mt-8">
            <label htmlFor="ticket-finder-query" className="sr-only">描述你的找票需求</label>
            <div className="rounded-2xl border border-[#e3e5e8] bg-[#fbfcfd] p-3 transition-colors focus-within:border-[#ff1268] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#ff1268]/10">
              <textarea
                id="ticket-finder-query"
                ref={inputRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleInterpret()
                  }
                }}
                rows={3}
                maxLength={500}
                placeholder={EXAMPLE_QUERY}
                className="min-h-[84px] w-full resize-none bg-transparent px-2 py-1 text-[16px] leading-7 text-[#17191d] outline-none placeholder:text-[#a4a8b0]"
              />
              <div className="flex flex-col gap-3 border-t border-[#eef0f2] px-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[12px] text-[#a0a4ab]">按 Enter 提交，Shift + Enter 换行</span>
                <Button
                  type="button"
                  onClick={handleInterpret}
                  disabled={busy}
                  className="h-10 w-full bg-[#ff1268] px-5 text-white hover:bg-[#e50f5d] sm:w-auto"
                >
                  {interpreting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {interpreting ? '正在理解你的需求……' : '开始找票'}
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 text-[12px] font-medium text-[#8a8e97]">快捷示例</div>
              <div className="flex flex-wrap gap-2">
                {AI_TICKET_FINDER_QUICK_EXAMPLES.map(example => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setQuery(example)}
                    className="max-w-full truncate rounded-full border border-[#eceef1] bg-white px-3 py-1.5 text-left text-[12px] text-[#646872] transition-colors hover:border-[#ff1268] hover:bg-[#fff7fa] hover:text-[#e6005c]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#ffd8df] bg-[#fff7f8] px-4 py-3 text-[13px] text-[#c24155] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              {showLoginAction && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/login?ru=/ai/ticket-finder')}
                  className="h-9 border-[#ff1268] text-[#e6005c] hover:bg-[#fff0f5]"
                >
                  去登录
                </Button>
              )}
            </div>
          )}

          {clarification?.required && (
            <section className="mt-7 rounded-2xl border border-[#f2e4b7] bg-[#fffdf5] p-5">
              <div className="flex items-center gap-2 text-[16px] font-semibold text-[#6b5312]">
                <CircleAlert className="h-4 w-4" />
                还需要确认一下
              </div>
              <ul className="mt-3 space-y-2 text-[13px] leading-6 text-[#806d32]">
                {clarification.questions.map((question, index) => (
                  <li key={`${question}-${index}`} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d5a72b]" />
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={clarificationAnswer}
                  onChange={event => setClarificationAnswer(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') handleClarification()
                  }}
                  placeholder="补充你的确认条件"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[#eadfae] bg-white px-3 text-[13px] text-[#555] outline-none focus:border-[#d5a72b] focus:ring-2 focus:ring-[#d5a72b]/10"
                />
                <Button
                  type="button"
                  onClick={handleClarification}
                  disabled={busy}
                  className="h-10 bg-[#b78300] px-5 text-white hover:bg-[#986d00]"
                >
                  {interpreting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  重新解析
                </Button>
              </div>
            </section>
          )}

          {intent && !clarification?.required && (
            <section className="mt-7 border-t border-[#f0f1f3] pt-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[17px] font-semibold text-[#17191d]">你的找票条件</h2>
                  <p className="mt-1 text-[12px] text-[#9a9ea6]">以下条件来自后端解析，未提供的条件不会补充展示。</p>
                </div>
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={busy}
                  className="h-10 w-full bg-[#17191d] px-5 text-white hover:bg-[#30343a] sm:w-auto"
                >
                  {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {searching ? '正在为你查找可售票……' : '查找符合条件的票'}
                </Button>
              </div>
              {conditions.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {conditions.map(condition => (
                    <div key={condition.label} className="rounded-xl bg-[#f7f8fa] px-4 py-3">
                      <div className="text-[12px] text-[#9a9ea6]">{condition.label}</div>
                      <div className="mt-1 truncate text-[14px] font-medium text-[#373b42]" title={condition.value}>{condition.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-xl bg-[#f7f8fa] px-4 py-3 text-[13px] text-[#737780]">暂未解析出可展示的具体条件，请补充描述后重新尝试。</div>
              )}
            </section>
          )}
        </section>

        {hasSearched && (
          <section className="mt-6 rounded-[28px] border border-[#eceef1] bg-white px-6 py-8 shadow-[0_16px_50px_rgba(22,27,38,0.04)] md:px-10">
            <div className="flex flex-col gap-2 border-b border-[#f0f1f3] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[21px] font-semibold text-[#17191d]">AI 筛选结果</h2>
                <p className="mt-1 text-[13px] text-[#8a8e97]">{results.length > 0 ? `找到 ${results.length} 个符合条件的场次` : '没有符合全部条件的场次'}</p>
              </div>
              {searching && <LoaderCircle className="h-5 w-5 animate-spin text-[#ff1268]" />}
            </div>

            {searching ? (
              <div className="flex flex-col items-center justify-center py-20 text-[13px] text-[#8a8e97]">
                <LoaderCircle className="mb-3 h-7 w-7 animate-spin text-[#ff1268]" />
                正在为你查找可售票……
              </div>
            ) : results.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-[16px] font-medium text-[#373b42]">暂时没有找到符合条件的可售票</div>
                <div className="mt-2 text-[13px] text-[#9a9ea6]">可以调整预算、城市或日期，再重新找票。</div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAdjust}
                  className="mt-6 border-[#ff1268] text-[#e6005c] hover:bg-[#fff0f5]"
                >
                  重新找票
                </Button>
                <div className="mx-auto mt-7 max-w-[680px] border-t border-[#f0f1f3] pt-5 text-left">
                  <div className="mb-3 text-[12px] font-medium text-[#9a9ea6]">可以尝试</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '降低预算要求', hint: '预算可以再灵活一些' },
                      { label: '更换城市', hint: '也可以看看其他城市' },
                      { label: '放宽日期', hint: '日期可以适当放宽' },
                    ].map(option => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => handleAdjustWithHint(option.hint)}
                        className="rounded-full border border-[#eceef1] bg-white px-3 py-1.5 text-[12px] text-[#646872] transition-colors hover:border-[#ff1268] hover:bg-[#fff7fa] hover:text-[#e6005c]"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {conditions.length > 0 && (
                  <div className="mx-auto mt-7 max-w-[680px] border-t border-[#f0f1f3] pt-5 text-left">
                    <div className="mb-3 text-[12px] font-medium text-[#9a9ea6]">当前条件</div>
                    <div className="flex flex-wrap gap-2">
                      {conditions.map(condition => (
                        <span key={condition.label} className="rounded-full bg-[#f7f8fa] px-3 py-1.5 text-[12px] text-[#646872]">
                          {condition.label}：{condition.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {explanation && (
                  <div className="border-b border-[#f0f1f3] py-5 text-[14px] leading-7 text-[#555a63]">
                    {explanation}
                  </div>
                )}
                <div className="pt-6">
                  {results.map(result => (
                    <ResultCard
                      key={`${result.activityId}-${result.sessionId}-${result.ticketTypeId}`}
                      result={result}
                      onPurchase={handlePurchase}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
