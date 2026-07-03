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

export function selectRouteByStrategy(routes, strategy) {
  if (!routes.length) return null
  const fastestDuration = Math.min(...routes.map(route => route.durationMin))
  const ranked = routes.map(route => ({
    ...route,
    speedScore: fastestDuration > 0 ? Math.min(100, (fastestDuration / route.durationMin) * 100) : 100,
    environmentScore: route.environmentScore ?? 50
  }))

  if (strategy === 'FAST') {
    return [...ranked].sort((a, b) => a.durationMin - b.durationMin)[0]
  }

  if (strategy === 'ECO') {
    // Prefer the cleanest air/conditions; when candidates tie on environment
    // data (e.g. no live sensor coverage yet), favour the road less travelled
    // over silently collapsing to the fastest route.
    return [...ranked].sort((a, b) => {
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
