import jwt from 'jsonwebtoken';

import { UnauthorizedError, ServerError } from '@/common/errors/httpErrors';
import config from '@/config';
import logger from '@/lib/logger';
import { redisClient } from '@/lib/redis';
import { UserRepository } from '@/modules/users/data/users.repository';
import { PasswordStatus, type UserApiResponse } from '@/modules/users/models/users.entity';
import { UsersService } from '@/modules/users/services/users.services';

import { PasswordService } from './password.services';
import dayjs from 'dayjs';

const REDIS_TOKEN_INVALIDATION_KEY = 'api:users:token_invalidation:{token}';
const TOKEN_DEFAULT_EXPIRE_SECONDS = 60 * 60 * 24 * 30; // 30 days

let instance: LoginService | null = null;

export class LoginService {
  public readonly usersService: UsersService; // Made public
  private readonly passwordService: PasswordService;

  constructor(
    userRepository: UserRepository = new UserRepository(),
    usersService?: UsersService,
    passwordService?: PasswordService,
  ) {
    this.usersService = usersService ?? new UsersService(userRepository);
    this.passwordService = passwordService ?? new PasswordService(userRepository);
  }

  /**
   * Generates the Redis key for token invalidation.
   * @param token The JWT token.
   * @returns The Redis key string.
   */
  private getRedisInvalidationKey(token: string): string {
    return REDIS_TOKEN_INVALIDATION_KEY.replace('{token}', token);
  }

  /**
   * Authenticates a user by verifying email and password.
   * @param email The user's email.
   * @param password The user's password.
   * @returns The JWT token and user API response.
   */
  async login(email: string, password: string): Promise<{ token: string; user: UserApiResponse }> {
    if (!email || !password) {
      throw new UnauthorizedError('Email and password required.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmailForAuth(normalizedEmail);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    if (!user.isActive) {
      logger.warn(`Login attempt for inactive user ID: ${user.id} (${user.email}).`);
      throw new UnauthorizedError('Account is inactive.');
    }

    if (user.permissionsExpireAt && dayjs(user.permissionsExpireAt).isBefore(dayjs())) {
      logger.warn(
        `Login attempt for user ID: ${user.id} (${user.email}) whose permissions have expired on ${user.permissionsExpireAt.toISOString()}.`,
      );
      throw new UnauthorizedError('Account permissions have expired.');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.error(`Incorrect password for user ID: ${user.id}`);
      throw new UnauthorizedError('Invalid email or password.');
    }

    if (user.passwordStatus === PasswordStatus.VALIDATING) {
      throw new UnauthorizedError('Password validation in progress.');
    }

    const passwordExpired = this.passwordService.isPasswordExpired(user.passwordUpdatedAt);

    if (user.passwordStatus === PasswordStatus.EXPIRED || passwordExpired) {
      if (user.passwordStatus !== PasswordStatus.EXPIRED) {
        await this.passwordService.updatePasswordStatus(user.id, PasswordStatus.EXPIRED);
      }
      const error = new UnauthorizedError('Password expired.');
      error.code = 'ERR_PWD_EXPIRED';
      throw error;
    }

    const token = await this.signToken(user.id, { level: user.level, internal: user.internal });
    const userApi = this.usersService.mapToApiResponse(user);
    if (!userApi) {
      throw new ServerError('Failed to map user data');
    }
    return { user: userApi, token };
  }

  /**
   * Logs out a user by invalidating their token.
   * @param token The JWT token to invalidate.
   */
  async logout(token: string): Promise<void> {
    if (!token) return;
    await this.invalidateToken(token);
  }

  /**
   * Signs a JWT token for a user.
   * @param userId The user ID.
   * @param extraPayload Additional payload to include in the token.
   * @returns The signed JWT token.
   */
  async signToken(userId: number, extraPayload: Record<string, any> = {}): Promise<string> {
    const payload = { sub: userId, ...extraPayload };
    try {
      return jwt.sign(payload, config.JWT_SECRET, { expiresIn: TOKEN_DEFAULT_EXPIRE_SECONDS });
    } catch (error: any) {
      logger.error(error, `Error signing JWT for user ID: ${userId}`);
      throw new ServerError('Could not generate authentication token.');
    }
  }

  /**
   * Invalidates a token by storing it in Redis.
   * @param token The JWT token to invalidate.
   */
  async invalidateToken(token: string): Promise<void> {
    if (!redisClient) {
      logger.error('Redis unavailable for token invalidation.');
      throw new ServerError('Authentication service temporarily unavailable.');
    }
    const redisKey = this.getRedisInvalidationKey(token);
    try {
      await redisClient.setEx(redisKey, TOKEN_DEFAULT_EXPIRE_SECONDS, 'invalidated');
    } catch (error) {
      logger.error(error, `Error invalidating token: ${token.substring(0, 10)}...`);
      throw new ServerError('Error during logout.');
    }
  }

  /**
   * Checks if a token has been invalidated.
   * @param token The JWT token to check.
   * @returns True if invalidated, false if valid, or null if unable to check.
   */
  async isTokenInvalidated(token: string): Promise<boolean | null> {
    if (!redisClient || !redisClient.isReady) {
      logger.error('Redis client not available or not ready for token invalidation check.');
      return null;
    }
    const redisKey = this.getRedisInvalidationKey(token);
    try {
      const res = await redisClient.get(redisKey);
      const isInvalidated = !!res;
      logger.debug(
        `Token invalidation check for key ${redisKey}: ${isInvalidated ? 'Invalidated' : 'Valid'}`,
      );
      return isInvalidated;
    } catch (error) {
      logger.error(error, `Redis error checking token invalidation for key ${redisKey}`);
      return null;
    }
  }

  /**
   * Generates a new token for a given user.
   * @param userId The user ID.
   * @returns An object containing the new token and its expiration time in seconds.
   */
  async generateTokenForUser(userId: number): Promise<{ token: string; expiresIn: number }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      // Defensive check, though findById should throw if not found
      throw new ServerError(`User not found for ID ${userId} when generating token.`);
    }
    const token = await this.signToken(user.id, { level: user.level, internal: user.internal });
    return { token, expiresIn: TOKEN_DEFAULT_EXPIRE_SECONDS };
  }

  /**
   * Updates an expired password for a user and returns a new token.
   * @param email The user's email.
   * @param newPassword The new password.
   * @param referer Optional referer for context.
   * @returns The new JWT token.
   */
  async updateExpiredPassword(
    email: string,
    newPassword: string,
    referer?: string,
  ): Promise<string> {
    const success = await this.passwordService.updatePassword({
      email,
      password: newPassword,
      referer,
    });
    if (!success) {
      throw new ServerError('Failed to update expired password');
    }

    const user = await this.usersService.findByEmailForAuth(email);
    if (!user) {
      throw new ServerError('Failed to fetch user after password update');
    }

    return await this.signToken(user.id, { level: user.level, internal: user.internal });
  }

  /**
   * Returns a singleton instance of LoginService.
   * @returns The LoginService instance.
   */
  static getInstance(): LoginService {
    if (!instance) {
      instance = new LoginService(new UserRepository());
    }
    return instance;
  }
}
