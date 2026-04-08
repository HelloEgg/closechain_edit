import Link from 'next/link'
import Image from 'next/image'

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <Image
              src="/logo.svg"
              alt="Closechain AI"
              width={180}
              height={40}
              className="h-10 w-auto"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-lg text-center">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-3">
            Check Your Email
          </h1>
          <p className="text-muted-foreground mb-8">
            We&apos;ve sent you a confirmation email. Please click the link in the email
            to verify your account and complete your registration.
          </p>

          <Link
            href="/auth/login"
            className="inline-block bg-accent hover:bg-accent/90 text-white font-medium px-6 py-3 rounded-lg transition-all shadow-lg shadow-accent/20"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
