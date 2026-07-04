const ALERT_RULES = {
  POOR: { airQuality: 40, ecoScore: 40, temperature: 30, label: 'Poor' },
  MODERATE: { airQuality: 60, ecoScore: 60, temperature: 27, label: 'Moderate' },
  ANY: { airQuality: 80, ecoScore: 80, temperature: 24, label: 'Caution' }
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function normalizeSensorData(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.data
  if (!Array.isArray(rows)) return []

  return rows.map((row, index) => {
    const latitude = toNumber(row.latitude ?? row.lat)
    const longitude = toNumber(row.longitude ?? row.lng ?? row.lon)
    if (latitude === null || longitude === null) return null

    return {
      id: row.id ?? `${row.timestamp ?? 'sensor'}-${index}`,
      latitude,
      longitude,
      airQuality: toNumber(row.air_quality ?? row.airQuality),
      temperature: toNumber(row.temperature),
      ecoScore: toNumber(row.eco_score ?? row.ecoScore),
      activityType: row.activity_type ?? row.activityType ?? null,
      timestamp: row.timestamp ? new Date(row.timestamp) : null
    }
  }).filter(Boolean)
}

export function normalizeAirQualityStations(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.data
  if (!Array.isArray(rows)) return []

  return rows.map(row => {
    const latitude = toNumber(row.latitude)
    const longitude = toNumber(row.longitude)
    if (latitude === null || longitude === null) return null

    return {
      id: row.id ?? row.stationCode,
      stationCode: row.stationCode ?? null,
      stationName: row.stationName ?? null,
      latitude,
      longitude,
      pm10: toNumber(row.pm10),
      pm2_5: toNumber(row.pm2_5),
      no2: toNumber(row.no2),
      o3: toNumber(row.o3),
      co: toNumber(row.co),
      so2: toNumber(row.so2),
      measuredFrom: row.measuredFrom ? new Date(row.measuredFrom) : null
    }
  }).filter(Boolean)
}

export function distanceKm(first, second) {
  const [lat1, lon1] = first
  const [lat2, lon2] = second
  const radius = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
    * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLon / 2) ** 2

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function buildRouteWaypoints(start, end) {
  const deltaLat = end[0] - start[0]
  const deltaLon = end[1] - start[1]
  const length = Math.hypot(deltaLat, deltaLon)
  if (length === 0) return [[]]

  const offset = Math.min(0.015, Math.max(0.003, length * 0.18))
  const perpendicularLat = -deltaLon / length
  const perpendicularLon = deltaLat / length
  const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]

  return [
    [],
    [[midpoint[0] + perpendicularLat * offset, midpoint[1] + perpendicularLon * offset]],
    [[midpoint[0] - perpendicularLat * offset, midpoint[1] - perpendicularLon * offset]]
  ]
}

function nearestReading(point, readings, maximumDistance = 35) {
  let nearest = null
  let nearestDistance = Infinity

  readings.forEach(reading => {
    const distance = distanceKm(point, [reading.latitude, reading.longitude])
    if (distance < nearestDistance && distance <= maximumDistance) {
      nearest = reading
      nearestDistance = distance
    }
  })

  return nearest ? { reading: nearest, distance: nearestDistance } : null
}

export function calculateRouteExposure(points, readings) {
  if (!points.length || !readings.length) return null

  const step = Math.max(1, Math.floor(points.length / 30))
  const samples = points.filter((_, index) => index % step === 0)
  const matched = samples
    .map(point => nearestReading(point, readings))
    .filter(Boolean)

  if (!matched.length) return null

  const uniqueReadings = [...new Map(matched.map(match => [match.reading.id, match.reading])).values()]
  const average = key => {
    const values = uniqueReadings.map(reading => reading[key]).filter(value => value !== null)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  }
  const airQuality = average('airQuality')
  const ecoScore = average('ecoScore')
  const temperature = average('temperature')
  const components = []

  if (airQuality !== null) components.push(airQuality)
  if (ecoScore !== null) components.push(ecoScore)
  if (temperature !== null) components.push(Math.max(0, 100 - Math.abs(temperature - 20) * 6))

  return {
    score: components.length
      ? Math.round(components.reduce((sum, value) => sum + value, 0) / components.length)
      : null,
    airQuality: airQuality === null ? null : Math.round(airQuality),
    temperature: temperature === null ? null : Math.round(temperature * 10) / 10,
    sensorCount: uniqueReadings.length
  }
}

