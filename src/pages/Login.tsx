import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Loader2, LogIn, Sparkles, Mail, Lock, Heart, Star, Smile } from 'lucide-react';

type Props = {
  onSwitchToRegister: () => void;
};

export default function Login({ onSwitchToRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-sky-100 via-white to-amber-50 flex items-center justify-center px-4 py-8">
      {/* Elementos decorativos de fondo */}
      <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 bg-sky-300/30 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute top-1/4 -right-20 w-80 h-80 bg-amber-300/25 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 w-80 h-80 bg-purple-300/20 rounded-full blur-3xl" />

      <div className="pointer-events-none hidden sm:flex absolute top-12 left-[12%] text-amber-400 animate-float-slow">
        <Star size={32} fill="currentColor" className="opacity-70" />
      </div>
      <div className="pointer-events-none hidden sm:flex absolute bottom-16 left-[15%] text-pink-400 animate-float-reverse">
        <Heart size={28} fill="currentColor" className="opacity-60" />
      </div>
      <div className="pointer-events-none hidden sm:flex absolute top-16 right-[14%] text-purple-400 animate-float-reverse">
        <Sparkles size={32} className="opacity-70" />
      </div>
      <div className="pointer-events-none hidden sm:flex absolute bottom-20 right-[12%] text-emerald-400 animate-float-slow">
        <Smile size={32} className="opacity-70" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border-2 border-sky-100 overflow-hidden">
          {/* Barra superior multicolor inspirada en el logo */}
          <div className="h-2.5 w-full bg-gradient-to-r from-sky-400 via-red-400 via-emerald-400 via-purple-500 to-amber-400" />

          <div className="p-8">
            {/* Logo */}
            <div className="flex justify-center mb-5">
              <div className="p-2 rounded-2xl bg-white transition-transform duration-300 hover:scale-105">
                <img
                  src="/logo.png"
                  alt="Adoración Children Logo"
                  className="h-28 sm:h-32 w-auto object-contain mx-auto"
                />
              </div>
            </div>

            {/* Mensaje de bienvenida divertido y cálido */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 text-xs font-semibold mb-3 shadow-sm">
                <Sparkles size={14} className="text-amber-500" />
                <span>¡Qué alegría tenerte por aquí!</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1.5">
                ¡Hola, bienvenido! 🎉
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Un nuevo día lleno de sonrisas y aventuras nos espera.
                <br />
                <span className="font-medium text-sky-600">Inicia sesión para comenzar</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@iglesia.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none"
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-xl font-semibold shadow-md shadow-sky-200 hover:from-sky-600 hover:to-blue-600 hover:shadow-lg active:scale-[0.99] transition-all disabled:opacity-60 text-sm"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {loading ? 'Abriendo las puertas...' : '¡Entrar a Adoración Children!'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-600">
                ¿Aún no tienes tu cuenta?{' '}
                <button
                  onClick={onSwitchToRegister}
                  className="text-sky-600 font-bold hover:text-sky-700 hover:underline transition-colors"
                >
                  ¡Únete al equipo aquí!
                </button>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs font-medium text-gray-500 mt-5 flex items-center justify-center gap-1.5">
          <span>Adoración Children</span>
          <Heart size={12} className="text-rose-400 fill-rose-400" />
          <span>Control de Asistencia</span>
        </p>
      </div>
    </div>
  );
}
