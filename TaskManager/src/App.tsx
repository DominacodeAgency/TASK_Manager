import { useState } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";

/**
 * Punto de entrada visual de la app.
 * Controla el cambio entre login y registro.
 */
export default function App() {
  const [view, setView] = useState<"login" | "register">("login");

  // Alterna entre pantallas de acceso y registro.
  function handleSwitch(next: "login" | "register") {
    setView(next);
  }

  if (view === "register") {
    return <Register onGoLogin={() => handleSwitch("login")} />;
  }

  return <Login onGoRegister={() => handleSwitch("register")} />;
}
