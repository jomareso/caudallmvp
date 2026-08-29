'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';

// Opciones conductuales editables desde /admin/metodologia/conductual
// (auditoría de valores hardcodeados, 29 ago) — ver
// src/lib/engines/commitment-triggers.ts y src/lib/engines/outcome-reasons.ts
// para dónde se usan en runtime. `code` es estable y queda guardado en
// datos del empleado (EmployeeIntervention.commitmentData/feedback), así
// que no es editable después de creado y nunca se borra — solo se
// desactiva.
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(CODE_PATTERN, 'CODE_FORMAT');

// --- Commitment triggers ---------------------------------------------

const createTriggerSchema = z.object({
  code: codeSchema,
  icon: z.string().trim().min(1).max(8),
  label: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(1000)
});

export async function createCommitmentTrigger(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.metodologia.conductual');

  const parsed = createTriggerSchema.safeParse(input);
  if (!parsed.success) {
    const badCode = parsed.error.issues.some((i) => i.message === 'CODE_FORMAT');
    return { ok: false, message: badCode ? t('errorCodeFormat') : t('errorGeneric') };
  }
  const { code, icon, label, sortOrder } = parsed.data;

  const existing = await prisma.commitmentTriggerOption.findUnique({ where: { code } });
  if (existing) {
    return { ok: false, message: t('errorCodeExists') };
  }

  const trigger = await prisma.commitmentTriggerOption.create({ data: { code, icon, label, sortOrder } });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: 'CREATE_COMMITMENT_TRIGGER',
      entityType: 'CommitmentTriggerOption',
      entityId: trigger.id,
      newValue: { code, icon, label, sortOrder }
    }
  });

  revalidatePath('/admin/metodologia/conductual');
  return { ok: true };
}

const updateTriggerSchema = z.object({
  id: z.string().trim().min(1),
  icon: z.string().trim().min(1).max(8),
  label: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(1000)
});

export async function updateCommitmentTrigger(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.metodologia.conductual');

  const parsed = updateTriggerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { id, icon, label, sortOrder } = parsed.data;

  const target = await prisma.commitmentTriggerOption.findUnique({ where: { id } });
  if (!target) {
    return { ok: false, message: t('errorGeneric') };
  }

  await prisma.commitmentTriggerOption.update({ where: { id }, data: { icon, label, sortOrder } });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: 'UPDATE_COMMITMENT_TRIGGER',
      entityType: 'CommitmentTriggerOption',
      entityId: id,
      previousValue: { icon: target.icon, label: target.label, sortOrder: target.sortOrder },
      newValue: { icon, label, sortOrder }
    }
  });

  revalidatePath('/admin/metodologia/conductual');
  revalidatePath('/diagnostico/accion');
  return { ok: true };
}

export async function setCommitmentTriggerEnabled(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.metodologia.conductual');

  const parsed = z.object({ id: z.string().trim().min(1), enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { id, enabled } = parsed.data;

  const target = await prisma.commitmentTriggerOption.findUnique({ where: { id } });
  if (!target) {
    return { ok: false, message: t('errorGeneric') };
  }

  await prisma.commitmentTriggerOption.update({ where: { id }, data: { enabled } });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: enabled ? 'ENABLE_COMMITMENT_TRIGGER' : 'DISABLE_COMMITMENT_TRIGGER',
      entityType: 'CommitmentTriggerOption',
      entityId: id,
      previousValue: { enabled: target.enabled },
      newValue: { enabled }
    }
  });

  revalidatePath('/admin/metodologia/conductual');
  revalidatePath('/diagnostico/accion');
  return { ok: true };
}

// --- Outcome reasons ----------------------------------------------------

const createReasonSchema = z.object({
  code: codeSchema,
  label: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(1000)
});

export async function createOutcomeReason(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.metodologia.conductual');

  const parsed = createReasonSchema.safeParse(input);
  if (!parsed.success) {
    const badCode = parsed.error.issues.some((i) => i.message === 'CODE_FORMAT');
    return { ok: false, message: badCode ? t('errorCodeFormat') : t('errorGeneric') };
  }
  const { code, label, sortOrder } = parsed.data;

  const existing = await prisma.outcomeReasonOption.findUnique({ where: { code } });
  if (existing) {
    return { ok: false, message: t('errorCodeExists') };
  }

  const reason = await prisma.outcomeReasonOption.create({ data: { code, label, sortOrder } });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: 'CREATE_OUTCOME_REASON',
      entityType: 'OutcomeReasonOption',
      entityId: reason.id,
      newValue: { code, label, sortOrder }
    }
  });

  revalidatePath('/admin/metodologia/conductual');
  return { ok: true };
}

const updateReasonSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(1000)
});

export async function updateOutcomeReason(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.metodologia.conductual');

  const parsed = updateReasonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { id, label, sortOrder } = parsed.data;

  const target = await prisma.outcomeReasonOption.findUnique({ where: { id } });
  if (!target) {
    return { ok: false, message: t('errorGeneric') };
  }

  await prisma.outcomeReasonOption.update({ where: { id }, data: { label, sortOrder } });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: 'UPDATE_OUTCOME_REASON',
      entityType: 'OutcomeReasonOption',
      entityId: id,
      previousValue: { label: target.label, sortOrder: target.sortOrder },
      newValue: { label, sortOrder }
    }
  });

  revalidatePath('/admin/metodologia/conductual');
  revalidatePath('/diagnostico/accion');
  return { ok: true };
}

export async function setOutcomeReasonEnabled(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.metodologia.conductual');

  const parsed = z.object({ id: z.string().trim().min(1), enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { id, enabled } = parsed.data;

  const target = await prisma.outcomeReasonOption.findUnique({ where: { id } });
  if (!target) {
    return { ok: false, message: t('errorGeneric') };
  }

  await prisma.outcomeReasonOption.update({ where: { id }, data: { enabled } });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: enabled ? 'ENABLE_OUTCOME_REASON' : 'DISABLE_OUTCOME_REASON',
      entityType: 'OutcomeReasonOption',
      entityId: id,
      previousValue: { enabled: target.enabled },
      newValue: { enabled }
    }
  });

  revalidatePath('/admin/metodologia/conductual');
  revalidatePath('/diagnostico/accion');
  return { ok: true };
}
