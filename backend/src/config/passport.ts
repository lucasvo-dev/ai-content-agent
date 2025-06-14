import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { getDatabase } from './database';
import { logger } from '@/utils/logger';
import { env } from './env';
import type { UserRole } from '@/types';

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: env.GOOGLE_CLIENT_ID || 'placeholder',
  clientSecret: env.GOOGLE_CLIENT_SECRET || 'placeholder',
  callbackURL: "/api/v1/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;
    const googleId = profile.id;

    if (!email) {
      return done(new Error('No email found in Google profile'), null);
    }

    // Check if using mock mode
    if (env.SUPABASE_URL.includes('placeholder')) {
      // Mock mode for development
      const mockUser = {
        id: `google-mock-${googleId}`,
        email: email.toLowerCase(),
        name: name || 'Google User',
        role: 'user' as UserRole,
        provider: 'google',
        providerId: googleId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('Google SSO login (mock mode)', { email, name });
      return done(null, mockUser);
    }

    // Real database mode
    const db = getDatabase();

    // Check if user exists
    let { data: user, error } = await db
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.error('Database error during Google SSO:', error);
      return done(error, null);
    }

    if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await db
        .from('users')
        .insert({
          email: email.toLowerCase(),
          name: name || 'Google User',
          role: 'user',
          provider: 'google',
          provider_id: googleId,
          is_active: true,
          email_verified: true // Google accounts are pre-verified
        })
        .select('*')
        .single();

      if (createError) {
        logger.error('Failed to create user from Google SSO:', createError);
        return done(createError, null);
      }

      user = newUser;
      logger.info('New user created via Google SSO', { userId: user.id, email });
    } else {
      // Update existing user with Google provider info if not set
      if (!user.provider_id) {
        await db
          .from('users')
          .update({
            provider: 'google',
            provider_id: googleId,
            email_verified: true,
            last_login_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
      
      logger.info('Existing user logged in via Google SSO', { userId: user.id, email });
    }

    return done(null, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      provider: 'google',
      providerId: googleId,
      isActive: user.is_active,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at)
    });

  } catch (error) {
    logger.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

// Microsoft OAuth Strategy
passport.use(new MicrosoftStrategy({
  clientID: env.MICROSOFT_CLIENT_ID || 'placeholder',
  clientSecret: env.MICROSOFT_CLIENT_SECRET || 'placeholder',
  callbackURL: "/api/v1/auth/microsoft/callback",
  scope: ['user.read']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName;
    const name = profile.displayName || `${profile._json?.givenName || ''} ${profile._json?.surname || ''}`.trim();
    const microsoftId = profile.id;

    if (!email) {
      return done(new Error('No email found in Microsoft profile'), null);
    }

    // Check if using mock mode
    if (env.SUPABASE_URL.includes('placeholder')) {
      // Mock mode for development
      const mockUser = {
        id: `microsoft-mock-${microsoftId}`,
        email: email.toLowerCase(),
        name: name || 'Microsoft User',
        role: 'user' as UserRole,
        provider: 'microsoft',
        providerId: microsoftId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('Microsoft SSO login (mock mode)', { email, name });
      return done(null, mockUser);
    }

    // Real database mode
    const db = getDatabase();

    // Check if user exists
    let { data: user, error } = await db
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Database error during Microsoft SSO:', error);
      return done(error, null);
    }

    if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await db
        .from('users')
        .insert({
          email: email.toLowerCase(),
          name: name || 'Microsoft User',
          role: 'user',
          provider: 'microsoft',
          provider_id: microsoftId,
          is_active: true,
          email_verified: true // Microsoft accounts are pre-verified
        })
        .select('*')
        .single();

      if (createError) {
        logger.error('Failed to create user from Microsoft SSO:', createError);
        return done(createError, null);
      }

      user = newUser;
      logger.info('New user created via Microsoft SSO', { userId: user.id, email });
    } else {
      // Update existing user with Microsoft provider info if not set
      if (!user.provider_id) {
        await db
          .from('users')
          .update({
            provider: 'microsoft',
            provider_id: microsoftId,
            email_verified: true,
            last_login_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
      
      logger.info('Existing user logged in via Microsoft SSO', { userId: user.id, email });
    }

    return done(null, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      provider: 'microsoft',
      providerId: microsoftId,
      isActive: user.is_active,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at)
    });

  } catch (error) {
    logger.error('Microsoft OAuth error:', error);
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    if (env.SUPABASE_URL.includes('placeholder')) {
      // Mock mode - just return a basic user object
      const mockUser = {
        id,
        email: 'mock@example.com',
        name: 'Mock User',
        role: 'user' as UserRole,
        isActive: true
      };
      return done(null, mockUser);
    }

    const db = getDatabase();
    const { data: user, error } = await db
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) {
      return done(error, null);
    }

    done(null, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      isActive: user.is_active,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at)
    });
  } catch (error) {
    done(error, null);
  }
});

export default passport; 