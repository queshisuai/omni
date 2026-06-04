import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCityOptions, formatCityDisplay, resolveActivityCityParam, resolveInitialCity, resolveRouteCity } from './city-selection.ts'

test('prefers city query parameter for initial city', () => {
  assert.equal(resolveInitialCity('北京'), '北京')
})

test('uses stable default for initial city without reading browser storage', () => {
  assert.equal(resolveInitialCity(''), '全部')
  assert.equal(resolveInitialCity(null), '全部')
})

test('searches hot cities and other cities together', () => {
  assert.deepEqual(filterCityOptions('北', ['北京', '上海'], ['北海', '南京']), ['北京', '北海'])
})

test('uses nationwide city on search route without city parameter', () => {
  assert.equal(resolveRouteCity('/search', null, '北京'), '全部')
})

test('uses nationwide city on home route even when stored city exists', () => {
  assert.equal(resolveRouteCity('/', null, '北京'), '全部')
})

test('formats all-city value as nationwide display text', () => {
  assert.equal(formatCityDisplay('全部'), '全国')
  assert.equal(formatCityDisplay('北京'), '北京')
})

test('does not send all-city value as activity city parameter', () => {
  assert.equal(resolveActivityCityParam('全部'), undefined)
  assert.equal(resolveActivityCityParam(''), undefined)
  assert.equal(resolveActivityCityParam('北京'), '北京')
})
