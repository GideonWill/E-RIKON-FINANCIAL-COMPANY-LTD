import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CustomerStatus, AccountType } from '@prisma/client';

export interface RegisterCustomerDto {
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  address: string;
  ghanaCardNumber: string;
  passportPhotoUrl?: string;
  signatureUrl?: string;
  ghanaCardFrontUrl?: string;
  ghanaCardBackUrl?: string;
  occupation: string;
  employerName?: string;
  monthlyIncome?: number;
  branchId: string;
  createdById: string;
  nextOfKin?: {
    fullName: string;
    relationship: string;
    phone: string;
    address: string;
    occupation?: string;
  };
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async registerCustomer(dto: RegisterCustomerDto) {
    // Check unique Ghana Card & Phone
    const existingGhanaCard = await this.prisma.customer.findUnique({
      where: { ghanaCardNumber: dto.ghanaCardNumber },
    });
    if (existingGhanaCard) {
      throw new BadRequestException(`Customer with Ghana Card ${dto.ghanaCardNumber} already registered.`);
    }

    const existingPhone = await this.prisma.customer.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new BadRequestException(`Customer with phone number ${dto.phone} already registered.`);
    }

    const customerNumber = `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Customer record
      const customer = await tx.customer.create({
        data: {
          customerNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          otherNames: dto.otherNames,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          ghanaCardNumber: dto.ghanaCardNumber,
          passportPhotoUrl: dto.passportPhotoUrl,
          signatureUrl: dto.signatureUrl,
          ghanaCardFrontUrl: dto.ghanaCardFrontUrl,
          ghanaCardBackUrl: dto.ghanaCardBackUrl,
          occupation: dto.occupation,
          employerName: dto.employerName,
          monthlyIncome: dto.monthlyIncome,
          branchId: dto.branchId,
          createdById: dto.createdById,
          status: CustomerStatus.VERIFIED,
          nextOfKin: dto.nextOfKin
            ? {
                create: {
                  fullName: dto.nextOfKin.fullName,
                  relationship: dto.nextOfKin.relationship,
                  phone: dto.nextOfKin.phone,
                  address: dto.nextOfKin.address,
                  occupation: dto.nextOfKin.occupation,
                },
              }
            : undefined,
          timeline: {
            create: {
              title: 'Customer Onboarded',
              description: 'Customer registered with Ghana Card verification',
              performedBy: dto.createdById,
            },
          },
        },
      });

      // 2. Automatically provision initial Savings Account with 31-day cycle tracker
      const accountNumber = `ACC-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const account = await tx.account.create({
        data: {
          accountNumber,
          customerId: customer.id,
          branchId: dto.branchId,
          type: AccountType.SAVINGS,
          currentBalance: 0.00,
          availableBalance: 0.00,
        },
      });

      await tx.dailyCollectionCycle.create({
        data: {
          customerId: customer.id,
          accountId: account.id,
          dailyTargetAmount: 50.00,
        },
      });

      return { customer, account };
    });
  }

  async getCustomer360(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        accounts: { include: { dailyCycles: true } },
        nextOfKin: true,
        guarantors: true,
        documents: true,
        timeline: { orderBy: { createdAt: 'desc' } },
        loanApplications: { include: { schedules: true } },
        branch: true,
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async searchCustomers(query: string, branchId?: string) {
    return this.prisma.customer.findMany({
      where: {
        branchId: branchId || undefined,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { customerNumber: { contains: query, mode: 'insensitive' } },
          { ghanaCardNumber: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { accounts: true, branch: true },
      take: 25,
    });
  }
}
