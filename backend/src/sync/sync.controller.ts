import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
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

  @Post()
  @HttpCode(HttpStatus.OK)
  updateVault(@Body() body: CloudVaultPayload) {
    const updated = this.syncService.updateVault(body);
    return {
      success: true,
      vault: updated,
    };
  }

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
