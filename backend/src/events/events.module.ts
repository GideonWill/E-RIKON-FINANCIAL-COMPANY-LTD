import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ERIKON_CORE_FINANCIAL_SUPER_SECRET_KEY_2026',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService], // Export so other modules can inject and call broadcast()
})
export class EventsModule {}
