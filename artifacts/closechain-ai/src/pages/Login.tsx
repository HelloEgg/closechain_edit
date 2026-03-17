import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, HardHat, Wrench, Building2, ArrowLeft, MailCheck } from "lucide-react";
import logoFull from "@assets/ChatGPT_Image_Mar_3,_2026,_09_59_00_AM_1773689296535.png";

type Role = "gc" | "subcontractor" | "client";
type Step = "role" | "auth" | "verify";
type Mode = "signin" | "signup";

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

const ROLES = [
  {
    id: "gc" as Role,
    label: "General Contractor",
    description: "Manage closeout packages and track subcontractor documents",
    icon: HardHat,
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    activeColor: "bg-blue-50 border-blue-500 ring-2 ring-blue-500/30",
    iconColor: "text-blue-600",
  },
  {
    id: "subcontractor" as Role,
    label: "Sub Contractor",
    description: "Submit closeout documents for your assigned trades",
    icon: Wrench,
    color: "bg-orange-50 border-orange-200 hover:border-orange-400",
    activeColor: "bg-orange-50 border-orange-500 ring-2 ring-orange-500/30",
    iconColor: "text-orange-600",
  },
  {
    id: "client" as Role,
    label: "Client",
    description: "Review completed project closeout packages",
    icon: Building2,
    color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
    activeColor: "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30",
    iconColor: "text-emerald-600",
  },
];

export default function Login() {
  const { signInWithEmail, signUpWithEmail, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("role");
  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<Role | null>(null);
  const [verifyEmail, setVerifyEmail] = useState("");

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

  const selectedRole = ROLES.find(r => r.id === role);

  const clearForm = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPassword(""); setConfirmPassword(""); setErrors({});
  };

  const switchMode = (next: Mode) => { clearForm(); setMode(next); };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (mode === "signup") {
      if (!firstName.trim()) e.firstName = "First name is required.";
      if (!lastName.trim()) e.lastName = "Last name is required.";
    }
    if (!email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address.";
    if (!password) e.password = "Password is required.";
    else if (mode === "signup" && password.length < 8) e.password = "Password must be at least 8 characters.";
    if (mode === "signup" && password && confirmPassword !== password) e.confirmPassword = "Passwords do not match.";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }
    setErrors({});
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const result = await signUpWithEmail(firstName.trim(), lastName.trim(), email.trim(), password, role ?? undefined);
        if (result.needsVerification) {
          setVerifyEmail(result.email);
          setStep("verify");
        }
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err) {
      const msg = (err as Error).message || "Something went wrong.";
      setErrors({ form: msg });
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
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">

          <div className="flex items-center mb-6">
            <img src={logoFull} alt="Closechain AI" className="h-36 w-auto -ml-6" />
          </div>

          {/* ── STEP 1: Role Selection ───────────────────────────── */}
          {step === "role" && (
            <>
              <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">Who are you?</h2>
              <p className="mt-2 text-sm text-muted-foreground mb-6">Select your role to get started.</p>

              <div className="space-y-3">
                {ROLES.map(r => {
                  const Icon = r.icon;
                  const isSelected = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected ? r.activeColor : r.color} cursor-pointer`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-2 rounded-lg bg-white/70 ${r.iconColor}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{r.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                        </div>
                        {isSelected && (
                          <div className="ml-auto mt-0.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${r.iconColor.replace("text-", "bg-").replace("-600", "-100")} border-2 ${r.iconColor.replace("text-", "border-")}`}>
                              <div className={`w-2.5 h-2.5 rounded-full ${r.iconColor.replace("text-", "bg-")}`} />
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!role}
                onClick={() => setStep("auth")}
                className="mt-6 w-full flex justify-between items-center px-6 py-3.5 border border-transparent text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="mt-6 relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-background text-muted-foreground">For construction professionals</span></div>
              </div>
            </>
          )}

          {/* ── STEP 2: Sign In / Sign Up ────────────────────────── */}
          {step === "auth" && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button type="button" onClick={() => setStep("role")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                {selectedRole && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${selectedRole.iconColor} bg-white border`}>
                    <selectedRole.icon className="w-3.5 h-3.5" />
                    {selectedRole.label}
                  </span>
                )}
              </div>

              <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
                {mode === "signin" ? "Sign in" : "Create account"}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground mb-6">
                {mode === "signin"
                  ? "Welcome back. Enter your credentials to continue."
                  : "Set up your Closechain AI account."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">First name</label>
                      <input type="text" autoComplete="given-name" value={firstName} onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: undefined })); }} placeholder="Jane" className={inputClass("firstName")} />
                      {errors.firstName && <p className="mt-1 text-xs text-destructive">{errors.firstName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Last name</label>
                      <input type="text" autoComplete="family-name" value={lastName} onChange={e => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: undefined })); }} placeholder="Smith" className={inputClass("lastName")} />
                      {errors.lastName && <p className="mt-1 text-xs text-destructive">{errors.lastName}</p>}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email address</label>
                  <input type="email" autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }} placeholder="you@company.com" className={inputClass("email")} />
                  {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} className={`${inputClass("password")} pr-10`} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
                </div>

                {mode === "signup" && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Confirm password</label>
                    <input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: undefined })); }} placeholder="Repeat your password" className={inputClass("confirmPassword")} />
                    {errors.confirmPassword && <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p>}
                  </div>
                )}

                {errors.form && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{errors.form}</p>
                )}

                <button type="submit" disabled={submitting} className="w-full flex justify-between items-center px-6 py-3.5 border border-transparent text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {submitting
                    ? <><span>{mode === "signin" ? "Signing in…" : "Creating account…"}</span><Loader2 className="w-5 h-5 animate-spin" /></>
                    : <><span>{mode === "signin" ? "Sign in" : "Create account"}</span><ArrowRight className="w-5 h-5" /></>
                  }
                </button>
              </form>

              <div className="mt-5 text-center text-sm text-muted-foreground">
                {mode === "signin"
                  ? <>Don't have an account? <button onClick={() => switchMode("signup")} className="text-primary font-semibold hover:underline">Create one</button></>
                  : <>Already have an account? <button onClick={() => switchMode("signin")} className="text-primary font-semibold hover:underline">Sign in</button></>
                }
              </div>
            </>
          )}

          {/* ── STEP 3: Check your inbox ─────────────────────────── */}
          {step === "verify" && (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <MailCheck className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">Check your inbox</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                We sent a verification link to <span className="font-medium text-foreground">{verifyEmail}</span>.
                Click the link in that email to activate your account.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                Don't see it? Check your spam folder. The link expires in 24 hours.
              </p>
              <button
                type="button"
                onClick={() => { setStep("auth"); setMode("signin"); }}
                className="mt-8 text-sm text-primary hover:underline font-medium"
              >
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
