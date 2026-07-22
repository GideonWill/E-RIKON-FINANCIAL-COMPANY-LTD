import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllBranches() {
    return this.prisma.branch.findMany({
      include: {
        _count: { select: { users: true, customers: true, accounts: true } },
      },
    });
  }

  async getBranchById(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        users: true,
        customers: { take: 50 },
        accounts: { take: 50 },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }
}
