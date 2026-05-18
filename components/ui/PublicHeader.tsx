import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function PublicHeader({ showHome = true }: { showHome?: boolean }) {
  return (
    <header
      className="sticky top-0 z-20 border-b"
      style={{
        background: "var(--bg-base)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="container-app h-14 flex items-center justify-between">
        {showHome ? (
          <Link href="/" className="text-body-medium font-semibold">
            ICONOS Panel
          </Link>
        ) : (
          <span className="text-body-medium font-semibold">ICONOS Panel</span>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
