import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';

export type AppLanguage = 'en' | 'ja';

const LANGUAGE_STORAGE_KEY = 'sats.language';

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
];

function readStoredLanguage(): AppLanguage {
  try {
    const raw = sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw === 'en' || raw === 'ja') {
      return raw;
    }
  } catch {
    // sessionStorage may be unavailable
  }
  return 'en';
}

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [language, setLanguage] = useState<AppLanguage>(readStoredLanguage);

  useEffect(() => {
    try {
      sessionStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore
    }
    document.documentElement.lang = language === 'ja' ? 'ja' : 'en';
  }, [language]);

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

      <div className="flex items-center gap-2">
        <label htmlFor="app-language" className="sr-only">
          Language
        </label>
        <select
          id="app-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as AppLanguage)}
          className="rounded-md border border-brand-200 bg-white py-1.5 pr-10 pl-2.5 text-sm text-brand-800 hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          title="Language switcher — full translations will follow later"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
