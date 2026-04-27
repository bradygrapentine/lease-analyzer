import { Button } from './system/Button';
import { useColorScheme, type Theme } from './useColorScheme';

const NEXT: Record<Theme, Theme> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const ICON: Record<Theme, string> = {
  system: '🖥',
  light: '☀',
  dark: '🌙',
};

export function ThemeToggle(): JSX.Element {
  const { theme, setTheme } = useColorScheme();
  const next = NEXT[theme];
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${theme} (click for ${next})`}
    >
      <span aria-hidden="true">{ICON[theme]}</span>
    </Button>
  );
}
