import { describe, expect, it } from 'vitest'
import {
  buildRouteWaypoints,
  calculateRouteExposure,
  evaluateEnvironmentalAlert,
  normalizeSensorData,
  selectRouteByStrategy
} from '../utils/environment'

const sensors = normalizeSensorData([
  { latitude: '46.0569', longitude: '14.5058', air_quality: '35', temperature: '28', eco_score: '45', timestamp: '2026-07-01T10:00:00' }
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
})
