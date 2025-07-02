// services/session.js - Session Management Service
export class SessionService {
    constructor() {
      this.sessions = new Map();
      this.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT_MS) || 24 * 60 * 60 * 1000; // 24 hours
      
      // Clean up expired sessions every hour
      setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
    }
  
    createSession(sessionData) {
      const sessionId = this.generateSessionId();
      const session = {
        session_id: sessionId,
        ...sessionData,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString(),
        expires_at: new Date(Date.now() + this.sessionTimeout).toISOString()
      };
      
      this.sessions.set(sessionId, session);
      
      console.log(`Session created: ${sessionId} for instance: ${sessionData.instance_domain}`);
      
      return session;
    }
  
    getSession(sessionId) {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        return null;
      }
      
      // Check if session has expired
      if (new Date() > new Date(session.expires_at)) {
        this.sessions.delete(sessionId);
        console.log(`Expired session removed: ${sessionId}`);
        return null;
      }
      
      return session;
    }
  
    updateLastAccessed(sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.last_accessed = new Date().toISOString();
        // Extend expiration time
        session.expires_at = new Date(Date.now() + this.sessionTimeout).toISOString();
        this.sessions.set(sessionId, session);
      }
    }
  
    deleteSession(sessionId) {
      const deleted = this.sessions.delete(sessionId);
      if (deleted) {
        console.log(`Session deleted: ${sessionId}`);
      }
      return deleted;
    }
  
    getSessionCount() {
      return this.sessions.size;
    }
  
    getAllSessionIds() {
      return Array.from(this.sessions.keys());
    }
  
    cleanupExpiredSessions() {
      const now = new Date();
      let cleanedCount = 0;
      
      for (const [sessionId, session] of this.sessions.entries()) {
        if (now > new Date(session.expires_at)) {
          this.sessions.delete(sessionId);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired sessions`);
      }
    }
  
    generateSessionId() {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 15);
      return `tos_${timestamp}_${randomPart}`;
    }
  
    // List all current sessions for debugging
    listSessions() {
      const sessions = [];
      for (const [sessionId, session] of this.sessions.entries()) {
        sessions.push({
          session_id: sessionId,
          instance_domain: session.instance_domain,
          workspace_id: session.workspace_id,
          created_at: session.created_at,
          expires_at: session.expires_at
        });
      }
      return sessions;
    }

    // Debug method for development
    getSessionDebugInfo(sessionId) {
      const session = this.sessions.get(sessionId);
      
      return {
        session_id: sessionId,
        exists: !!session,
        total_sessions: this.sessions.size,
        session_data: session ? {
          instance_domain: session.instance_domain,
          workspace_id: session.workspace_id,
          created_at: session.created_at,
          last_accessed: session.last_accessed,
          expires_at: session.expires_at,
          time_until_expiry: session ? 
            Math.max(0, new Date(session.expires_at) - new Date()) : 0
        } : null
      };
    }
  }