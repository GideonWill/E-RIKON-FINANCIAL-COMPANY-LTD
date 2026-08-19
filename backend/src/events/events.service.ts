import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Response } from 'express';

export type SseEventType =
  | 'CUSTOMER_REGISTERED'
  | 'CUSTOMER_DELETED'
  | 'DEPOSIT_RECORDED'
  | 'LOAN_CREATED'
  | 'LOAN_APPROVED'
  | 'LOAN_DISBURSED'
  | 'LOAN_REPAYMENT_RECORDED'
  | 'STAFF_REGISTERED'
  | 'APPROVAL_DECISION_MADE'
  | 'COMPANY_INTEREST_ACCUMULATED'
  | 'HEARTBEAT';

export interface SsePayload {
  type: SseEventType;
  timestamp: string;
  data?: any;
}

/**
 * EventsService — Singleton SSE connection registry.
 *
 * Keeps track of every connected client's HTTP Response object and
 * broadcasts real-time events to all of them simultaneously.
 * This is the Demargo pattern: simple, stateless, no WebSocket library needed.
 */
@Injectable()
export class EventsService implements OnModuleDestroy {
  private clients = new Map<string, Response>();

  /** Register a new SSE client connection */
  addClient(clientId: string, res: Response): void {
    this.clients.set(clientId, res);
    console.log(`[SSE] Client connected: ${clientId} | Total: ${this.clients.size}`);
  }

  /** Remove a disconnected SSE client */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`[SSE] Client disconnected: ${clientId} | Remaining: ${this.clients.size}`);
  }

  /** Returns how many clients are currently connected */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Broadcast an SSE event to ALL connected clients.
   * Uses the standard `data: <json>\n\n` SSE wire format.
   */
  broadcast(type: SseEventType, data?: any): void {
    const payload: SsePayload = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    const message = `data: ${JSON.stringify(payload)}\n\n`;

    let deadClients: string[] = [];

    this.clients.forEach((res, clientId) => {
      try {
        res.write(message);
      } catch {
        // Client disconnected mid-write — mark for removal
        deadClients.push(clientId);
      }
    });

    // Clean up dead connections
    deadClients.forEach((id) => this.clients.delete(id));

    if (this.clients.size > 0) {
      console.log(`[SSE] Broadcast "${type}" → ${this.clients.size} client(s)`);
    }
  }

  /** Clean up all connections on module shutdown */
  onModuleDestroy(): void {
    this.clients.forEach((res) => {
      try {
        res.end();
      } catch {}
    });
    this.clients.clear();
  }
}
