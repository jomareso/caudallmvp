'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

async function requireAdm(): Promise<void> {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');
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
