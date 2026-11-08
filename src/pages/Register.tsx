import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Loader2, UserPlus, ArrowLeft, Sparkles, Mail, Lock, Heart, Star, Smile } from 'lucide-react';

type Props = {
  onSwitchToLogin: () => void;
};

export default function Register({ onSwitchToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signUp(email, password);
      setSuccess(true);
      setTimeout(onSwitchToLogin, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
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
          <div className="h-2.5 w-full bg-gradient-to-r from-sky-400 via-red-400 via-emerald-400 via-purple-500 to-amber-400" />

          <div className="p-8">
            <button
              onClick={onSwitchToLogin}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-sky-600 transition-colors mb-3"
            >
              <ArrowLeft size={16} /> Volver al inicio
            </button>

            <div className="flex justify-center mb-4">
              <div className="p-2 rounded-2xl bg-white transition-transform duration-300 hover:scale-105">
                <img
                  src="/logo.png"
                  alt="Adoración Children Logo"
                  className="h-24 sm:h-28 w-auto object-contain mx-auto"
                />
              </div>
            </div>

            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-semibold mb-2.5 shadow-sm">
                <Sparkles size={14} className="text-sky-500" />
                <span>¡Bienvenido a la familia!</span>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1">
                Crear tu cuenta 🌟
              </h1>
              <p className="text-gray-500 text-sm">
                Regístrate para gestionar la asistencia de los pequeños
              </p>
            </div>

            {success ? (
              <div className="px-4 py-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <p className="text-sm text-emerald-700 font-semibold">
                  ¡Cuenta creada con éxito! 🎉 Redirigiendo...
                </p>
              </div>
            ) : (
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none"
                    />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
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
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  {loading ? 'Registrando...' : '¡Crear mi cuenta!'}
                </button>
              </form>
            )}

            {!success && (
              <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-600">
                  ¿Ya tienes cuenta?{' '}
                  <button
                    onClick={onSwitchToLogin}
                    className="text-sky-600 font-bold hover:text-sky-700 hover:underline transition-colors"
                  >
                    Inicia sesión
                  </button>
                </p>
              </div>
            )}
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
