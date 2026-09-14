import { useEffect, useState } from 'react';
import { Sparkles, Star, ArrowRight } from 'lucide-react';

type SplashScreenProps = {
  onFinish: () => void;
};

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  useEffect(() => {
    // Phase 1: Background & particles reveal
    const t1 = setTimeout(() => setPhase(1), 100);
    // Phase 2: Kids jump in
    const t2 = setTimeout(() => setPhase(2), 500);
    // Phase 3: Logo & Text reveal
    const t3 = setTimeout(() => setPhase(3), 1100);
    // Phase 4: Full glow & progress bar complete
    const t4 = setTimeout(() => setPhase(4), 1800);

    // Progress bar animation ticker
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 4;
      });
    }, 80);

    // Auto complete after 3.4 seconds
    const tFinish = setTimeout(() => {
      handleComplete();
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tFinish);
      clearInterval(interval);
    };
  }, []);

  const handleComplete = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onFinish();
    }, 500);
  };

  // Sparkles/Particles setup
  const particles = [
    { top: '15%', left: '12%', color: 'text-amber-300', size: 24, delay: '0s' },
    { top: '25%', left: '82%', color: 'text-pink-300', size: 28, delay: '0.4s' },
    { top: '65%', left: '15%', color: 'text-sky-200', size: 20, delay: '0.8s' },
    { top: '75%', left: '85%', color: 'text-emerald-300', size: 26, delay: '1.2s' },
    { top: '10%', left: '60%', color: 'text-yellow-200', size: 22, delay: '0.2s' },
    { top: '80%', left: '45%', color: 'text-purple-300', size: 24, delay: '0.6s' },
  ];

  return (
    <div
      onClick={handleComplete}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 overflow-hidden bg-gradient-to-br from-sky-400 via-sky-500 to-indigo-600 transition-opacity duration-500 cursor-pointer ${
        isFadingOut ? 'opacity-0 scale-105' : 'opacity-100'
      }`}
    >
      {/* Background Decorative Soft Cloud Lights */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-amber-300/15 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Sparkles & Stars */}
      {particles.map((p, idx) => (
        <div
          key={idx}
          className={`absolute ${p.color} animate-pulse pointer-events-none transition-opacity duration-700`}
          style={{
            top: p.top,
            left: p.left,
            animationDelay: p.delay,
            opacity: phase >= 1 ? 1 : 0,
          }}
        >
          {idx % 2 === 0 ? <Star size={p.size} fill="currentColor" /> : <Sparkles size={p.size} />}
        </div>
      ))}

      {/* Top Header / Skip Button */}
      <div className="w-full flex justify-between items-center text-white/80 z-10">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
          <Sparkles size={14} className="text-yellow-300 animate-spin" />
          <span>Ministerio Infantil</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          className="flex items-center gap-1 text-xs font-medium text-white/90 hover:text-white bg-black/15 hover:bg-black/25 px-3 py-1.5 rounded-full transition-all border border-white/10"
        >
          <span>Saltar</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Center Stage: Interactive Animated Logo & Kids */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto z-10 w-full max-w-lg">
        
        {/* Animated Kids Showcase */}
        <div className="relative mb-2 transition-all duration-700">
          {/* Kids SVG Row with jumping keyframe animations */}
          <div
            className={`transition-all duration-700 ${
              phase >= 2 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-8'
            }`}
          >
            <svg viewBox="0 0 450 140" className="w-72 sm:w-96 h-auto drop-shadow-xl overflow-visible">
              {/* Kid 1: Girl yellow dress */}
              <g className="animate-kid-1" transform="translate(20, 20)">
                <path d="M 8 72 L 2 90 M 24 72 L 30 90" stroke="#FDBA74" strokeWidth="5" strokeLinecap="round"/>
                <ellipse cx="0" cy="91" rx="7" ry="4.5" fill="#EC4899"/>
                <ellipse cx="32" cy="91" rx="7" ry="4.5" fill="#EC4899"/>
                <path d="M 6 44 Q 16 40 26 44 L 32 72 H 0 Z" fill="#FACC15" stroke="#EAB308" strokeWidth="2"/>
                <path d="M 6 47 Q -8 30 -4 16 M 26 47 Q 40 30 36 16" stroke="#FDBA74" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
                <circle cx="-4" cy="15" r="4" fill="#FDBA74"/>
                <circle cx="36" cy="15" r="4" fill="#FDBA74"/>
                <circle cx="16" cy="28" r="16" fill="#FED7AA"/>
                <circle cx="11" cy="27" r="2.2" fill="#1E293B"/>
                <circle cx="21" cy="27" r="2.2" fill="#1E293B"/>
                <path d="M 10 32 Q 16 38 22 32" stroke="#E11D48" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                <circle cx="8" cy="30" r="3" fill="#F472B6" opacity="0.7"/>
                <circle cx="24" cy="30" r="3" fill="#F472B6" opacity="0.7"/>
                <path d="M 2 24 C 2 10 30 10 30 24 Q 16 16 2 24 Z" fill="#78350F"/>
                <path d="M 3 20 C -6 12 -4 28 3 26 Z" fill="#78350F"/>
                <path d="M 29 20 C 38 12 36 28 29 26 Z" fill="#78350F"/>
                <circle cx="3" cy="22" r="3" fill="#EC4899"/>
                <circle cx="29" cy="22" r="3" fill="#EC4899"/>
              </g>

              {/* Kid 2: Boy orange shirt */}
              <g className="animate-kid-2" transform="translate(125, 10)">
                <path d="M 10 74 L 4 94 M 24 74 L 30 94" stroke="#FDBA74" strokeWidth="5" strokeLinecap="round"/>
                <ellipse cx="2" cy="95" rx="7.5" ry="4.5" fill="#10B981"/>
                <ellipse cx="32" cy="95" rx="7.5" ry="4.5" fill="#10B981"/>
                <path d="M 5 56 H 29 V 74 H 20 V 64 H 14 V 74 H 5 Z" fill="#22C55E"/>
                <path d="M 4 40 Q 17 36 30 40 L 29 57 H 5 Z" fill="#EF4444"/>
                <path d="M 5 44 Q -8 28 -2 14 M 29 44 Q 42 28 36 14" stroke="#FDBA74" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
                <circle cx="-2" cy="13" r="4" fill="#FDBA74"/>
                <circle cx="36" cy="13" r="4" fill="#FDBA74"/>
                <circle cx="17" cy="26" r="16" fill="#FED7AA"/>
                <circle cx="12" cy="25" r="2.2" fill="#1E293B"/>
                <circle cx="22" cy="25" r="2.2" fill="#1E293B"/>
                <path d="M 11 30 Q 17 37 23 30" stroke="#B91C1C" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                <path d="M 2 22 C 2 8 32 8 32 22 C 30 14 25 9 17 14 C 10 8 4 14 2 22 Z" fill="#F59E0B"/>
                <path d="M 10 12 L 14 3 M 17 11 L 19 1 M 23 12 L 26 4" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round"/>
              </g>

              {/* Kid 3: Boy cyan shirt */}
              <g className="animate-kid-3" transform="translate(230, 15)">
                <path d="M 10 72 L 6 92 M 22 72 L 26 92" stroke="#FDBA74" strokeWidth="5" strokeLinecap="round"/>
                <ellipse cx="4" cy="93" rx="7" ry="4.5" fill="#3B82F6"/>
                <ellipse cx="28" cy="93" rx="7" ry="4.5" fill="#3B82F6"/>
                <path d="M 5 54 H 27 V 72 H 18 V 62 H 13 V 72 H 5 Z" fill="#1E3A8A"/>
                <path d="M 4 38 Q 16 34 28 38 L 27 55 H 5 Z" fill="#06B6D4"/>
                <path d="M 5 42 Q -6 24 2 10 M 27 42 Q 38 24 30 10" stroke="#FDBA74" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
                <circle cx="2" cy="9" r="4" fill="#FDBA74"/>
                <circle cx="30" cy="9" r="4" fill="#FDBA74"/>
                <circle cx="16" cy="24" r="15.5" fill="#FED7AA"/>
                <circle cx="11" cy="23" r="2.2" fill="#1E293B"/>
                <circle cx="21" cy="23" r="2.2" fill="#1E293B"/>
                <path d="M 10 28 Q 16 35 22 28" stroke="#0369A1" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                <path d="M 2 19 C 2 7 30 7 30 19 C 26 11 18 9 16 12 C 12 9 5 13 2 19 Z" fill="#334155"/>
              </g>

              {/* Kid 4: Girl pink dress */}
              <g className="animate-kid-4" transform="translate(330, 20)">
                <path d="M 10 72 L 4 90 M 24 72 L 30 90" stroke="#FDBA74" strokeWidth="5" strokeLinecap="round"/>
                <ellipse cx="2" cy="91" rx="7" ry="4.5" fill="#8B5CF6"/>
                <ellipse cx="32" cy="91" rx="7" ry="4.5" fill="#8B5CF6"/>
                <path d="M 6 42 Q 17 38 28 42 L 34 72 H 0 Z" fill="#EC4899"/>
                <path d="M 6 45 Q -6 30 0 16 M 28 45 Q 40 30 34 16" stroke="#FDBA74" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
                <circle cx="0" cy="15" r="4" fill="#FDBA74"/>
                <circle cx="34" cy="15" r="4" fill="#FDBA74"/>
                <circle cx="17" cy="26" r="15.5" fill="#FED7AA"/>
                <circle cx="12" cy="25" r="2.2" fill="#1E293B"/>
                <circle cx="22" cy="25" r="2.2" fill="#1E293B"/>
                <path d="M 11 30 Q 17 37 23 30" stroke="#BE185D" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                <path d="M 1 26 C -2 10 36 10 33 26 C 36 44 32 52 30 56 C 28 44 28 22 17 16 C 6 22 6 44 4 56 C 2 52 -1 44 1 26 Z" fill="#9A3412"/>
              </g>
            </svg>
          </div>
        </div>

        {/* Main Logo Image Reveal */}
        <div
          className={`transition-all duration-700 ease-out transform ${
            phase >= 3 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-85 translate-y-6'
          }`}
        >
          <img
            src="/logo.svg"
            alt="Adoración Children Logo"
            className="w-80 sm:w-96 h-auto drop-shadow-2xl filter animate-pulse-glow"
          />
        </div>

        {/* Tagline / Subtitle */}
        <p
          className={`mt-4 text-white font-bold text-lg sm:text-xl tracking-wide text-center drop-shadow transition-all duration-700 ${
            phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          ¡Bienvenidos a la Casa de Dios! 🙏✨
        </p>
      </div>

      {/* Footer Loading Bar & Status */}
      <div className="w-full max-w-sm flex flex-col items-center gap-3 z-10 mb-4">
        <div className="w-full bg-black/20 backdrop-blur-md rounded-full h-3.5 p-0.5 border border-white/20 overflow-hidden shadow-inner">
          <div
            className="bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 h-full rounded-full transition-all duration-150 ease-out shadow-lg"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-white/90 text-xs font-medium">
          <span className="animate-pulse">Cargando aplicación...</span>
          <span className="font-bold text-yellow-300">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
