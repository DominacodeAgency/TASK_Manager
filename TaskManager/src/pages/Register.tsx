import { useState, type SyntheticEvent } from "react";
import { API_URL } from "../config";

type RegisterStatus = "idle" | "loading" | "error" | "success";

type RegisterResponse = {
  ok: boolean;
  error?: string;
};

type RegisterProps = {
  onGoLogin: () => void;
};

const ALLOWED_DOMAINS = ["gmail.com", "hotmail.com"];

const PHONE_COUNTRIES = [
  { code: "+34", label: "Espana" },
  { code: "+1", label: "Estados Unidos" },
  { code: "+52", label: "Mexico" },
  { code: "+54", label: "Argentina" },
  { code: "+57", label: "Colombia" },
  { code: "+51", label: "Peru" },
  { code: "+56", label: "Chile" },
  { code: "+593", label: "Ecuador" },
];

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
 * Valida que el nombre tenga solo letras y espacios.
 */
function isValidName(name: string) {
  return /^[\p{L}\s'-]{2,}$/u.test(name);
}

/**
 * Valida telefono en formato numerico con longitud razonable.
 */
function isValidPhone(phone: string) {
  return /^\d{7,15}$/.test(phone);
}

/**
 * Devuelve un mensaje de error si los datos son invalidos.
 */
function validateRegister(
  tenant: string,
  name: string,
  email: string,
  password: string,
  confirm: string,
  phone: string,
) {
  if (!tenant || !name || !email || !password || !confirm || !phone) {
    return "Completa todos los campos.";
  }

  if (!isValidName(name)) {
    return "El nombre no puede tener numeros ni simbolos.";
  }

  if (!isAllowedEmail(email)) {
    return "El email debe ser @gmail.com o @hotmail.com.";
  }

  if (!isValidPassword(password)) {
    return "La contrasena debe tener mayuscula, minuscula, numero, especial y 8 caracteres.";
  }

  if (password !== confirm) {
    return "Las contrasenas no coinciden.";
  }

  if (!isValidPhone(phone)) {
    return "El telefono debe tener entre 7 y 15 numeros.";
  }

  return "";
}

/**
 * Pantalla de registro de usuarios.
 * Recoge datos basicos y los envia al backend.
 */
export default function Register({ onGoLogin }: RegisterProps) {
  const [tenantId, setTenantId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState(
    PHONE_COUNTRIES[0]?.code || "+34",
  );
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<RegisterStatus>("idle");
  const [message, setMessage] = useState("");

  const isLoading = status === "loading";

  // Envia el formulario de registro al backend y valida campos basicos.
  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanPhone = phone.replace(/\s+/g, "");
    const validationError = validateRegister(
      tenantId,
      name,
      email,
      password,
      confirm,
      cleanPhone,
    );

    if (validationError) {
      setStatus("error");
      setMessage(validationError);
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: tenantId,
          name,
          email,
          phone: `${countryCode}${cleanPhone}`,
          country_code: countryCode,
          password,
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as RegisterResponse | null;

      if (!response.ok || !data?.ok) {
        const errorMessage = data?.error || "No se pudo registrar.";
        setStatus("error");
        setMessage(errorMessage);
        return;
      }

      setStatus("success");
      setMessage("Registro completado. Ya puedes iniciar sesion.");
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
            <h1 className="text-title">Crear cuenta</h1>
          </div>
        </header>

        <p className="text-subtitle">
          Registra tu usuario y accede a los modulos habilitados.
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
            <span className="text-label">Nombre</span>
            <input
              className="input"
              type="text"
              name="name"
              placeholder="Nombre completo"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-label">Email</span>
            <input
              className="input"
              type="email"
              name="email"
              placeholder="correo@gmail.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-label">Telefono</span>
            <div className="input-row">
              <select
                className="input input-select"
                name="country"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
              >
                {PHONE_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label} ({country.code})
                  </option>
                ))}
              </select>
              <input
                className="input input-grow"
                type="tel"
                name="phone"
                placeholder="600123123"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-label">Contrasena</span>
            <div className="input-row">
              <input
                className="input input-grow"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="********"
                autoComplete="new-password"
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

          <label className="flex flex-col gap-2">
            <span className="text-label">Repite contrasena</span>
            <div className="input-row">
              <input
                className="input input-grow"
                type={showConfirm ? "text" : "password"}
                name="confirm"
                placeholder="********"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setShowConfirm((value) => !value)}
              >
                {showConfirm ? "Ocultar" : "Ver"}
              </button>
            </div>
          </label>

          <button className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <footer className="flex items-center justify-between mt-6 text-sm">
          <span className="text-muted">Ya tienes cuenta?</span>
          <button className="btn btn-ghost" type="button" onClick={onGoLogin}>
            Volver al login
          </button>
        </footer>
      </section>
    </div>
  );
}
