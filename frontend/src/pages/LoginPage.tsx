import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../utils/auth';
import { Shield, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      navigate(params.get('redirect') || '/admin', { replace: true });
    } else {
      setError('密码错误，请重试');
      setPassword('');
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">管理员登录</h1>
          <p className="text-sm text-gray-400 mt-1">请输入管理员密码以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="管理员密码"
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  );
}
