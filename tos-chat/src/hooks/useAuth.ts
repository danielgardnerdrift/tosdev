import { useAuth as useAuthContext } from '../contexts/AuthContext';

// Re-export the hook from context for convenience
export const useAuth = useAuthContext;

// Additional auth-related hooks can be added here
export default useAuth;