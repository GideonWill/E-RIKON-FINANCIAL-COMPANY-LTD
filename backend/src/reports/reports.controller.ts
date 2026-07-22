import { Controller, Get, Param, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response } from 'express';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('receipt/:transactionId')
  async getReceiptPdf(@Param('transactionId') transactionId: string, @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generateReceiptPdf(transactionId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Receipt-${transactionId}.pdf`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Get('arrears/excel')
  async getArrearsExcel(@Res() res: Response) {
    const excelBuffer = await this.reportsService.exportLoanArrearsExcel();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=Loan_Arrears_Report.xlsx',
      'Content-Length': excelBuffer.length,
    });
    res.end(excelBuffer);
  }
}
