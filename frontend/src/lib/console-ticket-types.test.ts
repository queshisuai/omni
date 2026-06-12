import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getBatchTicketPriceUpdateTargets,
  getBatchTicketStockUpdateBlockedTargets,
  getBatchTicketStockUpdateTargets,
  getBatchTicketStatusUpdateTargets,
  parseBatchTicketImportInput,
  parseBatchTicketPriceInput,
  parseBatchTicketStockInput,
} from './console-ticket-types.ts'
import type { TicketTypeEntity } from '../types/api.ts'

test('filters batch ticket price targets to selected known-status ticket types', () => {
  const ticketTypes = [
    { id: 101, sessionId: 1, name: '内场票', price: 880, totalStock: 100, remainStock: 60, status: 1 },
    { id: 102, sessionId: 1, name: '看台票', price: 380, totalStock: 200, remainStock: 180, status: 0 },
    { id: 103, sessionId: 1, name: '同步中票档', price: 280, totalStock: 200, remainStock: 200, status: 9 },
    { id: 104, sessionId: 1, name: '未选票档', price: 180, totalStock: 500, remainStock: 500, status: 1 },
  ] as TicketTypeEntity[]

  const targets = getBatchTicketPriceUpdateTargets(ticketTypes, new Set([101, 102, 103, 999]))

  assert.deepEqual(targets.map(ticket => ticket.id), [101, 102])
})

test('parses batch ticket price input with Chinese validation errors', () => {
  assert.deepEqual(parseBatchTicketPriceInput(' 199.50 '), { price: 199.5, error: '' })
  assert.equal(parseBatchTicketPriceInput('').error, '目标票价不能为空')
  assert.equal(parseBatchTicketPriceInput('-1').error, '目标票价必须大于 0')
  assert.equal(parseBatchTicketPriceInput('abc').error, '目标票价必须是数字')
})

test('filters batch ticket status targets to selected known-status ticket types that need changes', () => {
  const ticketTypes = [
    { id: 101, sessionId: 1, name: '内场票', price: 880, totalStock: 100, remainStock: 60, status: 1 },
    { id: 102, sessionId: 1, name: '看台票', price: 380, totalStock: 200, remainStock: 180, status: 0 },
    { id: 103, sessionId: 1, name: '同步中票档', price: 280, totalStock: 200, remainStock: 200, status: 9 },
    { id: 104, sessionId: 1, name: '未选票档', price: 180, totalStock: 500, remainStock: 500, status: 1 },
  ] as TicketTypeEntity[]

  const selectedIds = new Set([101, 102, 103, 999])

  assert.deepEqual(getBatchTicketStatusUpdateTargets(ticketTypes, selectedIds, 0).map(ticket => ticket.id), [101])
  assert.deepEqual(getBatchTicketStatusUpdateTargets(ticketTypes, selectedIds, 1).map(ticket => ticket.id), [102])
  assert.deepEqual(getBatchTicketStatusUpdateTargets(ticketTypes, selectedIds, 9).map(ticket => ticket.id), [])
})

test('filters batch ticket stock targets and blocks values below sold count', () => {
  const ticketTypes = [
    { id: 101, sessionId: 1, name: '内场票', price: 880, totalStock: 100, remainStock: 60, status: 1 },
    { id: 102, sessionId: 1, name: '看台票', price: 380, totalStock: 200, remainStock: 180, status: 0 },
    { id: 103, sessionId: 1, name: '同步中票档', price: 280, totalStock: 200, remainStock: 200, status: 9 },
    { id: 104, sessionId: 1, name: '未选票档', price: 180, totalStock: 500, remainStock: 500, status: 1 },
  ] as TicketTypeEntity[]

  const selectedIds = new Set([101, 102, 103, 999])

  assert.deepEqual(getBatchTicketStockUpdateTargets(ticketTypes, selectedIds).map(ticket => ticket.id), [101, 102])
  assert.deepEqual(getBatchTicketStockUpdateBlockedTargets(ticketTypes, selectedIds, 30).map(ticket => ticket.id), [101])
  assert.deepEqual(getBatchTicketStockUpdateBlockedTargets(ticketTypes, selectedIds, 10).map(ticket => ticket.id), [101, 102])
})

test('parses batch ticket stock input with Chinese validation errors', () => {
  assert.deepEqual(parseBatchTicketStockInput(' 200 '), { totalStock: 200, error: '' })
  assert.equal(parseBatchTicketStockInput('').error, '目标总库存不能为空')
  assert.equal(parseBatchTicketStockInput('-1').error, '目标总库存不能小于 0')
  assert.equal(parseBatchTicketStockInput('12.5').error, '目标总库存必须是整数')
  assert.equal(parseBatchTicketStockInput('abc').error, '目标总库存必须是数字')
})

test('parses batch ticket import rows with optional header', () => {
  const result = parseBatchTicketImportInput(`
场次编号,票档名称,票价,总库存
1001,内场票,880,100
1002\t看台票\t380.5\t200
`)

  assert.deepEqual(result.rows, [
    { sessionId: 1001, name: '内场票', price: 880, totalStock: 100 },
    { sessionId: 1002, name: '看台票', price: 380.5, totalStock: 200 },
  ])
  assert.deepEqual(result.errors, [])
})

test('reports Chinese validation errors for invalid batch ticket import rows', () => {
  const result = parseBatchTicketImportInput(`
abc,内场票,880,100
1002,,380,200
1003,看台票,0,200
1004,早鸟票,180,12.5
`)

  assert.deepEqual(result.rows, [])
  assert.deepEqual(result.errors, [
    '第 1 行：场次编号必须是正整数',
    '第 2 行：票档名称不能为空',
    '第 3 行：票价必须大于 0',
    '第 4 行：总库存必须是非负整数',
  ])
})
