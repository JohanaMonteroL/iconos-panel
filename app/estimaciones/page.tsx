import { redirect } from "next/navigation";

export default function EstimacionesIndex() {
  // Cualquiera que entre a /estimaciones cae al formulario.
  redirect("/estimaciones/nueva");
}
