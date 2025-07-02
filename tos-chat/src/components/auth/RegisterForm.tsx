import React, { useState } from 'react';
import { Loader, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

interface RegisterFormProps {
  onSubmit: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    const result = await onSubmit(formData.name, formData.email, formData.password);
    if (!result.success) {
      setError(result.error || 'Registration failed');
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
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
          Full Name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="Enter your full name"
            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent text-sm disabled:opacity-50"
            required
          />
        </div>
      </div>

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
            placeholder="Create a password (min. 6 characters)"
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

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
          Confirm Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="Confirm your password"
            className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent text-sm disabled:opacity-50"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={isLoading}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !formData.name || !formData.email || !formData.password || !formData.confirmPassword}
        className="w-full bg-[#fe3500] text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-[#e63000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            Creating Account...
          </>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
};

export default RegisterForm;