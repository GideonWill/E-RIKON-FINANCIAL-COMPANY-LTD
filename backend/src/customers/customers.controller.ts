import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { CustomersService, RegisterCustomerDto } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  async register(@Body() dto: RegisterCustomerDto) {
    return this.customersService.registerCustomer(dto);
  }

  @Get()
  async search(@Query('q') query: string, @Query('branchId') branchId?: string) {
    return this.customersService.searchCustomers(query || '', branchId);
  }

  @Get(':id')
  async get360Profile(@Param('id') id: string) {
    return this.customersService.getCustomer360(id);
  }
}
