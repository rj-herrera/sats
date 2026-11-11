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
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-brand-100 bg-white px-4 lg:hidden">
      <button
        type="button"
        className="rounded-md p-2 text-brand-700 hover:bg-brand-50"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
    </header>
  );
}
