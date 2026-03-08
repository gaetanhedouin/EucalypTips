import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

@Catch(
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.getStatus(exception);
    const message = this.getMessage(exception);

    this.logger.warn(`Prisma error on ${request.method} ${request.url}: ${message}`);

    response.status(status).json({
      statusCode: status,
      error: status === HttpStatus.SERVICE_UNAVAILABLE ? 'Service Unavailable' : 'Internal Server Error',
      message,
    });
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const unavailableCodes = new Set(['P1001', 'P1002', 'P1008', 'P1017']);
      if (unavailableCodes.has(exception.code)) {
        return HttpStatus.SERVICE_UNAVAILABLE;
      }
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown): string {
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return 'Database unavailable. Please ensure PostgreSQL is running.';
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P1001') {
        return 'Database unavailable. Please ensure PostgreSQL is running.';
      }
      if (exception.code === 'P1002' || exception.code === 'P1008' || exception.code === 'P1017') {
        return 'Database connection failed or timed out. Please retry shortly.';
      }
      return `Database request failed (${exception.code}).`;
    }

    return 'Unexpected database error.';
  }
}
