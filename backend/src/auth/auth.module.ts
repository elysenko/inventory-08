import { Global, Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * JwtModule is registered globally so the app-wide JwtAuthGuard can inject
 * JwtService without every feature module re-importing it.
 *
 * JWT_SECRET is app-owned config the platform always provisions; the local
 * fallback exists only so `nest start` and the unit tests run without env
 * setup. Third-party keys are never required at boot (see RuntimeConfigService).
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret',
      // `expiresIn` is typed as a ms-library template literal; the value is
      // env-driven, so it is asserted to that option's type rather than inlined.
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ??
          process.env.JWT_EXPIRATION ??
          '12h') as JwtSignOptions['expiresIn'],
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
