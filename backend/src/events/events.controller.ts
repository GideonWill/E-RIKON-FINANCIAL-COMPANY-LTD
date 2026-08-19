import { Controller, Get, Req, Res, Query, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { EventsService } from './events.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * EventsController — GET /api/events
 *
 * This endpoint keeps a persistent HTTP connection open (SSE stream).
 * The frontend connects via:  new EventSource(`/api/events?token=<jwt>`)
 *
 * EventSource does NOT support custom Authorization headers, so the JWT
 * is passed as a query parameter and validated here.
 */
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  async subscribe(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Validate JWT from query string
    if (!token) {
      throw new UnauthorizedException('Missing SSE token.');
    }

    try {
      this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired SSE token.');
    }

    // Set SSE headers — these tell the browser this is a streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx/Render proxy buffering
    res.flushHeaders();

    // Send an initial "connected" comment so the browser knows the stream is live
    res.write(`: connected\n\n`);

    // Register this client
    const clientId = uuidv4();
    this.eventsService.addClient(clientId, res);

    // Send a heartbeat every 25 seconds to prevent proxy timeouts
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeatInterval);
      }
    }, 25_000);

    // Clean up when the client disconnects (tab closed, logout, network drop)
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      this.eventsService.removeClient(clientId);
    });

    req.on('error', () => {
      clearInterval(heartbeatInterval);
      this.eventsService.removeClient(clientId);
    });
  }
}
