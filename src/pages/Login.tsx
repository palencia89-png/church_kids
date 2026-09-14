import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Loader2, LogIn } from 'lucide-react';
import Logo from '../components/Logo';

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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-sky-100 p-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" animated />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Bienvenido</h1>
          <p className="text-gray-500 text-center text-sm mb-6">Inicia sesion en tu cuenta</p>

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
              {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {loading ? 'Iniciando...' : 'Iniciar sesion'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              No tienes cuenta?{' '}
              <button
                onClick={onSwitchToRegister}
                className="text-sky-500 font-medium hover:text-sky-600 transition-colors"
              >
                Registrate aqui
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Ministerio de Ninos - Control de Asistencia
        </p>
      </div>
    </div>
  );
}
