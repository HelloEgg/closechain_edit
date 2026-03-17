import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import logoFull from "@assets/ChatGPT_Image_Mar_3,_2026,_09_59_00_AM_1773689296535.png";

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

export default function Login() {
  const { signInWithEmail, signUpWithEmail, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) setLocation("/dashboard");
  }, [isAuthenticated, setLocation]);

  if (isLoading) return null;

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setErrors({});
    setShowPassword(false);
  };

  const switchMode = (next: "signin" | "signup") => {
    resetForm();
    setMode(next);
  };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (mode === "signup") {
      if (!firstName.trim()) e.firstName = "First name is required.";
      if (!lastName.trim()) e.lastName = "Last name is required.";
    }
    if (!email.trim()) {
      e.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = "Enter a valid email address.";
    }
    if (!password) {
      e.password = "Password is required.";
    } else if (mode === "signup" && password.length < 8) {
      e.password = "Password must be at least 8 characters.";
    }
    if (mode === "signup" && password && confirmPassword !== password) {
      e.confirmPassword = "Passwords do not match.";
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(firstName.trim(), lastName.trim(), email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err) {
      const msg = (err as Error).message || "Something went wrong.";
      if (mode === "signup" && msg.toLowerCase().includes("email")) {
        setErrors({ email: msg });
      } else if (mode === "signup" && msg.toLowerCase().includes("password")) {
        setErrors({ password: msg });
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: keyof FieldErrors) =>
    `w-full px-3 py-2.5 rounded-lg border text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-colors ${
      errors[field]
        ? "border-destructive focus:ring-destructive/50 focus:border-destructive"
        : "border-border focus:ring-primary/50 focus:border-primary"
    }`;

  return (
    <div className="min-h-screen w-full flex bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <img
          src={`${import.meta.env.BASE_URL}images/login-hero.png`}
          alt="Interior construction architecture"
          className="absolute right-0 bottom-0 w-1/2 h-full object-cover opacity-20 object-left mix-blend-multiply"
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center mb-6">
            <img src={logoFull} alt="Closechain AI" className="h-36 w-auto -ml-6" />
          </div>

          <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Manage closeout packages, track subcontractor documents, and streamline project handover."
              : "Get started managing your construction closeout packages."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">First name</label>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={e => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: undefined })); }}
                    placeholder="Jane"
                    className={inputClass("firstName")}
                  />
                  {errors.firstName && <p className="mt-1 text-xs text-destructive">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Last name</label>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={e => { setLastName(e.target.value); setErrors(prev => ({ ...prev, lastName: undefined })); }}
                    placeholder="Smith"
                    className={inputClass("lastName")}
                  />
                  {errors.lastName && <p className="mt-1 text-xs text-destructive">{errors.lastName}</p>}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email address</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                placeholder="you@company.com"
                className={inputClass("email")}
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
                  className={`${inputClass("password")} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Confirm password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: undefined })); }}
                  placeholder="Repeat your password"
                  className={inputClass("confirmPassword")}
                />
                {errors.confirmPassword && <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p>}
              </div>
            )}

            {errors.form && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{errors.form}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-between items-center px-6 py-3.5 border border-transparent text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {submitting ? (
                <>
                  <span>{mode === "signin" ? "Signing in…" : "Creating account…"}</span>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </>
              ) : (
                <>
                  <span>{mode === "signin" ? "Sign in" : "Create account"}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button onClick={() => switchMode("signup")} className="text-primary font-semibold hover:underline">
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => switchMode("signin")} className="text-primary font-semibold hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">For General Contractors</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
