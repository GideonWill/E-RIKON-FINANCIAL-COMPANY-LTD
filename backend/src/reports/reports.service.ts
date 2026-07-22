import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate Printable PDF Receipt for Deposit or Withdrawal
   */
  async generateReceiptPdf(transactionId: string): Promise<Buffer> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        account: { include: { customer: true } },
        branch: true,
        recordedBy: true,
      },
    });

    if (!tx) throw new NotFoundException('Transaction not found');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: [300, 500] });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header
      doc.fontSize(14).font('Helvetica-Bold').text('E-RIKON GROUP FINANCIAL LTD', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`Branch: ${tx.branch.name}`, { align: 'center' });
      doc.text(`Phone: ${tx.branch.phone}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').text('TRANSACTION RECEIPT', { align: 'center' });
      doc.text('------------------------------------------------', { align: 'center' });

      // Receipt Details
      doc.fontSize(9).font('Helvetica-Bold').text(`Receipt No: ${tx.receiptNo}`);
      doc.font('Helvetica').text(`Ref No: ${tx.referenceNo}`);
      doc.text(`Date & Time: ${tx.createdAt.toLocaleString()}`);
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').text(`Customer: ${tx.account.customer.firstName} ${tx.account.customer.lastName}`);
      doc.font('Helvetica').text(`Customer No: ${tx.account.customer.customerNumber}`);
      doc.text(`Account No: ${tx.account.accountNumber}`);
      doc.text(`Ghana Card: ${tx.account.customer.ghanaCardNumber}`);
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').text(`Transaction Type: ${tx.type}`);
      doc.text(`Payment Mode: ${tx.paymentMode}`);
      doc.fontSize(12).font('Helvetica-Bold').text(`AMOUNT: GHS ${Number(tx.amount).toFixed(2)}`);
      doc.fontSize(9).font('Helvetica').text(`New Available Bal: GHS ${Number(tx.newBal).toFixed(2)}`);
      doc.moveDown(0.5);

      doc.text(`Served By: ${tx.recordedBy.firstName} ${tx.recordedBy.lastName}`);
      doc.text(`Remarks: ${tx.remarks || 'N/A'}`);
      doc.moveDown(1);

      doc.fontSize(8).font('Helvetica-Oblique').text('Thank you for banking with E-RIKON GROUP FINANCIAL LTD.', { align: 'center' });
      doc.text('This is an official system generated paperless receipt.', { align: 'center' });

      doc.end();
    });
  }

  /**
   * Export Loan Arrears to Excel Workbook
   */
  async exportLoanArrearsExcel(): Promise<Buffer> {
    const loans = await this.prisma.loanApplication.findMany({
      where: { status: { in: ['IN_ARREARS', 'DISBURSED', 'ACTIVE'] } },
      include: { customer: true, product: true },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Loan Arrears & Portfolio');

    worksheet.columns = [
      { header: 'App No', key: 'appNo', width: 15 },
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Ghana Card', key: 'ghanaCard', width: 18 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Product', key: 'product', width: 15 },
      { header: 'Amount Approved (GHS)', key: 'amountApproved', width: 22 },
      { header: 'Outstanding Balance (GHS)', key: 'outstanding', width: 25 },
      { header: 'Tenor Days', key: 'tenorDays', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    loans.forEach((loan) => {
      worksheet.addRow({
        appNo: loan.applicationNo,
        customerName: `${loan.customer.firstName} ${loan.customer.lastName}`,
        ghanaCard: loan.customer.ghanaCardNumber,
        phone: loan.customer.phone,
        product: loan.product.name,
        amountApproved: Number(loan.amountApproved),
        outstanding: Number(loan.outstandingBal),
        tenorDays: loan.tenorValueDays,
        status: loan.status,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
