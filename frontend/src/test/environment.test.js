import { describe, expect, it } from 'vitest'
import {
  buildRouteWaypoints,
  calculateAirQualityIndex,
  calculateRouteAirQuality,
  calculateRouteExposure,
  evaluateAirQualityAlert,
  evaluateEnvironmentalAlert,
  normalizeAirQualityStations,
  normalizeSensorData,
  selectRouteByStrategy
} from '../utils/environment'

const sensors = normalizeSensorData([
  { latitude: '46.0569', longitude: '14.5058', air_quality: '35', temperature: '28', eco_score: '45', timestamp: '2026-07-01T10:00:00' }
])

const arsoStations = normalizeAirQualityStations([
  { stationCode: 'E403', stationName: 'LJ Bezigrad', latitude: '46.0655449', longitude: '14.5127203', pm10: '13', pm2_5: '8', no2: '7', o3: '120' },
  { stationCode: 'E404', stationName: 'LJ Vic', latitude: '46.037487', longitude: '14.4892717', pm10: '15', pm2_5: '7' }
])

describe('environment helpers', () => {
  it('normalizes and scores sensor readings near a route', () => {
    const exposure = calculateRouteExposure([[46.0569, 14.5058]], sensors)
    expect(exposure.sensorCount).toBe(1)
    expect(exposure.airQuality).toBe(35)
  })

  it('selects different route candidates by strategy', () => {
    const routes = [
      { id: 'clean', durationMin: 14, environmentScore: 95 },
      { id: 'fast', durationMin: 10, environmentScore: 45 }
    ]
    expect(selectRouteByStrategy(routes, 'ECO').id).toBe('clean')
    expect(selectRouteByStrategy(routes, 'FAST').id).toBe('fast')
  })

  it('builds a direct route and two distinct alternative corridors', () => {
    const corridors = buildRouteWaypoints([46.05, 14.48], [46.08, 14.56])
    expect(corridors).toHaveLength(3)
    expect(corridors[1][0]).not.toEqual(corridors[2][0])
  })

  it('creates an alert from the saved threshold and nearby reading', () => {
    const alert = evaluateEnvironmentalAlert(sensors, [46.0569, 14.5058], 'MODERATE')
    expect(alert.message).toContain('air quality is 35')
  })

  it('normalizes real ARSO station rows and drops entries without coordinates', () => {
    const stations = normalizeAirQualityStations([
      { stationCode: 'E403', latitude: '46.0655449', longitude: '14.5127203', pm10: '13', pm2_5: '8' },
      { stationCode: 'MISSING-COORDS', pm10: '20' }
    ])
    expect(stations).toHaveLength(1)
    expect(stations[0].stationCode).toBe('E403')
    expect(stations[0].pm10).toBe(13)
  })

  it('scores real air-quality concentrations using published EAQI bands', () => {
    // pm10=13, pm2_5=8, no2=7, o3=120 - all comfortably in the "Good" band
    // except o3 (120 falls in the "Moderate" band), so the worst pollutant
    // (o3) should determine the overall index.
    const clean = calculateAirQualityIndex({ pm10: 13, pm2_5: 8, no2: 7, o3: 120 })
    expect(clean).toBe(65)

    // A station reporting only partial pollutants must still score using
    // whichever ones are present.
    const partial = calculateAirQualityIndex({ pm10: 15, pm2_5: 7, no2: null, o3: null })
    expect(partial).toBe(95)

    expect(calculateAirQualityIndex({ pm10: null, pm2_5: null, no2: null, o3: null })).toBeNull()
  })

  it('scores a route only when a real ARSO station is within range, and returns null otherwise', () => {
    const nearby = calculateRouteAirQuality([[46.06, 14.51]], arsoStations)
    expect(nearby.stationCount).toBeGreaterThan(0)
    expect(nearby.score).not.toBeNull()

    const farAway = calculateRouteAirQuality([[10, 10]], arsoStations)
    expect(farAway).toBeNull()
  })

  it('never invents an ECO winner when no candidate has real air-quality data', () => {
    const routes = [
      { id: 'a', durationMin: 12, environmentScore: null },
      { id: 'b', durationMin: 9, environmentScore: null }
    ]
    const result = selectRouteByStrategy(routes, 'ECO')
    expect(result.ecoDataUnavailable).toBe(true)
    expect(result.environmentScore).toBeNull()
    expect(result.id).toBe('b')
  })

  it('does not silently collapse ECO onto the FAST candidate when real scores tie', () => {
    // Three OSRM candidates that all matched the same real ARSO station (very
    // plausible - candidates are only ~1km apart, station coverage is sparse),
    // so their real environmentScore is identical. Before the fix, Array.sort
    // stability meant ECO always picked candidates[0] (the direct/fastest
    // route) on a tie, making "Eco" indistinguishable from "Fast".
    const routes = [
      { id: 'direct', durationMin: 10, environmentScore: 80 },
      { id: 'detour-a', durationMin: 16, environmentScore: 80 },
      { id: 'detour-b', durationMin: 14, environmentScore: 80 }
    ]
    expect(selectRouteByStrategy(routes, 'FAST').id).toBe('direct')
    // ECO must not also pick 'direct' just because the score tied - it should
    // break the tie toward the longer, less-direct candidate.
    expect(selectRouteByStrategy(routes, 'ECO').id).toBe('detour-a')
  })

  it('creates a real-data air-quality alert only when the nearest station is polluted enough', () => {
    const pollutedStation = normalizeAirQualityStations([
      { stationCode: 'X1', latitude: '46.0569', longitude: '14.5058', pm2_5: '60' }
    ])
    const alert = evaluateAirQualityAlert(pollutedStation, [46.0569, 14.5058], 'MODERATE')
    expect(alert.message).toContain('Air quality index')

    const cleanStation = normalizeAirQualityStations([
      { stationCode: 'X2', latitude: '46.0569', longitude: '14.5058', pm2_5: '5' }
    ])
    expect(evaluateAirQualityAlert(cleanStation, [46.0569, 14.5058], 'MODERATE')).toBeNull()
  })
})
