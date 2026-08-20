import { Controller, Post, Get, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, LoginDto, RegisterDto } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.validateUser(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.registerUser(dto);
  }

  @Get('pending')
  async getPendingUsers() {
    return this.authService.getPendingUsers();
  }

  @Patch('approve/:id')
  async approveUser(@Param('id') id: string) {
    return this.authService.approveUser(id);
  }

  @Delete('reject/:id')
  async rejectUser(@Param('id') id: string) {
    return this.authService.rejectUser(id);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.authService.rejectUser(id);
  }

  @Get('users')
  async getUsers() {
    return this.authService.getAllUsers();
  }
}
