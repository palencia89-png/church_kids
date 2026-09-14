import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Loader2, UserPlus, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';

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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-sky-100 p-8">
          <button
            onClick={onSwitchToLogin}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
          >
            <ArrowLeft size={16} /> Volver
          </button>

          <div className="flex justify-center mb-4">
            <Logo size="lg" animated />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Crear cuenta</h1>
          <p className="text-gray-500 text-center text-sm mb-6">Registrate para gestionar la asistencia</p>

          {success ? (
            <div className="px-4 py-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <p className="text-sm text-emerald-700 font-medium">
                Cuenta creada exitosamente. Redirigiendo...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Correo electronico</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@iglesia.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contrasena</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar contrasena</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                />
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600 transition-colors disabled:opacity-60 text-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {loading ? 'Registrando...' : 'Crear cuenta'}
              </button>
            </form>
          )}

          {!success && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Ya tienes cuenta?{' '}
                <button
                  onClick={onSwitchToLogin}
                  className="text-sky-500 font-medium hover:text-sky-600 transition-colors"
                >
                  Inicia sesion
                </button>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Ministerio de Ninos - Control de Asistencia
        </p>
      </div>
    </div>
  );
}
