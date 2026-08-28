'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  LANDING_BLOCK_FIELDS,
  isLandingBlockType,
  type LandingBlockType,
  type LandingFieldDescriptor,
  type LandingMilestone
} from '@/lib/landing/blocks';
import { updateBlockContent, toggleBlockVisible, moveBlock, uploadMediaAsset, deleteMediaAsset } from './actions';

type BlockDTO = {
  id: string;
  type: string;
  order: number;
  visible: boolean;
  // Viene de Prisma como Json; cada `type` tiene su propia forma (ver
  // src/lib/landing/blocks.ts) — se valida recién al guardar, no acá.
  content: Record<string, unknown>;
};

type MediaDTO = { id: string; filename: string; mimeType: string; size: number; createdAt: string };

type Labels = {
  title: string;
  tabEmpleador: string;
  tabColaborador: string;
  tabMedia: string;
  visibleLabel: string;
  hiddenLabel: string;
  moveUp: string;
  moveDown: string;
  edit: string;
  save: string;
  saving: string;
  cancel: string;
  saveSuccess: string;
  saveError: string;
  highlightHelp: string;
  oneLinePerItem: string;
  milestoneYear: string;
  milestoneTitle: string;
  milestoneDescription: string;
  milestoneImage: string;
  milestoneImageNone: string;
  addMilestone: string;
  removeMilestone: string;
  fields: Record<string, string>;
  blockTypeLabels: Record<string, string>;
  media: Record<string, string>;
};

export function ContentAdminClient({
  empleadorBlocks,
  colaboradorBlocks,
  media,
  labels
}: {
  empleadorBlocks: BlockDTO[];
  colaboradorBlocks: BlockDTO[];
  media: MediaDTO[];
  labels: Labels;
}) {
  const [tab, setTab] = useState<'EMPLEADOR' | 'COLABORADOR' | 'MEDIA'>('EMPLEADOR');

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-silver/60 mb-6">
        {(
          [
            ['EMPLEADOR', labels.tabEmpleador],
            ['COLABORADOR', labels.tabColaborador],
            ['MEDIA', labels.tabMedia]
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === value ? 'border-yale text-yale font-medium' : 'border-transparent text-nickel hover:text-quartz'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'EMPLEADOR' ? <BlockList blocks={empleadorBlocks} media={media} labels={labels} /> : null}
      {tab === 'COLABORADOR' ? <BlockList blocks={colaboradorBlocks} media={media} labels={labels} /> : null}
      {tab === 'MEDIA' ? <MediaLibrary media={media} labels={labels} /> : null}
    </div>
  );
}

function BlockList({ blocks, media, labels }: { blocks: BlockDTO[]; media: MediaDTO[]; labels: Labels }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <BlockCard
          key={block.id}
          block={block}
          media={media}
          labels={labels}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
        />
      ))}
    </div>
  );
}

function BlockCard({
  block,
  media,
  labels,
  isFirst,
  isLast
}: {
  block: BlockDTO;
  media: MediaDTO[];
  labels: Labels;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggleVisible() {
    startTransition(async () => {
      await toggleBlockVisible(block.id, !block.visible);
      router.refresh();
    });
  }

  function handleMove(direction: 'up' | 'down') {
    startTransition(async () => {
      await moveBlock(block.id, direction);
      router.refresh();
    });
  }

  const typeLabel = labels.blockTypeLabels[block.type] ?? block.type;

  return (
    <div className="bg-white border border-silver/60 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-quartz">{typeLabel}</span>
          {!block.visible ? <span className="text-[11px] text-nickel bg-silver/30 rounded-full px-2 py-0.5">{labels.hiddenLabel}</span> : null}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleMove('up')}
            disabled={isFirst || isPending}
            className="text-xs text-nickel hover:text-yale disabled:opacity-30 px-1.5 py-1"
            aria-label={labels.moveUp}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => handleMove('down')}
            disabled={isLast || isPending}
            className="text-xs text-nickel hover:text-yale disabled:opacity-30 px-1.5 py-1"
            aria-label={labels.moveDown}
          >
            ↓
          </button>
          <label className="flex items-center gap-1.5 text-xs text-nickel ml-2">
            <input type="checkbox" checked={block.visible} disabled={isPending} onChange={handleToggleVisible} />
            {labels.visibleLabel}
          </label>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-yale font-medium ml-3 px-2 py-1 hover:underline"
          >
            {editing ? labels.cancel : labels.edit}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="border-t border-silver/60 px-4 py-4 bg-[#FAFAFA]">
          <BlockForm block={block} media={media} labels={labels} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </div>
  );
}

