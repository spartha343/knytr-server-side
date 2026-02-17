/**
 * Invoice Service
 * Generate PDF invoices for orders
 */

import PDFDocument from "pdfkit";
import { Readable } from "stream";
import cloudinary from "../../../config/cloudinary.config";

interface InvoiceOrderItem {
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: {
    name: string;
  };
  variant: {
    sku: string;
    variantAttributes: {
      attributeValue: {
        value: string;
        attribute: {
          name: string;
        };
      };
    }[];
  } | null;
}

interface InvoiceData {
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string;
  orderStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  orderItems: InvoiceOrderItem[];
  store: {
    name: string;
    logo?: string | null;
    contactPhone?: string | null;
  };
  branch: {
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
    } | null;
  } | null;
}

class InvoiceService {
  async generateInvoice(orderData: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Create PDF document
        const doc = new PDFDocument({
          size: "A4",
          margin: 50
        });

        // Create chunks array to collect PDF data
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => {
          resolve(Buffer.concat(chunks));
        });

        // Generate invoice content
        this.generateHeader(doc, orderData);
        this.generateCustomerInformation(doc, orderData);
        this.generateInvoiceTable(doc, orderData);
        this.generateFooter(doc);

        // Finalize PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Upload PDF buffer to Cloudinary
   */
  private async uploadPDFToCloudinary(
    pdfBuffer: Buffer,
    orderNumber: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "knytr/invoices",
          resource_type: "raw",
          public_id: `invoice_${orderNumber}_${Date.now()}`,
          format: "pdf"
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new Error("Upload failed: No result from Cloudinary"));
          }
        }
      );

      const readableStream = new Readable();
      readableStream.push(pdfBuffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Generate invoice header
   */
  private generateHeader(
    doc: PDFKit.PDFDocument,
    orderData: InvoiceData
  ): void {
    // Store name and logo
    doc
      .fillColor("#2563EB")
      .fontSize(26)
      .text(orderData.store.name, 50, 50, { align: "left" })
      .fillColor("#000000")
      .fontSize(10)
      .text(`Invoice #${orderData.orderNumber}`, 50, 80);

    // Invoice title on right
    doc
      .fontSize(20)
      .text("INVOICE", 400, 50, { align: "right" })
      .fontSize(10)
      .text(
        `Date: ${new Date(orderData.createdAt).toLocaleDateString()}`,
        400,
        75,
        {
          align: "right"
        }
      );

    // Line separator
    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(50, 110)
      .lineTo(550, 110)
      .stroke();
  }

  /**
   * Generate customer information section
   */
  private generateCustomerInformation(
    doc: PDFKit.PDFDocument,
    orderData: InvoiceData
  ): void {
    const customerTop = 130;

    // Billed To
    doc
      .fontSize(12)
      .fillColor("#000000")
      .text("Bill To:", 50, customerTop)
      .fontSize(10)
      .text(orderData.customerName, 50, customerTop + 20)
      .text(orderData.customerPhone, 50, customerTop + 35)
      .text(orderData.customerEmail || "N/A", 50, customerTop + 50);

    // Ship To
    doc
      .fontSize(12)
      .text("Ship To:", 300, customerTop)
      .fontSize(10)
      .text(orderData.deliveryAddress, 300, customerTop + 20, {
        width: 250,
        align: "left"
      });

    // Order details
    doc
      .fontSize(10)
      .text(`Order Status: ${orderData.orderStatus}`, 50, customerTop + 85)
      .text(`Payment Method: ${orderData.paymentMethod}`, 50, customerTop + 100)
      .text(
        `Payment Status: ${orderData.paymentStatus}`,
        50,
        customerTop + 115
      );
  }

  /**
   * Generate invoice items table
   */
  private generateInvoiceTable(
    doc: PDFKit.PDFDocument,
    orderData: InvoiceData
  ): void {
    const tableTop = 280;
    const itemCodeX = 50;
    const descriptionX = 120;
    const quantityX = 350;
    const priceX = 420;
    const amountX = 490;

    // Table header
    doc
      .fontSize(10)
      .fillColor("#2563EB")
      .text("Item", itemCodeX, tableTop)
      .text("Description", descriptionX, tableTop)
      .text("Qty", quantityX, tableTop)
      .text("Price", priceX, tableTop)
      .text("Amount", amountX, tableTop);

    // Header line
    doc
      .strokeColor("#2563EB")
      .lineWidth(1)
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    // Table rows
    let y = tableTop + 30;
    doc.fillColor("#000000").fontSize(9);

    orderData.orderItems.forEach((item, index) => {
      const variantInfo = item.variant
        ? ` (SKU: ${item.variant.sku}${
            item.variant.variantAttributes.length > 0
              ? " | " +
                item.variant.variantAttributes
                  .map(
                    (va) =>
                      `${va.attributeValue.attribute.name}: ${va.attributeValue.value}`
                  )
                  .join(", ")
              : ""
          })`
        : "";

      doc
        .text((index + 1).toString(), itemCodeX, y)
        .text(`${item.product.name}${variantInfo}`, descriptionX, y, {
          width: 220
        })
        .text(item.quantity.toString(), quantityX, y, {
          width: 50,
          align: "right"
        })
        .text(`৳${item.unitPrice.toFixed(2)}`, priceX, y, {
          width: 60,
          align: "right"
        })
        .text(`৳${item.totalPrice.toFixed(2)}`, amountX, y, {
          width: 60,
          align: "right"
        });

      y += 25;
    });

    // Subtotal, delivery, total
    const summaryTop = y + 20;

    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(350, summaryTop - 10)
      .lineTo(550, summaryTop - 10)
      .stroke();

    doc
      .fontSize(10)
      .text("Subtotal:", 400, summaryTop, { align: "right" })
      .text(`৳${orderData.subtotal.toFixed(2)}`, 490, summaryTop, {
        align: "right"
      });

    doc
      .text("Delivery Fee:", 400, summaryTop + 20, { align: "right" })
      .text(`৳${orderData.deliveryFee.toFixed(2)}`, 490, summaryTop + 20, {
        align: "right"
      });

    doc
      .strokeColor("#2563EB")
      .lineWidth(2)
      .moveTo(350, summaryTop + 35)
      .lineTo(550, summaryTop + 35)
      .stroke();

    doc
      .fontSize(12)
      .fillColor("#2563EB")
      .text("Total Amount:", 400, summaryTop + 45, { align: "right" })
      .text(`৳${orderData.totalAmount.toFixed(2)}`, 490, summaryTop + 45, {
        align: "right"
      });
  }

  /**
   * Generate footer
   */
  private generateFooter(doc: PDFKit.PDFDocument): void {
    doc
      .fontSize(8)
      .fillColor("#666666")
      .text("Thank you for your business!", 50, doc.page.height - 50, {
        align: "center",
        width: 500
      });
  }
}

export default new InvoiceService();
