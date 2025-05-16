import { randomUUID } from 'crypto';

import dayjs from 'dayjs';
import { type FindOptionsWhere } from 'typeorm';

import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ServerError,
} from '@/common/errors/httpErrors';
import { AuthorizationUtils } from '@/common/utils/AuthorizationUtils';
import logger from '@/lib/logger';
import { PasswordService } from '@/modules/auth/services/password.services';

import { UserRepository } from '../data/users.repository';
import {
  type CreateUserInput,
  type UpdateUserInput,
  type UserApiResponse,
  SecurityLevel,
  PasswordStatus,
  type User,
  validationInputErrors,
} from '../models/users.entity';

import { type Profile as GoogleProfile } from 'passport-google-oauth20';

let instance: UsersService | null = null;

export class UsersService {
  private readonly userRepository: UserRepository;
  private readonly passwordService: PasswordService;

  constructor(
    userRepository: UserRepository = new UserRepository(),
    passwordService: PasswordService = new PasswordService(userRepository),
  ) {
    this.userRepository = userRepository;
    this.passwordService = passwordService;
  }

  /**
   * Maps a User entity to an API response object.
   * @param user The user entity to map.
   * @returns The mapped API response or null if user is null.
   */
  mapToApiResponse(user: User | null): UserApiResponse | null {
    if (!user) return null;
    const apiUser = user.toApi() as UserApiResponse;
    if (user.createdAt) apiUser.createdTime = user.createdAt;
    if (user.updatedAt) apiUser.updatedTime = user.updatedAt;
    return apiUser;
  }

