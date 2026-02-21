import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-2 md:hidden">
        <h2 className="text-lg font-bold">Czkawka</h2>
      </div>
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  );
}
