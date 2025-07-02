import React, { useState } from 'react';
import { Loader, Eye, EyeOff, Mail, Lock } from 'lucide-react';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    const result = await onSubmit(formData.email, formData.password);
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}
      
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="Enter your email"
            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent text-sm disabled:opacity-50"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="Enter your password"
            className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent text-sm disabled:opacity-50"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isLoading}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !formData.email || !formData.password}
        className="w-full bg-[#fe3500] text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-[#e63000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            Signing In...
          </>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
};

export default LoginForm;