  /**
   * Retrieves a user by their ID.
   * @param id The user ID.
   * @returns The user API response.
   */
  async findById(id: number): Promise<UserApiResponse> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) throw new NotFoundError(`User with id ${id} not found.`);
      const apiResponse = this.mapToApiResponse(user);
      if (!apiResponse) {
        throw new ServerError(`Failed to map found user with id ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ServerError(`Error finding user with id ${id} ${error}`);
    }
  }

  /**
   * Retrieves a user by their email.
   * @param email The user's email address.
   * @returns The user API response.
   */
  async findByEmail(email: string): Promise<UserApiResponse> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) throw new NotFoundError(`User with email ${email} not found.`);

      const apiResponse = this.mapToApiResponse(user);
      if (!apiResponse) {
        throw new ServerError(`Failed to map found user with email ${email} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        throw error;
      }
      throw new ServerError(`Error finding user with email ${email}: ${error}`);
    }
  }

  /**
   * Retrieves a user by email for authentication, including password.
   * @param email The user's email address.
   * @returns The user entity or null if not found.
   */
  async findByEmailForAuth(email: string): Promise<User | null> {
    try {
      return await this.userRepository.findByEmailWithPassword(email);
    } catch (error) {
      logger.error(`Error finding user for auth with email ${email}: ${error}`);
      return null;
    }
  }

  /**
   * Retrieves users, optionally paginated and filtered by the requesting user's rights.
   * @param options Optional request context including pagination.
   * @returns Array of user API responses.
   */
  async findAll(options?: { limit?: number; offset?: number }): Promise<UserApiResponse[]> {
    try {
      const where: FindOptionsWhere<User> = {};
      const { users } = await this.userRepository.findAll({
        where,
        skip: options?.offset,
        take: options?.limit,
      });
      return users.map((user) => this.mapToApiResponse(user)).filter(Boolean) as UserApiResponse[];
    } catch (error) {
      throw new ServerError(`Error finding all users ${error}`);
    }
  }

  /**
   * Creates a new user or reactivates a previously deleted user.
   * @param input The user creation input.
   * @param options Optional request context.
   * @returns The created or reactivated user API response.
   */
  async create(input: CreateUserInput): Promise<UserApiResponse> {
    const {
      password,
      email,
      permissions,
      permissionsExpireAt,
      isActive,
      level: inputLevel,
      ...restData
    } = input;
    if (!email) {
      throw new BadRequestError('Email is required.');
    }
    if (!password) {
      throw new BadRequestError('Password is required.');
    }
    const lowerCaseEmail = email.toLowerCase().trim();
    if (!this.passwordService.isPasswordValid(password)) {
      throw new BadRequestError(
        'Password does not meet complexity requirements (min. 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character).',
      );
    }

    const existingActiveUser = await this.userRepository.findByEmail(lowerCaseEmail);
    if (existingActiveUser) {
      throw new BadRequestError('Email address is already in use by an active user.');
    }

    const assignedLevel: SecurityLevel = SecurityLevel.USER;
    const assignedInternal: boolean = false;

    if (inputLevel !== undefined && inputLevel !== SecurityLevel.USER) {
      logger.warn(
        `Attempt to set level to ${inputLevel} during public user creation for ${lowerCaseEmail}. Overriding to ${SecurityLevel.USER}.`,
      );
    }
    if (restData.internal === true) {
      logger.warn(
        `Attempt to set internal to true during public user creation for ${lowerCaseEmail}. Overriding to false.`,
      );
    }

    const finalRestData = { ...restData, internal: assignedInternal };

    try {
      const hashedPassword = await this.passwordService.hashPassword(password);
      const encodedOverrides = AuthorizationUtils.encodePermissionsToString(permissions ?? {});
      const deletedUser = await this.userRepository.findDeletedByEmail(lowerCaseEmail);
      let userEntity: User;

      const userData = {
        ...finalRestData,
        level: assignedLevel,
        email: lowerCaseEmail,
        password: hashedPassword,
        passwordStatus: PasswordStatus.ACTIVE,
        passwordUpdatedAt: new Date(),
        authorisationOverrides: encodedOverrides,
        permissionsExpireAt: permissionsExpireAt ? dayjs(permissionsExpireAt).toDate() : null,
        isActive: isActive === undefined ? true : isActive,
        uid: randomUUID(),
      };

      if (deletedUser) {
        logger.info(
          `Reactivating deleted user with email ${lowerCaseEmail} (ID: ${deletedUser.id})`,
        );
        Object.assign(deletedUser, userData);
        deletedUser.deletedAt = null;
        deletedUser.uid = deletedUser.uid ?? randomUUID();
        userEntity = deletedUser;
      } else {
        userEntity = this.userRepository.create(userData);
      }

      if (!userEntity.isValid()) {
        throw new BadRequestError(
          `User data is invalid. Errors: ${validationInputErrors.join(', ')}`,
        );
      }
      const savedUser = await this.userRepository.save(userEntity);
      logger.info(`User ${savedUser.id} ${deletedUser ? 'reactivated' : 'created'} successfully.`);
      const apiResponse = this.mapToApiResponse(savedUser);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map newly created/reactivated user ${savedUser.id} to API response.`,
        );
      }
      return apiResponse;
    } catch (error: any) {
      logger.error({
        message: `Original error caught during user creation/reactivation for ${email}`,
        originalError: error,
        originalStack: error?.stack,
      });
      if (
        error instanceof BadRequestError ||
        error instanceof ForbiddenError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      throw new ServerError(`Failed to create user. ${error}`);
    }
  }

  /**
   * Creates a new user or reactivates a previously deleted user, intended for admin use.
   * This method allows specifying the security level and internal status.
   * @param input The user creation input, where 'level' and 'internal' will be respected.
   * @returns The created or reactivated user API response.
   */
  async createByAdmin(input: CreateUserInput): Promise<UserApiResponse> {
    const {
      password,
      email,
      permissions,
      permissionsExpireAt,
      isActive,
      level: inputLevel,
      internal: inputInternal,
      ...restData
    } = input;

    if (!email) {
      throw new BadRequestError('Email is required for admin creation.');
    }
    if (!password) {
      throw new BadRequestError('Password is required for admin creation.');
    }
    const lowerCaseEmail = email.toLowerCase().trim();
    if (!this.passwordService.isPasswordValid(password)) {
      throw new BadRequestError(
        'Password does not meet complexity requirements (min. 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character).',
      );
    }

    const existingActiveUser = await this.userRepository.findByEmail(lowerCaseEmail);
    if (existingActiveUser) {
      throw new BadRequestError('Email address is already in use by an active user.');
    }

    let assignedLevel: SecurityLevel;
    if (inputLevel !== undefined) {
      if (Object.values(SecurityLevel).includes(inputLevel as SecurityLevel)) {
        assignedLevel = inputLevel as SecurityLevel;
      } else {
        throw new BadRequestError(`Invalid security level provided by admin: ${inputLevel}.`);
      }
    } else {
      logger.warn(
        `Admin creating user ${lowerCaseEmail} did not specify a level, defaulting to USER.`,
      );
      assignedLevel = SecurityLevel.USER;
    }

    const assignedInternal = inputInternal ?? false;

    try {
      const hashedPassword = await this.passwordService.hashPassword(password);
      const encodedOverrides = AuthorizationUtils.encodePermissionsToString(permissions ?? {});
      const deletedUser = await this.userRepository.findDeletedByEmail(lowerCaseEmail);
      let userEntity: User;

      const userData = {
        ...restData,
        level: assignedLevel,
        internal: assignedInternal,
        email: lowerCaseEmail,
        password: hashedPassword,
        passwordStatus: PasswordStatus.ACTIVE,
        passwordUpdatedAt: new Date(),
        authorisationOverrides: encodedOverrides,
        permissionsExpireAt: permissionsExpireAt ? dayjs(permissionsExpireAt).toDate() : null,
        isActive: isActive === undefined ? true : isActive,
        uid: randomUUID(),
      };

      if (deletedUser) {
        logger.info(
          `Admin reactivating deleted user with email ${lowerCaseEmail} (ID: ${deletedUser.id})`,
        );
        Object.assign(deletedUser, userData);
        deletedUser.deletedAt = null;
        deletedUser.uid = deletedUser.uid ?? randomUUID();
        userEntity = deletedUser;
      } else {
        userEntity = this.userRepository.create(userData);
      }

      if (!userEntity.isValid()) {
        throw new BadRequestError(
          `User data (admin creation) is invalid. Errors: ${validationInputErrors.join(', ')}`,
        );
      }
      const savedUser = await this.userRepository.save(userEntity);
      logger.info(
        `User ${savedUser.id} ${deletedUser ? 'reactivated' : 'created'} by admin successfully.`,
      );
      const apiResponse = this.mapToApiResponse(savedUser);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map admin-created/reactivated user ${savedUser.id} to API response.`,
        );
      }
      return apiResponse;
    } catch (error: any) {
      logger.error({
        message: `Error during admin user creation/reactivation for ${email}`,
        originalError: error,
        originalStack: error?.stack,
      });
      if (
        error instanceof BadRequestError ||
        error instanceof ForbiddenError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      throw new ServerError(`Failed to create user via admin. ${error}`);
    }
  }

  /**
   * Updates an existing user's information.
   * @param id The user ID.
   * @param input The update input.
   * @param options Optional request context.
   * @returns The updated user API response.
   */
  async update(id: number, input: UpdateUserInput): Promise<UserApiResponse> {
    const {
      password,
      permissions,
      permissionsExpireAt,
      isActive,
      level: inputLevel,
      ...restData
    } = input;
    try {
      const user = await this.userRepository.findByIdWithPassword(id);
      if (!user) throw new NotFoundError(`User with id ${id} not found.`);

      const updatePayload: Partial<User> = { ...restData };
      let passwordChanged = false;

      if (inputLevel !== undefined) {
        if (Object.values(SecurityLevel).includes(inputLevel as SecurityLevel)) {
          updatePayload.level = inputLevel as SecurityLevel;
        } else {
          throw new BadRequestError(`Invalid security level provided for update: ${inputLevel}.`);
        }
      }
      if (input.internal !== undefined) {
        updatePayload.internal = input.internal;
      }

      const finalAssignedLevel = updatePayload.level ?? user.level;
      if (
        updatePayload.internal === true &&
        ![SecurityLevel.ADMIN, SecurityLevel.INTEGRATOR].includes(finalAssignedLevel)
      ) {
        logger.warn(
          `Admin or process is attempting to set user ${id} to internal=true with a non-privileged level ${finalAssignedLevel}. This might be unintended.`,
        );
      }

      if (password) {
        if (!this.passwordService.isPasswordValid(password)) {
          throw new BadRequestError(
            'Password does not meet complexity requirements (min. 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character).',
          );
        }
        const isSame = await user.comparePassword(password);
        if (!isSame) {
          updatePayload.password = await this.passwordService.hashPassword(password);
          updatePayload.passwordUpdatedAt = new Date();
          updatePayload.passwordStatus = PasswordStatus.VALIDATING;
          passwordChanged = true;
        } else {
          logger.warn(`User ${id} attempted to update with the same password.`);
        }
      }
      if (permissions !== undefined) {
        updatePayload.authorisationOverrides = AuthorizationUtils.encodePermissionsToString(
          permissions ?? {},
        );
      }
      if (permissionsExpireAt !== undefined) {
        const expiryDate = permissionsExpireAt ? dayjs(permissionsExpireAt) : null;
        updatePayload.permissionsExpireAt = expiryDate?.isValid() ? expiryDate.toDate() : null;
      }
      if (isActive !== undefined) {
        updatePayload.isActive = isActive;
      }

      Object.assign(user, restData, updatePayload);

      if (!user.isValid()) {
        throw new BadRequestError(`User data after update is invalid. ${validationInputErrors}`);
      }
      const finalUpdatePayload: Partial<User> = { ...restData };
      if (updatePayload.password) finalUpdatePayload.password = updatePayload.password;
      if (updatePayload.passwordUpdatedAt)
        finalUpdatePayload.passwordUpdatedAt = updatePayload.passwordUpdatedAt;
      if (updatePayload.passwordStatus)
        finalUpdatePayload.passwordStatus = updatePayload.passwordStatus;
      if (updatePayload.authorisationOverrides !== undefined)
        finalUpdatePayload.authorisationOverrides = updatePayload.authorisationOverrides;
      if (updatePayload.permissionsExpireAt !== undefined)
        finalUpdatePayload.permissionsExpireAt = updatePayload.permissionsExpireAt;
      if (updatePayload.isActive !== undefined)
        finalUpdatePayload.isActive = updatePayload.isActive;

      const result = await this.userRepository.update(id, finalUpdatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `User with id ${id} not found during update (or no changes applied).`,
        );
      }
      const updatedUser = await this.userRepository.findById(id);
      if (!updatedUser) throw new ServerError('Failed to re-fetch user after update.');
      if (passwordChanged && updatedUser.passwordStatus === PasswordStatus.VALIDATING) {
        const emailLanguage = updatedUser.preferences?.language === 'fr' ? 'fr' : 'en';
        await this.passwordService.sendPasswordConfirmationEmail(updatedUser, emailLanguage);
      }
      logger.info(`User ${id} updated successfully.`);
      const apiResponse = this.mapToApiResponse(updatedUser);
      if (!apiResponse) {
        throw new ServerError(`Failed to map updated user ${id} to API response.`);
      }
      return apiResponse;
    } catch (error: any) {
      logger.error(error, `Error updating user ${id}`);
      if (
        error instanceof BadRequestError ||
        error instanceof ForbiddenError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      throw new ServerError(`Failed to update user ${error}`);
    }
  }

  /**
   * Updates a user's preferences.
   * @param userId The user ID.
   * @param preferences The new preferences object or null.
   * @returns The updated user API response.
   */
  async updatePreferences(
    userId: number,
    preferences: Record<string, any> | null,
  ): Promise<UserApiResponse> {
    try {
      const result = await this.userRepository.update(userId, { preferences });
      if (result.affected === 0) throw new NotFoundError(`User with id ${userId} not found.`);
      const updatedUser = await this.userRepository.findById(userId);
      if (!updatedUser) {
        throw new ServerError('Failed to re-fetch user after preference update.');
      }
      const apiResponse = this.mapToApiResponse(updatedUser);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map user ${userId} after preference update to API response.`,
        );
      }
      return apiResponse;
    } catch (error) {
      throw new ServerError(`Error updating preferences for user ${userId} ${error}`);
    }
  }

  /**
   * Resets a user's preferences to null.
   * @param userId The user ID.
   * @returns The updated user API response.
   */
  async resetPreferences(userId: number): Promise<UserApiResponse> {
    return this.updatePreferences(userId, null);
  }

  /**
   * Updates a specific preference key for a user.
   * @param userId The user ID.
   * @param key The preference key to update.
   * @param value The new value for the preference key. Can be any JSON-serializable value.
   * @returns The updated user API response.
   */
  async updatePreferenceByKey(
    userId: number,
    key: string,
    value: unknown,
  ): Promise<UserApiResponse> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new NotFoundError(`User with id ${userId} not found.`);

      const currentPreferences = user.preferences || {};
      currentPreferences[key] = value;

      return await this.updatePreferences(userId, currentPreferences);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ServerError(`Error updating preference key '${key}' for user ${userId}: ${error}`);
    }
  }

  /**
   * Soft deletes a user (logical deletion).
   * @param id The user ID.
   * @param options Optional request context.
   * @returns void
   */
  async delete(id: number): Promise<void> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) throw new NotFoundError(`User with id ${id} not found.`);
      const anonymizedEmail = `${user.email}_deleted_${Date.now()}`;
      await this.userRepository.softDelete(id, anonymizedEmail);
      logger.info(`User ${id} successfully soft-deleted.`);
    } catch (error) {
      if (
        error instanceof BadRequestError ||
        error instanceof ForbiddenError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      throw new ServerError(`Error deleting user ${id} ${error}`);
    }
  }

  /**
   * Returns a singleton instance of UsersService.
   * @returns The UsersService instance.
   */
  static getInstance(): UsersService {
    if (!instance) {
      instance = new UsersService(new UserRepository());
    }
    return instance;
  }

  /**
   * Finds an existing user by Google ID or email, or creates a new user if not found.
   * Associates the Google profile with the user account.
   * @param profile The Google profile object from passport-google-oauth20.
   * @returns The found or created User entity (not UserApiResponse).
   * @throws BadRequestError if email or first name is missing from profile, or if email is linked to another Google ID.
   * @throws ServerError if user creation or update fails unexpectedly.
   */
  async findOrCreateByGoogleProfile(profile: GoogleProfile): Promise<User> {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    const firstName = profile.name?.givenName;
    const lastName = profile.name?.familyName;

    if (!email) {
      throw new BadRequestError('Email not found in Google profile. Cannot create or link user.');
    }
    if (!firstName) {
      throw new BadRequestError(
        'First name not found in Google profile. Cannot create or link user.',
      );
    }

    // 1. Try to find user by Google ID
    let user = await this.userRepository.findByGoogleId(googleId);
    if (user) {
      logger.info(`User found by Google ID: ${googleId} (User ID: ${user.id})`);
      let detailsChanged = false;
      if (firstName && user.firstName !== firstName) {
        user.firstName = firstName;
        detailsChanged = true;
      }
      if (lastName && user.lastName !== lastName) {
        user.lastName = lastName;
        detailsChanged = true;
      }
      if (detailsChanged) {
        await this.userRepository.save(user);
        logger.info(`User details updated from Google profile for User ID: ${user.id}`);
      }
      return user;
    }

    // 2. No user by Google ID, try to find by email
    logger.info(`No user found by Google ID ${googleId}. Trying by email: ${email}`);
    user = await this.userRepository.findByEmailWithGoogleId(email.toLowerCase()); // Ensure email is normalized

    if (user) {
      if (user.googleId && user.googleId !== googleId) {
        logger.error(
          `User with email ${email} (ID: ${user.id}) is already linked to a different Google ID (${user.googleId}). Cannot link to ${googleId}.`,
        );
        throw new BadRequestError(
          'This email address is already associated with a different Google account.',
        );
      }

      if (!user.googleId) {
        user.googleId = googleId;
        if (firstName && user.firstName !== firstName) user.firstName = firstName;
        if (lastName && user.lastName !== lastName) user.lastName = lastName; // handles null from profile

        await this.userRepository.save(user);
        logger.info(`Linked Google ID ${googleId} to existing user ${user.email} (ID: ${user.id})`);
      }
      return user;
    }

    logger.info(`No user found by email ${email}. Creating new user with Google ID ${googleId}.`);
    const newUser = this.userRepository.create({
      googleId,
      email: email.toLowerCase(),
      firstName,
      lastName: lastName ?? null,
      level: SecurityLevel.USER,
      internal: false,
      isActive: true,
      passwordStatus: PasswordStatus.ACTIVE,
      password: null,
      uid: randomUUID(),
      passwordUpdatedAt: new Date(),
    });

    // La validation Zod dans user.entity.ts gère maintenant password optional/nullable.
    // La logique de placeholder temporaire pour le mot de passe n'est plus nécessaire.
    if (!newUser.isValid()) {
      logger.error(
        {
          validationErrors: validationInputErrors,
          userAttributes: {
            email: newUser.email,
            firstName: newUser.firstName,
            googleId: newUser.googleId,
          },
        },
        'Validation failed for new Google user',
      );
      throw new BadRequestError(
        `New user data from Google profile is invalid. Errors: ${validationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedUser = await this.userRepository.save(newUser);
      logger.info(`New user created via Google OAuth: ${savedUser.email} (ID: ${savedUser.id})`);
      return savedUser;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('unique constraint')) {
        logger.warn(
          `Race condition or duplicate entry on Google user save for email ${email} or Google ID ${googleId}. Attempting to re-fetch.`,
        );
        const existingByGoogleId = await this.userRepository.findByGoogleId(googleId);
        if (existingByGoogleId) return existingByGoogleId;
        const existingByEmail = await this.userRepository.findByEmailWithGoogleId(
          email.toLowerCase(),
        );
        if (existingByEmail) return existingByEmail;
      }
      logger.error(error, `Error saving new user from Google profile for email ${email}`);
      throw new ServerError('Could not create or link user account with Google profile.');
    }
  }
}
