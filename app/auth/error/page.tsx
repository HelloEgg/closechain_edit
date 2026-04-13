import Image from 'next/image'
import Link from 'next/link'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen w-full flex bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center mb-10">
            <Image 
              src="/logo.svg" 
              alt="Closechain AI" 
              width={320} 
              height={80}
              className="h-20 w-auto object-contain" 
            />
          </div>
          
          <div className="bg-card border border-border rounded-xl p-8 shadow-lg">
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">
              Sorry, something went wrong
            </h2>
            
            {params?.error ? (
              <p className="text-sm text-muted-foreground mb-6">
                Error: {params.error}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-6">
                An unspecified error occurred.
              </p>
            )}

            <Link
              href="/auth/login"
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-primary hover:bg-primary/90 transition-all"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
