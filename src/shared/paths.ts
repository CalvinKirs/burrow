const MD_EXT = /\.(md|markdown|mdown|mkd)$/i;

export function stripHash(url: string): string {
  const i = url.indexOf('#');
  return i === -1 ? url : url.slice(0, i);
}

/** Directory containing `fileUrl`, always with a trailing slash. */
export function dirOf(fileUrl: string): string {
  const u = stripHash(fileUrl);
  return u.slice(0, u.lastIndexOf('/') + 1);
}

/** Parent of a directory url (trailing slash), or null at the filesystem root. */
export function parentDir(dirUrl: string): string | null {
  if (dirUrl === 'file:///') return null;
  const trimmed = dirUrl.replace(/\/$/, '');
  return trimmed.slice(0, trimmed.lastIndexOf('/') + 1);
}

export function isMarkdown(name: string): boolean {
  return MD_EXT.test(name);
}

export function isUnder(url: string, rootDir: string): boolean {
  return url.startsWith(rootDir);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Canonical form of a file url (no fragment, every segment decoded then re-encoded), so urls from
 * the address bar and from Chrome's directory listing compare equal.
 */
export function canonicalUrl(url: string): string {
  const prefix = 'file:///';
  const path = stripHash(url).slice(prefix.length);
  const encode = (seg: string) => encodeURIComponent(safeDecode(seg)).replace(/%3A/gi, ':');
  return prefix + path.split('/').map(encode).join('/');
}

export function relPath(url: string, rootDir: string): string {
  return stripHash(url).slice(rootDir.length).split('/').map(safeDecode).join('/');
}

export function baseName(url: string): string {
  const trimmed = stripHash(url).replace(/\/$/, '');
  const name = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  return name === '' || trimmed === 'file://' ? '/' : safeDecode(name);
}
