'use client';

import { useEffect, useState } from 'react';
import { subscribeToPush } from '../../push-actions';

// Convierte la VAPID public key (base64url) al formato que
// PushManager.subscribe() espera (Uint8Array) — conversión estándar
// documentada por MDN para Web Push, no hay API nativa para esto.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

type Status = 'checking' | 'unsupported' | 'off' | 'on' | 'busy';

export function PushOptIn({ labels }: { labels: { enable: string; enabled: string } }) {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!cancelled) setStatus(existing ? 'on' : 'off');
    }

    check().catch(() => {
      if (!cancelled) setStatus('unsupported');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setStatus('unsupported');
      return;
    }

    setStatus('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('off');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const json = subscription.toJSON();
      const result = await subscribeToPush({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth }
      });

      setStatus(result.ok ? 'on' : 'off');
    } catch {
      setStatus('off');
    }
  }

  // "checking"/"unsupported" no muestran nada: el primero es transitorio,
  // el segundo no es accionable para el usuario (ej. Safari de escritorio,
  // o iOS con la PWA todavía no instalada a la pantalla de inicio).
  if (status === 'checking' || status === 'unsupported') return null;
  if (status === 'on') return <p className="text-xs text-ok">{labels.enabled}</p>;

  return (
    <button
      type="button"
      onClick={handleEnable}
      disabled={status === 'busy'}
      className="text-xs text-yale underline disabled:opacity-60"
    >
      {labels.enable}
    </button>
  );
}
