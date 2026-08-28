// Compartida entre quien la escribe (registro/google-actions.ts, antes de
// mandar a Google) y quien la lee (auth.ts, GoogleProvider.profile(), al
// volver) — un solo lugar para el nombre evita que se desincronicen.
export const ENROLLMENT_CODE_COOKIE = 'pending_enrollment_code';
