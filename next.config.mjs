/** @type {import('next').NextConfig} */
const nextConfig = {
  // El Router Cache del lado del cliente (App Router) reutiliza por
  // defecto la respuesta de una ruta dinámica hasta 30s aunque el server
  // ya tenga datos nuevos (revalidatePath solo invalida el caché del
  // servidor, no las entradas que el navegador ya trae cacheadas). Eso es
  // justo lo que causaba: un proyecto recién creado sin aparecer todavía
  // en otros selectores, o una parcialidad eliminada que seguía viéndose
  // en el tablero hasta salir y volver a entrar. En 0 siempre se revalida
  // contra el servidor al navegar.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
