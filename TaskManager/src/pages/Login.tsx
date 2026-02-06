import { useState, type SyntheticEvent } from "react";
import { API_URL } from "../config";

type LoginStatus = "idle" | "loading" | "error" | "success";

type LoginResponse = {
  ok: boolean;
  error?: string;
  user?: {
    name?: string;
    email?: string;
    role?: string;
    tenant_id?: string | number;
  };
};

const ALLOWED_DOMAINS = ["gmail.com", "hotmail.com"];

type LoginProps = {
  onGoRegister: () => void;
};

/**
 * Valida si el email pertenece a los dominios permitidos.
 */
function isAllowedEmail(email: string) {
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

/**
 * Valida que el password cumpla reglas minimas de seguridad.
 */
function isValidPassword(password: string) {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const hasLength = password.length >= 8;
  return hasUpper && hasLower && hasNumber && hasSpecial && hasLength;
}

/**
 * Devuelve un mensaje de error si los datos son invalidos.
 */
function validateLogin(tenant: string, email: string, password: string) {
  if (!tenant || !email || !password) {
    return "Completa tenant, email y contrasena.";
  }

  if (!isAllowedEmail(email)) {
    return "El email debe ser @gmail.com o @hotmail.com.";
  }

  if (!isValidPassword(password)) {
    return "La contrasena debe tener mayuscula, minuscula, numero, especial y 8 caracteres.";
  }

  return "";
}

/**
 * Pantalla de acceso principal de la app.
 * Recoge credenciales y las valida contra el backend.
 */
export default function Login({ onGoRegister }: LoginProps) {
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [message, setMessage] = useState("");

  const isLoading = status === "loading";

  // Envia las credenciales al backend y gestiona estados/mensajes del login.
  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateLogin(tenantId, email, password);
    if (validationError) {
      setStatus("error");
      setMessage(validationError);
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: tenantId,
          email,
          password,
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as LoginResponse | null;

      if (!response.ok || !data?.ok) {
        const errorMessage =
          data?.error || "Credenciales invalidas o usuario no registrado.";
        setStatus("error");
        setMessage(errorMessage);
        return;
      }

      const name = data.user?.name || "de nuevo";
      setStatus("success");
      setMessage(`Bienvenido ${name}.`);
    } catch {
      setStatus("error");
      setMessage("No se pudo conectar con el servidor.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-md card p-8">
        <header className="flex items-center gap-3 mb-6">
          <div className="badge">TM</div>
          <div>
            <p className="text-overline">Task Manager</p>
            <h1 className="text-title">Iniciar sesion</h1>
          </div>
        </header>

        <p className="text-subtitle">
          Accede con tu tenant y tus credenciales registradas.
        </p>

        {status === "error" && (
          <div className="alert alert-error mt-4" role="alert">
            {message}
          </div>
        )}

        {status === "success" && (
          <div className="alert alert-success mt-4" role="status">
            {message}
          </div>
        )}

        <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-label">Tenant</span>
            <input
              className="input"
              type="text"
              name="tenant"
              placeholder="tenant_1"
              autoComplete="organization"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-label">Email</span>
            <input
              className="input"
              type="email"
              name="email"
              placeholder="correo@dominio.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-label">Contrasena</span>
            <div className="input-row">
              <input
                className="input input-grow"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="********"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </label>

          <button className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? "Validando..." : "Entrar"}
          </button>
        </form>

        <footer className="flex items-center justify-between mt-6 text-sm">
          <a className="link" href="#">
            Olvidaste tu clave?
          </a>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={onGoRegister}
          >
            No tienes cuenta?
          </button>
        </footer>
      </section>
    </div>
  );
}
