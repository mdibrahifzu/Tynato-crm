export type ApiFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>

function urlBase64ToUint8Array(value: string): Uint8Array {
  const normalized = value.trim()
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  const base64 = (normalized + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const raw = atob(base64)
  const output = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }

  return output
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getWebPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null

  const registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration) return null

  return registration.pushManager.getSubscription()
}

export async function enableWebPush(
  apiFetch: ApiFetch,
): Promise<boolean> {
  if (!isWebPushSupported()) {
    throw new Error('Web Push is not supported by this browser.')
  }

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    return false
  }

  const registration = await navigator.serviceWorker.register(
    '/service-worker.js',
    { scope: '/' },
  )

  await navigator.serviceWorker.ready

  const keyResponse = await apiFetch('/web-push/public-key')
  if (!keyResponse.ok) {
    let detail = 'Unable to load the Web Push public key.'
    try {
      const body = await keyResponse.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      // Keep the default message.
    }
    throw new Error(detail)
  }

  const keyData = await keyResponse.json() as { public_key?: string }
  const publicKey = keyData.public_key?.trim()

  if (!publicKey) {
    throw new Error('Web Push public key is empty.')
  }

  const existing = await registration.pushManager.getSubscription()

  const subscription =
    existing ??
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

  const payload = subscription.toJSON()

  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    throw new Error('Browser returned an incomplete push subscription.')
  }

  const saveResponse = await apiFetch('/web-push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: payload.endpoint,
      keys: {
        p256dh: payload.keys.p256dh,
        auth: payload.keys.auth,
      },
      expirationTime: payload.expirationTime ?? null,
    }),
  })

  if (!saveResponse.ok) {
    let detail = 'Unable to save this device for push notifications.'
    try {
      const body = await saveResponse.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      // Keep the default message.
    }
    throw new Error(detail)
  }

  return true
}

export async function disableWebPush(
  apiFetch: ApiFetch,
): Promise<void> {
  if (!isWebPushSupported()) return

  const registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration) return

  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const payload = subscription.toJSON()

  if (payload.endpoint) {
    const response = await apiFetch('/web-push/subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: payload.endpoint,
        keys: {
          p256dh: payload.keys?.p256dh || '',
          auth: payload.keys?.auth || '',
        },
        expirationTime: payload.expirationTime ?? null,
      }),
    })

    if (!response.ok) {
      let detail = 'Unable to disable push notifications.'
      try {
        const body = await response.json()
        if (typeof body?.detail === 'string') detail = body.detail
      } catch {
        // Keep the default message.
      }
      throw new Error(detail)
    }
  }

  await subscription.unsubscribe()
}
