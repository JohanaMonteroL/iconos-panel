// Layout raíz para todo el portal de programadores. Las páginas internas
// usan Sidebar; login y cambiar-password no (ellas ponen su propio chrome).

export default function ProgramadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
