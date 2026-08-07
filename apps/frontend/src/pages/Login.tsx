import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Key, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { login, getMe, getOidcStatus } from '../api/auth';
import { useAuthStore } from '../store/authStore';

interface LoginForm {
  email: string;
  password: string;
}

export function Login() {
  const navigate = useNavigate();
  const { login: setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const ssoHandled = useRef(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  useEffect(() => {
    // SSO callback delivers the access token in the URL hash.
    const match = window.location.hash.match(/^#sso=(.+)$/);
    if (match && !ssoHandled.current) {
      ssoHandled.current = true;
      const token = match[1];
      window.history.replaceState(null, '', '/login');
      localStorage.setItem('accessToken', token);
      getMe()
        .then(({ user }) => {
          setAuth(user, token);
          navigate('/', { replace: true });
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          toast.error('SSO sign-in failed');
        });
      return;
    }
    getOidcStatus()
      .then(({ enabled }) => setSsoEnabled(enabled))
      .catch(() => {});
  }, [navigate, setAuth]);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await login(data.email, data.password);
      setAuth(response.user, response.accessToken);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Key className="w-8 h-8 text-primary-600" />
          <h1 className="text-2xl font-bold">Secret Vault</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="input"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="input"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {ssoEnabled && (
          <button
            type="button"
            onClick={() => {
              window.location.href = '/api/v1/auth/oidc/start';
            }}
            className="btn w-full mt-3 border border-gray-300 flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            Datasee SSO로 로그인
          </button>
        )}

        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
