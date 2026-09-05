
import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RoleName } from '@prisma/client';
import { EventsService } from '../events/events.service';

export interface LoginDto {
  email: string;
  password: string;
  role?: RoleName;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: RoleName;
  password?: string;
  ghanaCard?: string;
  employeeId?: string;
  branchId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventsService: EventsService,
  ) { }

  async validateUser(dto: LoginDto) {
    const cleanEmail = dto.email?.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { branch: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or account disabled.');
    }

    if (dto.role && user.role !== dto.role) {
      throw new UnauthorizedException(
        `Access denied: This account is registered as ${user.role.replace(/_/g, ' ')}, not ${dto.role.replace(/_/g, ' ')}.`
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid password.');
    }

    // Super Admin is always approved; others depend on user.isApproved
    const isApproved = user.role === RoleName.SUPER_ADMIN || user.isApproved;

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
        newValue: `User logged in successfully (Approved: ${isApproved})`,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      branchName: user.branch.name,
      isApproved,
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
        phone: user.phone,
        role: user.role,
        ghanaCard: user.ghanaCard,
        isApproved,
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
      throw new ConflictException(
        `This email address (${cleanEmail}) already exists in the system (registered as ${existing.role.replace(/_/g, ' ')}). The same email cannot be used to create a new user role.`
      );
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

    // SUPER_ADMIN accounts are automatically approved; all other roles require Super Admin approval
    const isApproved = dto.role === RoleName.SUPER_ADMIN;

    const user = await this.prisma.user.create({
      data: {
        employeeId: dto.employeeId || `EMP-${Date.now().toString().slice(-4)}`,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: cleanEmail,
        phone: dto.phone,
        ghanaCard: dto.ghanaCard,
        passwordHash,
        role: dto.role || RoleName.TELLER,
        branchId: branch.id,
        isActive: true,
        isApproved,
      },
      include: { branch: true },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      branchName: user.branch.name,
      isApproved,
    };

    // Broadcast new staff registration to all connected SSE clients
    this.eventsService.broadcast('STAFF_REGISTERED', {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      isApproved,
    });

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        ghanaCard: user.ghanaCard,
        isApproved,
        branch: user.branch,
      },
    };
  }

  async getPendingUsers() {
    return this.prisma.user.findMany({
      where: {
        isApproved: false,
        role: { not: RoleName.SUPER_ADMIN },
      },
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveUser(userIdOrEmail: string, approverId?: string) {
    const cleanParam = userIdOrEmail.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: userIdOrEmail },
          { email: cleanParam },
        ],
      },
      include: { branch: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isApproved: true,
        isActive: true,
      },
      include: { branch: true },
    });

    // Record audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: approverId || user.id,
          userEmail: user.email,
          userRole: user.role,
          branchName: user.branch?.name || 'Institutional Main',
          action: 'STAFF_ACCOUNT_APPROVED',
          resource: 'AUTH',
          newValue: `Account approved for ${user.firstName} ${user.lastName} (${user.role})`,
        },
      });
    } catch { }

    // Broadcast approval event in real-time
    this.eventsService.broadcast('APPROVAL_DECISION_MADE', {
      userId: user.id,
      email: user.email,
      action: 'APPROVED',
      role: user.role,
      name: `${user.firstName} ${user.lastName}`,
    });

    return {
      success: true,
      message: `User ${user.firstName} ${user.lastName} approved successfully.`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        isApproved: updatedUser.isApproved,
      },
    };
  }

  async rejectUser(userIdOrEmail: string) {
    const cleanParam = userIdOrEmail.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: userIdOrEmail },
          { email: cleanParam },
        ],
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.user.delete({
      where: { id: user.id },
    });

    this.eventsService.broadcast('APPROVAL_DECISION_MADE', {
      userId: user.id,
      email: user.email,
      action: 'REJECTED',
      role: user.role,
      name: `${user.firstName} ${user.lastName}`,
    });

    this.eventsService.broadcast('USER_DELETED', {
      userId: user.id,
    });

    return {
      success: true,
      message: `Registration for ${user.firstName} ${user.lastName} was removed.`,
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
