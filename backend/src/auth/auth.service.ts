import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RoleName } from '@prisma/client';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: RoleName;
  password?: string;
  employeeId?: string;
  branchId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async validateUser(dto: LoginDto) {
    const cleanEmail = dto.email?.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { branch: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or account disabled.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid password.');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        branchName: user.branch.name,
        action: 'USER_LOGIN',
        resource: 'AUTH',
        newValue: 'User logged in successfully',
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      branchName: user.branch.name,
    };

    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        branch: user.branch,
      },
    };
  }

  async registerUser(dto: RegisterDto) {
    const cleanEmail = dto.email?.trim().toLowerCase();
    
    // Check if user exists
    const existing = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { branch: true },
    });

    if (existing) {
      const payload = {
        sub: existing.id,
        email: existing.email,
        role: existing.role,
        branchId: existing.branchId,
        branchName: existing.branch?.name || 'Accra Central Main Branch',
      };
      return {
        accessToken: this.jwtService.sign(payload),
        user: existing,
      };
    }

    // Ensure branch exists
    let branch = await this.prisma.branch.findFirst();
    if (!branch) {
      branch = await this.prisma.branch.create({
        data: {
          code: 'BR-ACC-01',
          name: 'Accra Central Main Branch',
          address: '14 Independence Avenue, Ridge',
          city: 'Accra',
          region: 'Greater Accra',
          phone: '+233 30 200 1122',
        },
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password || 'erikon2026', salt);

    const user = await this.prisma.user.create({
      data: {
        employeeId: dto.employeeId || `EMP-${Date.now().toString().slice(-4)}`,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: cleanEmail,
        phone: dto.phone,
        passwordHash,
        role: dto.role || RoleName.TELLER,
        branchId: branch.id,
        isActive: true,
      },
      include: { branch: true },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      branchName: user.branch.name,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        branch: user.branch,
      },
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      include: { branch: true },
    });
  }
}
