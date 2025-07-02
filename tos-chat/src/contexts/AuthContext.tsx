import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  authToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// API Client
class AuthApiClient {
  private baseUrl = 'https://api.autosnap.cloud/api:JPmhYbHY';

  async signup(name: string, email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(errorData || `Signup failed: ${response.status}`);
    }

    return await response.json();
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(errorData || `Login failed: ${response.status}`);
    }

    return await response.json();
  }

  async getMe(authToken: string) {
    const response = await fetch(`${this.baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user: ${response.status}`);
    }

    return await response.json();
  }
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API client instance
const authApiClient = new AuthApiClient();

// Auth Provider
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    authToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedToken = localStorage.getItem('tos_auth_token');
        
        if (savedToken) {
          // Validate token by fetching user info
          try {
            const userData = await authApiClient.getMe(savedToken);
            setAuthState({
              user: userData,
              authToken: savedToken,
              isLoading: false,
              isAuthenticated: true,
            });
          } catch (error) {
            // Token is invalid, remove it
            localStorage.removeItem('tos_auth_token');
            setAuthState({
              user: null,
              authToken: null,
              isLoading: false,
              isAuthenticated: false,
            });
          }
        } else {
          setAuthState({
            user: null,
            authToken: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthState({
          user: null,
          authToken: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authApiClient.login(email, password);
      const { authToken } = response;
      
      // Get user data
      const userData = await authApiClient.getMe(authToken);
      
      // Save token
      localStorage.setItem('tos_auth_token', authToken);
      
      setAuthState({
        user: userData,
        authToken,
        isLoading: false,
        isAuthenticated: true,
      });

      return { success: true };
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authApiClient.signup(name, email, password);
      const { authToken } = response;
      
      // Get user data
      const userData = await authApiClient.getMe(authToken);
      
      // Save token
      localStorage.setItem('tos_auth_token', authToken);
      
      setAuthState({
        user: userData,
        authToken,
        isLoading: false,
        isAuthenticated: true,
      });

      return { success: true };
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Registration failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('tos_auth_token');
    setAuthState({
      user: null,
      authToken: null,
      isLoading: false,
      isAuthenticated: false,
    });
  };

  const refreshUser = async () => {
    if (!authState.authToken) return;
    
    try {
      const userData = await authApiClient.getMe(authState.authToken);
      setAuthState(prev => ({ ...prev, user: userData }));
    } catch (error) {
      console.error('Failed to refresh user:', error);
      logout();
    }
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export type { User, AuthState, AuthContextType };