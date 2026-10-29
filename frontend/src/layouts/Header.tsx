import { useEffect } from 'react';
import { Menu } from 'lucide-react';

const LANGUAGE_STORAGE_KEY = 'sats.language';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  useEffect(() => {
    document.documentElement.lang = 'en';
    try {
      sessionStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // sessionStorage may be unavailable
    }
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-brand-100 bg-white px-4 lg:px-6">
      <button
        type="button"
        className="rounded-md p-2 text-brand-700 hover:bg-brand-50 lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Spacer — page titles live in the main content, not the header */}
      <div className="min-w-0 flex-1" />
    </header>
  );
}
