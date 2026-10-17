import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomersService, RegisterCustomerDto } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post()
  async register(@Body() dto: RegisterCustomerDto) {
    return this.customersService.registerCustomer(dto);
  }

  @Get()
  async search(
    @Query('q') query: string,
    @Query('branchId') branchId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string
  ) {
    return this.customersService.searchCustomers(
      query || '',
      branchId,
      take ? parseInt(take, 10) : 25,
      skip ? parseInt(skip, 10) : 0
    );
  }

  /**
   * Batch Customer Profile with Balances (Eliminates N+1 queries)
   */
  @Get('with-balances')
  async getWithBalances(
    @Query('branchId') branchId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string
  ) {
    return this.customersService.getCustomersWithBalances(
      branchId,
      take ? parseInt(take, 10) : 50,
      skip ? parseInt(skip, 10) : 0
    );
  }

  @Get(':id')
  async get360Profile(@Param('id') id: string) {
    return this.customersService.getCustomer360(id);
  }

  @Delete(':id')
  async deleteCustomer(@Param('id') id: string) {
    return this.customersService.deleteCustomer(id);
  }
}
