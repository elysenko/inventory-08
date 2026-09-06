import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when a feature needs a third-party credential that has not been
 * configured. Surfaces as 503 so a missing integration key degrades that one
 * feature instead of crash-looping the pod at boot.
 */
export class ServiceUnconfiguredError extends HttpException {
  constructor(service: string, key: string) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: `${service} is not configured. Set ${key} in Admin → Settings.`,
        service,
        key,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
