'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

async function requireAdm() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');
  return admin;
}

const formSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  profileType: z.enum(['ADM', 'EMPRESA', 'FUNCIONAL']),
  tenantId: z.string().trim().optional(),
  functionalRole: z.enum(['METHODOLOGIST', 'PRODUCT_ADMIN', 'ANALYST', 'VIEWER']).optional()
});

export async function createAdminUser(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdm();
  const t = await getTranslations('admin.administradores');

  const parsed = formSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { email, profileType, tenantId, functionalRole } = parsed.data;

  // Cada perfil trae su propio dato obligatorio (spec de Reynoso: "al crear
  // el usuario se define el tipo de perfil") — EMPRESA sin tenant o
  // FUNCIONAL sin rol no significan nada.
  if (profileType === 'EMPRESA' && !tenantId) {
    return { ok: false, message: t('errorTenantRequired') };
  }
  if (profileType === 'FUNCIONAL' && !functionalRole) {
    return { ok: false, message: t('errorFunctionalRoleRequired') };
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, message: t('errorEmailExists') };
  }

  await prisma.adminUser.create({
    data: {
      email,
      profileType,
      tenantId: profileType === 'EMPRESA' ? tenantId : null,
      functionalRole: profileType === 'FUNCIONAL' ? functionalRole : null
    }
  });

  return { ok: true };
}

const updateFormSchema = z.object({
  adminUserId: z.string().trim().min(1),
  profileType: z.enum(['ADM', 'EMPRESA', 'FUNCIONAL']),
  tenantId: z.string().trim().optional(),
  functionalRole: z.enum(['METHODOLOGIST', 'PRODUCT_ADMIN', 'ANALYST', 'VIEWER']).optional()
});

export async function updateAdminUser(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.administradores');

  const parsed = updateFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { adminUserId, profileType, tenantId, functionalRole } = parsed.data;

  if (profileType === 'EMPRESA' && !tenantId) {
    return { ok: false, message: t('errorTenantRequired') };
  }
  if (profileType === 'FUNCIONAL' && !functionalRole) {
    return { ok: false, message: t('errorFunctionalRoleRequired') };
  }

  // Un ADM que se quita a sí mismo el perfil ADM se quedaría sin forma de
  // volver a entrar a esta pantalla — nadie más podría revertirlo.
  if (adminUserId === actor.id && profileType !== 'ADM') {
    return { ok: false, message: t('errorSelfDemote') };
  }

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) {
    return { ok: false, message: t('errorGeneric') };
  }

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: {
      profileType,
      tenantId: profileType === 'EMPRESA' ? tenantId : null,
      functionalRole: profileType === 'FUNCIONAL' ? functionalRole : null
    }
  });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: 'UPDATE_ADMIN_USER',
      entityType: 'AdminUser',
      entityId: adminUserId,
      previousValue: { profileType: target.profileType, tenantId: target.tenantId, functionalRole: target.functionalRole },
      newValue: {
        profileType,
        tenantId: profileType === 'EMPRESA' ? tenantId : null,
        functionalRole: profileType === 'FUNCIONAL' ? functionalRole : null
      }
    }
  });

  return { ok: true };
}

export async function setAdminUserActive(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.administradores');

  const parsed = z.object({ adminUserId: z.string().trim().min(1), active: z.boolean() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { adminUserId, active } = parsed.data;

  // Nadie puede desactivarse a sí mismo — evita que el único ADM activo se
  // quede sin acceso al panel y sin nadie más que pueda reactivarlo.
  if (adminUserId === actor.id && !active) {
    return { ok: false, message: t('errorSelfDeactivate') };
  }

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) {
    return { ok: false, message: t('errorGeneric') };
  }

  await prisma.adminUser.update({ where: { id: adminUserId }, data: { active } });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: active ? 'REACTIVATE_ADMIN_USER' : 'DEACTIVATE_ADMIN_USER',
      entityType: 'AdminUser',
      entityId: adminUserId,
      previousValue: { active: target.active },
      newValue: { active }
    }
  });

  return { ok: true };
}
