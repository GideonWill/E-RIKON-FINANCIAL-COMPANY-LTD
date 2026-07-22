import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async getLogs(@Query('limit') limit?: number) {
    return this.auditService.getAuditLogs(limit ? Number(limit) : 100);
  }
}
