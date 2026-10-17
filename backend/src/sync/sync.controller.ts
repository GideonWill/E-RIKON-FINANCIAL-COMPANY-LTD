import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SyncService, CloudVaultPayload } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get()
  getVault() {
    return {
      success: true,
      vault: this.syncService.getVault(),
    };
  }

  /**
   * Generous throttle ceiling for synchronization payloads (up to 300 sync pulses/min)
   */
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  updateVault(@Body() body: CloudVaultPayload) {
    const updated = this.syncService.updateVault(body);
    return {
      success: true,
      vault: updated,
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  resetVault() {
    const reset = this.syncService.resetVault();
    return {
      success: true,
      vault: reset,
    };
  }
}
