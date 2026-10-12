import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, X } from 'lucide-react';
import type { AttachmentMetadata } from '@/types';
import { formatFileSize } from '@/utils/formatDisplay';

interface FileViewerDialogProps {
  open: boolean;
  attachment: AttachmentMetadata | null;
  onClose: () => void;
}

type PreviewKind = 'pdf' | 'image' | 'text' | 'embed';

function resolveFileUrl(url: string): string {
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    /^https?:\/\//i.test(url)
  ) {
    return url;
  }
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

function previewKind(fileType: string, fileName: string): PreviewKind {
  const type = fileType.toLowerCase();
  const name = fileName.toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';

  if (
    type.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)
  ) {
    return 'image';
  }

  if (
    type.startsWith('text/') ||
    type === 'application/json' ||
    type === 'application/xml' ||
    type === 'application/javascript' ||
    /\.(txt|csv|tsv|json|xml|md|markdown|log|html?|css|js|ts|tsx|jsx|yml|yaml|ini|conf|env)$/.test(
      name,
    )
  ) {
    return 'text';
  }

  // Browser / plugin embed for Office, video, audio, and other formats.
  return 'embed';
}

function FilePreview({
  url,
  kind,
  fileName,
}: {
  url: string;
  kind: PreviewKind;
  fileName: string;
}) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== 'text') {
      setTextContent(null);
      setTextError(null);
      return;
    }

    let cancelled = false;
    setTextContent(null);
    setTextError(null);

    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load file contents.');
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setTextContent(text);
      })
      .catch(() => {
        if (!cancelled) setTextError('Could not load this file for text preview.');
      });

    return () => {
      cancelled = true;
    };
  }, [kind, url]);

  if (kind === 'image') {
    return (
      <div className="flex h-full items-center justify-center overflow-auto rounded-md border border-brand-100 bg-white p-4">
        <img
          src={url}
          alt={fileName}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (kind === 'text') {
    if (textError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-brand-200 bg-white px-6 text-center">
          <FileText size={32} className="text-brand-400" aria-hidden />
          <p className="text-sm text-brand-700">{textError}</p>
          <iframe
            title={fileName}
            src={url}
            className="mt-2 h-64 w-full rounded-md border border-brand-100 bg-white"
          />
        </div>
      );
    }

    if (textContent == null) {
      return (
        <div className="flex h-full items-center justify-center rounded-md border border-brand-100 bg-white text-sm text-brand-500">
          Loading preview…
        </div>
      );
    }

    return (
      <pre className="h-full overflow-auto rounded-md border border-brand-100 bg-white p-4 text-xs leading-relaxed whitespace-pre-wrap break-words text-brand-900">
        {textContent || '(Empty file)'}
      </pre>
    );
  }

  // PDF and all other types: embed so the browser can render whatever it supports.
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <iframe
        title={fileName}
        src={url}
        className="min-h-0 w-full flex-1 rounded-md border border-brand-100 bg-white"
      />
      {kind === 'embed' ? (
        <p className="shrink-0 text-center text-xs text-brand-500">
          If this file does not render here, use Download to open it on your device.
        </p>
      ) : null}
    </div>
  );
}

export function FileViewerDialog({
  open,
  attachment,
  onClose,
}: FileViewerDialogProps) {
  const titleId = useId();
  const rawUrl = attachment?.downloadUrl?.trim() || null;
  const url = rawUrl ? resolveFileUrl(rawUrl) : null;
  const kind = attachment
    ? previewKind(attachment.fileType, attachment.fileName)
    : 'embed';

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !attachment) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close file viewer"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-[min(90vh,52rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-brand-100 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-100 px-4 py-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-base font-semibold text-brand-900"
            >
              {attachment.fileName}
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              {formatFileSize(attachment.fileSize)}
              {attachment.fileType ? ` · ${attachment.fileType}` : ''}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {url ? (
              <a
                href={url}
                download={attachment.fileName}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
              >
                <Download size={16} aria-hidden />
                Download
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-brand-500 hover:bg-brand-50 hover:text-brand-800"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-brand-50/60 p-3">
          {!url ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-brand-200 bg-white px-6 text-center">
              <FileText size={32} className="text-brand-400" aria-hidden />
              <p className="text-sm font-medium text-brand-800">
                File is not available to preview
              </p>
              <p className="text-xs text-brand-500">
                This attachment has no file content stored for viewing or download.
              </p>
            </div>
          ) : (
            <FilePreview url={url} kind={kind} fileName={attachment.fileName} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
