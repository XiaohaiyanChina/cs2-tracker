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
      <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="w-10 h-10 bg-accent/15 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <h1 className="text-base font-bold text-text">管理员登录</h1>
          <p className="text-xs text-muted mt-1">请输入管理员密码</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="管理员密码"
              autoFocus
              className="w-full bg-bg border border-border rounded-md px-3 py-2 pr-10 text-sm text-text placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-danger text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-accent text-white rounded-md text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  );
}
