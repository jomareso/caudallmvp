'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleEmailChannel, toggleNotificationPreference, type NotificationKey } from './actions';

// Un solo componente para el canal de correo y los 5 tipos de
// notificación: misma UI (interruptor), mismo patrón optimista, distinta
// server action detrás — `channel` decide cuál.
export function NotificationToggle({
  target,
  initialOn
}: {
  target: { channel: true } | { channel: false; key: NotificationKey };
  initialOn: boolean;
}) {
  const [on, setOptimisticOn] = useOptimistic(initialOn);
  const [, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      setOptimisticOn(!on);
      if (target.channel) {
        await toggleEmailChannel();
      } else {
        await toggleNotificationPreference(target.key);
      }
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={handleClick}
      className={`relative w-9 h-5 rounded-full shrink-0 mt-0.5 transition-colors ${on ? 'bg-yale' : 'bg-silver'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-4' : ''
        }`}
      />
    </button>
  );
}
