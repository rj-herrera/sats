/** Fixed attachment rules. Template authors do not choose these. */

export const MAX_FILES_PER_FIELD = 5;
export const MAX_FILE_MB = 20;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.csv',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
] as const;

export const FILE_ACCEPT = ALLOWED_FILE_EXTENSIONS.join(',');

export const FILE_FIELD_RULES =
  'Up to 5 files, 20 MB each.';

export function isAllowedDocument(file: File): boolean {
  const name = file.name.toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function validateSelectedFiles(files: File[], reserved = 0): string | null {
  if (reserved + files.length > MAX_FILES_PER_FIELD) {
    return `You can attach up to ${MAX_FILES_PER_FIELD} files.`;
  }
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return `${file.name} must be ${MAX_FILE_MB} MB or smaller.`;
    }
    if (!isAllowedDocument(file)) {
      return `${file.name} is not an allowed document type.`;
    }
  }
  return null;
}

function fileNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Keep files that fit the rules. Stop at the first file that does not. */
export function addPickedFiles(
  current: File[],
  picked: File[],
  reserved = 0,
  existingNames: string[] = [],
): { files: File[]; error: string | null } {
  const names = new Set(
    [...current.map((file) => file.name), ...existingNames].map(fileNameKey),
  );
  const accepted: File[] = [];
  for (const file of picked) {
    if (names.has(fileNameKey(file.name))) {
      return {
        files: [...current, ...accepted],
        error: `${file.name} is already attached.`,
      };
    }
    const error = validateSelectedFiles([...current, ...accepted, file], reserved);
    if (error) {
      return { files: [...current, ...accepted], error };
    }
    names.add(fileNameKey(file.name));
    accepted.push(file);
  }
  return { files: [...current, ...accepted], error: null };
}
