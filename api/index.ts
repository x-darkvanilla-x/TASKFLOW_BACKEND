import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import express from 'express';

const server = express();

let cachedServer: any;

async function bootstrap() {
  if (cachedServer) return cachedServer;

  try {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

    // Configure CORS to dynamically accept origins (crucial for Vercel deployments)
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        // Allow the local frontend and any deployed frontend
        return callback(null, true);
      },
      credentials: true,
    });

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();
    cachedServer = server;
    return server;
  } catch (err) {
    console.error('❌ NestJS bootstrap failed:', err);
    throw err;
  }
}

export default async (req: any, res: any) => {
  const expressInstance = await bootstrap();
  return expressInstance(req, res);
};