function BlockForm({
  block,
  media,
  labels,
  onDone
}: {
  block: BlockDTO;
  media: MediaDTO[];
  labels: Labels;
  onDone: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(block.content);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isLandingBlockType(block.type)) return null;
  const fields = LANDING_BLOCK_FIELDS[block.type as LandingBlockType];

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateBlockContent(block.id, values);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {fields.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={values[field.key]}
          media={media}
          labels={labels}
          onChange={(next) => setValues((prev) => ({ ...prev, [field.key]: next }))}
        />
      ))}

      {error ? <p className="text-xs text-bad">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-yale text-white rounded-lg py-1.5 px-4 text-xs font-medium disabled:opacity-60"
        >
          {isPending ? labels.saving : labels.save}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-nickel px-3 py-1.5 hover:text-quartz">
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  media,
  labels,
  onChange
}: {
  field: LandingFieldDescriptor;
  value: unknown;
  media: MediaDTO[];
  labels: Labels;
  onChange: (next: unknown) => void;
}) {
  const label = labels.fields[field.labelKey] ?? field.key;
  const help = field.helpKey ? labels[field.helpKey as 'highlightHelp' | 'oneLinePerItem'] : undefined;

  if (field.kind === 'text') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-nickel">{label}</span>
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className="border border-silver rounded-lg px-3 py-2 text-sm text-quartz focus:outline-none focus:border-cola"
        />
      </label>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-nickel">{label}</span>
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="border border-silver rounded-lg px-3 py-2 text-sm text-quartz focus:outline-none focus:border-cola"
        />
        {help ? <span className="text-[11px] text-nickel">{help}</span> : null}
      </label>
    );
  }

  if (field.kind === 'list') {
    const items = Array.isArray(value) ? (value as string[]) : [];
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-nickel">{label}</span>
        <textarea
          value={items.join('\n')}
          onChange={(event) =>
            onChange(
              event.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
            )
          }
          rows={3}
          className="border border-silver rounded-lg px-3 py-2 text-sm text-quartz focus:outline-none focus:border-cola"
        />
        {help ? <span className="text-[11px] text-nickel">{help}</span> : null}
      </label>
    );
  }

  // 'milestones'
  const milestones = Array.isArray(value) ? (value as LandingMilestone[]) : [];

  function updateMilestone(index: number, patch: Partial<LandingMilestone>) {
    const next = milestones.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  }

  function removeMilestone(index: number) {
    onChange(milestones.filter((_, i) => i !== index));
  }

  function addMilestone() {
    onChange([...milestones, { year: '', title: '', description: '', mediaAssetId: null }]);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-nickel">{label}</span>
      <div className="flex flex-col gap-3">
        {milestones.map((milestone, index) => (
          <div key={index} className="border border-silver/60 rounded-lg p-3 flex flex-col gap-2 bg-white">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={labels.milestoneYear}
                value={milestone.year}
                onChange={(event) => updateMilestone(index, { year: event.target.value })}
                className="border border-silver rounded-lg px-2.5 py-1.5 text-sm text-quartz"
              />
              <input
                type="text"
                placeholder={labels.milestoneTitle}
                value={milestone.title}
                onChange={(event) => updateMilestone(index, { title: event.target.value })}
                className="border border-silver rounded-lg px-2.5 py-1.5 text-sm text-quartz"
              />
            </div>
            <textarea
              placeholder={labels.milestoneDescription}
              value={milestone.description}
              onChange={(event) => updateMilestone(index, { description: event.target.value })}
              rows={2}
              className="border border-silver rounded-lg px-2.5 py-1.5 text-sm text-quartz"
            />
            <select
              value={milestone.mediaAssetId ?? ''}
              onChange={(event) => updateMilestone(index, { mediaAssetId: event.target.value || null })}
              className="border border-silver rounded-lg px-2.5 py-1.5 text-sm text-quartz"
            >
              <option value="">{labels.milestoneImageNone}</option>
              {media.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.filename}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeMilestone(index)}
              className="text-xs text-bad self-start hover:underline"
            >
              {labels.removeMilestone}
            </button>
          </div>
        ))}
        <button type="button" onClick={addMilestone} className="text-xs text-yale font-medium self-start hover:underline">
          + {labels.addMilestone}
        </button>
      </div>
    </div>
  );
}

function MediaLibrary({ media, labels }: { media: MediaDTO[]; labels: Labels }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await uploadMediaAsset(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      event.currentTarget.reset();
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm(labels.media.deleteConfirm)) return;
    startTransition(async () => {
      await deleteMediaAsset(id);
      router.refresh();
    });
  }

  function handleCopyUrl(id: string) {
    const url = `${window.location.origin}/api/media/${id}`;
    void navigator.clipboard.writeText(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleUpload} className="bg-white border border-silver/60 rounded-xl p-4 flex items-end gap-3">
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-xs text-nickel">{labels.media.uploadLabel}</span>
          <input name="file" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm text-quartz" />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="bg-yale text-white rounded-lg py-2 px-4 text-sm disabled:opacity-60"
        >
          {isPending ? labels.media.uploading : labels.media.uploadCta}
        </button>
      </form>
      {error ? <p className="text-xs text-bad">{error}</p> : null}

      {media.length === 0 ? (
        <p className="text-xs text-nickel">{labels.media.empty}</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {media.map((asset) => (
            <div key={asset.id} className="bg-white border border-silver/60 rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable */}
              <img src={`/api/media/${asset.id}`} alt={asset.filename} className="w-full aspect-video object-cover bg-silver/20" />
              <div className="p-3 flex flex-col gap-2">
                <p className="text-xs text-quartz truncate" title={asset.filename}>
                  {asset.filename}
                </p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => handleCopyUrl(asset.id)} className="text-[11px] text-yale hover:underline">
                    {labels.media.copyUrl}
                  </button>
                  <button type="button" onClick={() => handleDelete(asset.id)} className="text-[11px] text-bad hover:underline">
                    {labels.media.delete}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
