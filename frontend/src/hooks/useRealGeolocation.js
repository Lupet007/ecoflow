import { useCallback, useEffect, useRef, useState } from 'react'

// Wraps the browser's real Geolocation API. On mount, checks (without
// prompting) whether location permission was already granted on a previous
// visit - if so, silently fetches the position again. If permission hasn't
// been decided yet (or was denied), it does nothing automatically: an
// unexpected browser permission popup on every page load would be intrusive,
// so a fresh grant always requires the caller to invoke requestLocation()
// from an explicit user action (a button click).
//
// onPosition (optional) is invoked with { latitude, longitude } every time a
// position is resolved, whether triggered by the button or the silent
// on-mount check - callers that need to react to a new position (e.g.
// recording a measurement) should use this instead of a useEffect watching
// the returned `position`, since calling it from a useEffect body would
// trigger React's "no setState synchronously in an effect" rule.
export function useRealGeolocation(onPosition) {
  const [status, setStatus] = useState('idle')
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)

  // Callers (e.g. StatsDashboardPage) typically pass an inline function that
  // gets a new reference on every render. Reading it through a ref instead of
  // a useCallback dependency keeps requestLocation's identity stable forever,
  // so the mount-only permission check below doesn't re-run (and re-fetch)
  // every time the caller re-renders - that instability previously caused a
  // request/render feedback loop (each fetch updated state, which re-rendered
  // the caller, which recreated the callback, which re-ran the effect...).
  const onPositionRef = useRef(onPosition)
  useEffect(() => {
    onPositionRef.current = onPosition
  })

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported')
      setError('Ta brskalnik ne podpira geolokacije.')
      return
    }

    setStatus('requesting')

    navigator.geolocation.getCurrentPosition(
      (result) => {
        const coords = { latitude: result.coords.latitude, longitude: result.coords.longitude }
        setPosition(coords)
        setStatus('granted')
        setError(null)
        onPositionRef.current?.(coords)
      },
      () => {
        setStatus('denied')
        setError('Dovoljenje za lokacijo je bilo zavrnjeno ali ni na voljo.')
      }
    )
  }, [])

  useEffect(() => {
    if (!navigator.permissions?.query) return undefined

    let cancelled = false

    navigator.permissions.query({ name: 'geolocation' })
      .then(result => {
        if (!cancelled && result.state === 'granted') {
          requestLocation()
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [requestLocation])

  return { status, position, error, requestLocation }
}
