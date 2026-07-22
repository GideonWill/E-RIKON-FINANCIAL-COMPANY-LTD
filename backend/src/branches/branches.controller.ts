import { Controller, Get, Param } from '@nestjs/common';
import { BranchesService } from './branches.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async getAll() {
    return this.branchesService.getAllBranches();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.branchesService.getBranchById(id);
  }
}
