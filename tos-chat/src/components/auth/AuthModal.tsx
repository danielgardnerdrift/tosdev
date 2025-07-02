import React, { useState } from 'react';
import { X } from 'lucide-react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import { useAuth } from '../../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'login' }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab);
  const { login, register, isLoading } = useAuth();

  if (!isOpen) return null;

  const handleLogin = async (email: string, password: string) => {
    const result = await login(email, password);
    if (result.success) {
      onClose();
    }
    return result;
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    const result = await register(name, email, password);
    if (result.success) {
      onClose();
    }
    return result;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <img 
              src="https://i.postimg.cc/HxBPZ2Mg/Toss-400-x-100-px-600-x-400-px-2.png" 
              alt="Tos Logo" 
              className="h-6 w-auto"
            />
            <span className="text-lg font-semibold text-slate-800">Welcome to Tos</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'login'
                ? 'text-[#fe3500] border-b-2 border-[#fe3500] bg-[#fe3500]/5'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'register'
                ? 'text-[#fe3500] border-b-2 border-[#fe3500] bg-[#fe3500]/5'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'login' ? (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-slate-800 mb-2">Sign In</h2>
                <p className="text-sm text-slate-600">
                  Welcome back! Sign in to access your saved workspaces and continue building.
                </p>
              </div>
              <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
            </div>
          ) : (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-slate-800 mb-2">Create Account</h2>
                <p className="text-sm text-slate-600">
                  Join Tos to save your workspaces, sync across devices, and unlock advanced features.
                </p>
              </div>
              <RegisterForm onSubmit={handleRegister} isLoading={isLoading} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="text-center text-xs text-slate-500">
            {activeTab === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => setActiveTab('register')}
                  className="text-[#fe3500] hover:underline font-medium"
                >
                  Create one here
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => setActiveTab('login')}
                  className="text-[#fe3500] hover:underline font-medium"
                >
                  Sign in here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;