// European Environment Agency's European Air Quality Index (EAQI) breakpoints
// (eea.europa.eu/themes/air/air-quality-index) - six qualitative bands per
// pollutant (Good/Fair/Moderate/Poor/Very Poor/Extremely Poor). Applied here to
// real ARSO station measurements and mapped to a 0-100 "cleanliness" score
// (100 = Good, ~10 = Extremely Poor). This is a published methodology applied
// to real data, not an invented formula.
const AQI_BAND_SCORES = [95, 80, 65, 45, 25, 10]

const AQI_BREAKPOINTS = {
  pm2_5: [10, 20, 25, 50, 75],
  pm10: [20, 40, 50, 100, 150],
  no2: [40, 90, 120, 230, 340],
  o3: [50, 100, 130, 240, 380]
}

function pollutantSubIndex(pollutant, concentration) {
  const breakpoints = AQI_BREAKPOINTS[pollutant]
  if (!breakpoints || concentration === null || concentration === undefined) return null

  const band = breakpoints.findIndex(limit => concentration <= limit)
  return AQI_BAND_SCORES[band === -1 ? AQI_BAND_SCORES.length - 1 : band]
}

export function calculateAirQualityIndex(station) {
  if (!station) return null

  const subIndexes = ['pm2_5', 'pm10', 'no2', 'o3']
    .map(pollutant => pollutantSubIndex(pollutant, station[pollutant]))
    .filter(value => value !== null)

  if (!subIndexes.length) return null

  // The EAQI convention reports the worst-performing pollutant as the overall
  // index, since that's the one actually driving health risk.
  return Math.min(...subIndexes)
}

function nearestStation(point, stations, maximumDistance = 35) {
  let nearest = null
  let nearestDistance = Infinity

  stations.forEach(station => {
    const distance = distanceKm(point, [station.latitude, station.longitude])
    if (distance < nearestDistance && distance <= maximumDistance) {
      nearest = station
      nearestDistance = distance
    }
  })

  return nearest ? { station: nearest, distance: nearestDistance } : null
}

export function calculateRouteAirQuality(points, stations) {
  if (!points.length || !stations.length) return null

  const step = Math.max(1, Math.floor(points.length / 30))
  const samples = points.filter((_, index) => index % step === 0)
  const matched = samples
    .map(point => nearestStation(point, stations))
    .filter(Boolean)

  if (!matched.length) return null

  const uniqueStations = [...new Map(matched.map(match => [match.station.id, match.station])).values()]
  const scores = uniqueStations.map(calculateAirQualityIndex).filter(value => value !== null)

  if (!scores.length) return null

  return {
    score: Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length),
    stationCount: uniqueStations.length,
    stationNames: uniqueStations.map(station => station.stationName ?? station.stationCode).filter(Boolean),
    nearestDistanceKm: Math.round(Math.min(...matched.map(match => match.distance)) * 10) / 10
  }
}

