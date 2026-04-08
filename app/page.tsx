'use client';

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = () => {
    // Simulate login - in real app this would authenticate
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen w-full flex bg-background relative overflow-hidden">
      {/* Abstract Background Graphic */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-20 bg-gradient-to-l from-primary/20 to-transparent"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center mb-10">
            <Image 
              src="/logo.svg" 
              alt="Closechain AI" 
              width={320} 
              height={80}
              className="h-20 w-auto object-contain" 
            />
          </div>
          
          <h2 className="mt-8 text-3xl font-display font-bold tracking-tight text-foreground">
            Stop Searching. Just Ask.
          </h2>
          <p className="mt-2 font-display font-bold tracking-tight text-foreground text-[25px]">
            Chat With Your Space
          </p>

          <div className="mt-10">
            <button
              onClick={handleLogin}
              className="w-full flex justify-between items-center px-6 py-4 border border-transparent text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all hover:-translate-y-0.5"
            >
              Continue with Replit
              <ArrowRight className="w-5 h-5" />
            </button>
            
            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">For General Contractors</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
