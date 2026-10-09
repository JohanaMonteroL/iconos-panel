// A diferencia de layout.tsx, un template se vuelve a montar en cada
// navegación: se usa para animar la entrada de cada página del panel.

export default function PanelTemplate({ children }: { children: React.ReactNode }) {
  return <div className="pagina-anim space-y-8">{children}</div>;
}