export function selectRouteByStrategy(routes, strategy) {
  if (!routes.length) return null
  const fastestDuration = Math.min(...routes.map(route => route.durationMin))
  const ranked = routes.map(route => ({
    ...route,
    speedScore: fastestDuration > 0 ? Math.min(100, (fastestDuration / route.durationMin) * 100) : 100
    // environmentScore is passed through as-is: null means "no real air-quality
    // data near this candidate" and must never be coerced into a fabricated
    // default value.
  }))

  if (strategy === 'FAST') {
    return [...ranked].sort((a, b) => a.durationMin - b.durationMin)[0]
  }

  if (strategy === 'ECO') {
    const withData = ranked.filter(route => route.environmentScore !== null && route.environmentScore !== undefined)

    if (!withData.length) {
      // No candidate has any real air-quality data nearby - there is nothing
      // genuine to rank by, so fall back to the fastest candidate and flag it
      // honestly rather than inventing an "eco" winner.
      const fastest = [...ranked].sort((a, b) => a.durationMin - b.durationMin)[0]
      return { ...fastest, environmentScore: null, ecoDataUnavailable: true }
    }

    // Rank by the real air-quality score first. Nearby candidates often share
    // the same closest ARSO station (station coverage is sparse - roughly one
    // station per city, not one per street), which means their scores can be
    // genuinely, honestly identical. Array.sort is stable, so without a
    // tie-break the first candidate (the direct/fastest one) always won on a
    // tie, making "Eco" silently collapse onto "Fast". Break ties toward the
    // longer candidate instead, since avoiding the most direct route is the
    // only meaningful "eco" signal left when the real data doesn't disambiguate.
    return [...withData].sort((a, b) => {
      if (b.environmentScore !== a.environmentScore) return b.environmentScore - a.environmentScore
      return b.durationMin - a.durationMin
    })[0]
  }

  // BALANCED: the candidate with the median duration is a genuine middle
  // ground between the fastest and the most eco-friendly option.
  const sortedByDuration = [...ranked].sort((a, b) => a.durationMin - b.durationMin)
  return sortedByDuration[Math.floor((sortedByDuration.length - 1) / 2)]
}

export function evaluateEnvironmentalAlert(readings, regionCenter, threshold = 'MODERATE') {
  if (!regionCenter || !readings.length) return null
  const nearby = readings
    .map(reading => ({ ...reading, distance: distanceKm(regionCenter, [reading.latitude, reading.longitude]) }))
    .filter(reading => reading.distance <= 35)
    .sort((a, b) => {
      const timeA = a.timestamp && !Number.isNaN(a.timestamp.getTime()) ? a.timestamp.getTime() : 0
      const timeB = b.timestamp && !Number.isNaN(b.timestamp.getTime()) ? b.timestamp.getTime() : 0
      return timeB - timeA
    })

  if (!nearby.length) return null
  const reading = nearby[0]
  const rule = ALERT_RULES[threshold] || ALERT_RULES.MODERATE
  const reasons = []

  if (reading.airQuality !== null && reading.airQuality < rule.airQuality) {
    reasons.push(`air quality is ${reading.airQuality}`)
  }
  if (reading.ecoScore !== null && reading.ecoScore < rule.ecoScore) {
    reasons.push(`eco-score is ${reading.ecoScore}`)
  }
  if (reading.temperature !== null && reading.temperature >= rule.temperature) {
    reasons.push(`temperature is ${reading.temperature} C`)
  }

  if (!reasons.length) return null

  return {
    severity: threshold === 'POOR' ? 'critical' : 'warning',
    title: `${rule.label} conditions near your preferred region`,
    message: `${reasons.join(' and ')}. Consider another route or time.`,
    reading
  }
}

export function evaluateAirQualityAlert(stations, regionCenter, threshold = 'MODERATE') {
  if (!regionCenter || !stations.length) return null

  const nearby = stations
    .map(station => ({ ...station, distance: distanceKm(regionCenter, [station.latitude, station.longitude]) }))
    .filter(station => station.distance <= 35)
    .sort((a, b) => a.distance - b.distance)

  if (!nearby.length) return null

  const station = nearby[0]
  const index = calculateAirQualityIndex(station)
  if (index === null) return null

  const rule = ALERT_RULES[threshold] || ALERT_RULES.MODERATE
  if (index >= rule.airQuality) return null

  return {
    severity: threshold === 'POOR' ? 'critical' : 'warning',
    title: `${rule.label} conditions near your preferred region`,
    message: `Air quality index near ${station.stationName ?? 'the nearest station'} is ${index}. Consider another route or time.`,
    station
  }
}
