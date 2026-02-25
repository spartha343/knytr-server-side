/**
 * Invoice Service
 * Generate PDF invoices for orders
 */

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { Readable } from "stream";
import cloudinary from "../../../config/cloudinary.config";
import config from "../../../config";

interface InvoiceOrderItem {
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  product: {
    name: string;
    weight?: number | null;
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
  orderId: string;
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
  totalDiscount: number;
  deliveryFee: number;
  totalAmount: number;
  orderItems: InvoiceOrderItem[];
  store: {
    name: string;
    logo?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
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
  // ==================== Color Palette (B&W Optimized) ====================
  private readonly colors = {
    black: "#000000",
    darkGray: "#333333",
    gray: "#666666",
    lightGray: "#CCCCCC",
    white: "#FFFFFF"
  };

  async generateInvoice(orderData: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Use IIFE to handle async QR code generation
      (async () => {
        try {
          // Generate QR code
          const qrCode = await this.generateQRCode(orderData.orderId);

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

          // Generate invoice content (pass QR code)
          this.generateHeader(doc, orderData, qrCode);
          this.generateCustomerInfo(doc, orderData);
          this.generateInvoiceTable(doc, orderData);
          this.generateFooter(doc);

          // Finalize PDF
          doc.end();
        } catch (error) {
          reject(error);
        }
      })();
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
   * Generate QR code for order tracking
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  private async generateQRCode(orderId: string): Promise<string> {
    try {
      const trackingUrl = `${config.frontendUrl}`;
      const qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, {
        width: 60, // Reduced from 100 to 60
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        }
      });
      return qrCodeDataUrl;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error generating QR code:", error);
      return "";
    }
  }

  /**
   * Generate compact invoice header (B&W optimized, single page)
   */
  private async generateHeader(
    doc: PDFKit.PDFDocument,
    data: InvoiceData,
    qrCodeBase64: string
  ) {
    const margin = 50;
    let currentY = 30;

    // Store name and invoice title in one line
    doc
      .fontSize(18)
      .fillColor(this.colors.black)
      .font("Helvetica-Bold")
      .text(data.store?.name || "KNYTR", margin, currentY);

    // Store contact details (phone & email)
    const contactDetails = [
      data.store?.contactPhone ? `Tel: ${data.store.contactPhone}` : "",
      data.store?.contactEmail ? `Email: ${data.store.contactEmail}` : ""
    ]
      .filter(Boolean)
      .join(" | ");

    if (contactDetails) {
      doc
        .fontSize(10)
        .fillColor(this.colors.gray)
        .font("Helvetica")
        .text(contactDetails, margin, currentY + 20);
    }

    // QR Code (smaller, top right)
    if (qrCodeBase64) {
      try {
        const qrBuffer = Buffer.from(
          qrCodeBase64.split(",")[1] || "",
          "base64"
        );
        doc.image(qrBuffer, doc.page.width - margin - 50, currentY, {
          width: 50, // Reduced from 60 to 50
          height: 50 // Reduced from 60 to 50
        });
      } catch {
        // Skip QR code on error
      }
    }

    currentY += data.store?.contactPhone || data.store?.contactEmail ? 55 : 45; // More compact header

    // Horizontal line
    doc
      .moveTo(margin, currentY)
      .lineTo(doc.page.width - margin, currentY)
      .lineWidth(1)
      .stroke(this.colors.black);

    currentY += 15;

    // Invoice details in compact rows
    doc
      .fontSize(9)
      .fillColor(this.colors.black)
      .font("Helvetica-Bold")
      .text("Invoice #:", margin, currentY);

    doc
      .font("Helvetica")
      .fillColor(this.colors.darkGray)
      .text(data.orderNumber, margin + 60, currentY);

    doc
      .font("Helvetica-Bold")
      .fillColor(this.colors.black)
      .text("Date:", margin + 250, currentY);

    doc
      .font("Helvetica")
      .fillColor(this.colors.darkGray)
      .text(
        new Date(data.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }),
        margin + 280,
        currentY
      );

    currentY += 12;

    // Horizontal line
    doc
      .moveTo(margin, currentY)
      .lineTo(doc.page.width - margin, currentY)
      .lineWidth(1)
      .stroke(this.colors.black);

    doc.y = currentY + 5;
  }

  /**
   * Generate compact customer information section (COD - Same billing and shipping)
   */
  private generateCustomerInfo(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const margin = 50;
    const startY = doc.y + 5; // Reduced from 10 to 5

    const columnWidth = (doc.page.width - 2 * margin - 15) / 2;
    const leftX = margin;
    const rightX = margin + columnWidth + 15;

    // Left column - Customer Info
    doc
      .fontSize(9)
      .fillColor(this.colors.black)
      .font("Helvetica-Bold")
      .text("CUSTOMER INFO", leftX, startY);

    doc
      .fontSize(9)
      .fillColor(this.colors.darkGray)
      .font("Helvetica-Bold")
      .text(data.customerName || "N/A", leftX, startY + 12);

    doc
      .fontSize(8)
      .fillColor(this.colors.gray)
      .font("Helvetica")
      .text(data.customerPhone || "N/A", leftX, startY + 24, {
        width: columnWidth
      });

    if (data.customerEmail) {
      doc.text(data.customerEmail, leftX, startY + 34, {
        width: columnWidth
      });
    }

    // Right column - Payment & Delivery Info
    doc
      .fontSize(9)
      .fillColor(this.colors.black)
      .font("Helvetica-Bold")
      .text("PAYMENT & DELIVERY", rightX, startY);

    doc
      .fontSize(8)
      .fillColor(this.colors.gray)
      .font("Helvetica")
      .text(`Payment: ${data.paymentMethod || "COD"}`, rightX, startY + 12);

    doc.text(`Status: ${data.paymentStatus || "Pending"}`, rightX, startY + 22);

    doc
      .font("Helvetica-Bold")
      .fillColor(this.colors.darkGray)
      .text(`Delivery: ${data.deliveryAddress || "N/A"}`, rightX, startY + 32, {
        width: columnWidth
      });

    doc.y = startY + 40; // Reduced from 50 to 40
  }

  /**
   * Generate compact invoice items table (B&W optimized)
   */
  private generateInvoiceTable(
    doc: PDFKit.PDFDocument,
    data: InvoiceData
  ): void {
    const margin = 50;
    const tableTop = doc.y + 10;

    // Horizontal line
    doc
      .moveTo(margin, tableTop)
      .lineTo(doc.page.width - margin, tableTop)
      .lineWidth(1)
      .stroke(this.colors.black);

    const tableStartY = tableTop + 10;

    // Table header - Compact with Weight column
    doc.fontSize(8).fillColor(this.colors.black).font("Helvetica-Bold");

    doc.text("ITEM", margin + 5, tableStartY, { width: 130 }); // Reduced from 140 to 130
    doc.text("WT(kg)", margin + 140, tableStartY, {
      width: 35,
      align: "right"
    }); // Added gap, shows kg
    doc.text("QTY", margin + 190, tableStartY, { width: 20 }); // Increased gap to 190 (double spacing)
    doc.text("UNIT PRICE", margin + 215, tableStartY, {
      width: 60,
      align: "right"
    });
    doc.text("UNIT DISC", margin + 345, tableStartY, {
      width: 45,
      align: "right"
    });
    doc.text("TOTAL", margin + 410, tableStartY, {
      // Adjusted to 330
      width: 60,
      align: "right"
    });

    let currentY = tableStartY + 12;

    // Horizontal line under header
    doc
      .moveTo(margin, currentY)
      .lineTo(doc.page.width - margin, currentY)
      .lineWidth(0.5)
      .stroke(this.colors.lightGray);

    currentY += 5;

    // Table rows
    let totalWeight = 0;

    data.orderItems.forEach((item) => {
      // Item name
      doc
        .fontSize(8)
        .fillColor(this.colors.black)
        .font("Helvetica-Bold")
        .text(item.product.name, margin + 5, currentY, { width: 130 }); // Reduced from 140 to 130

      let itemHeight = 10;

      // Variant details
      if (item.variant && item.variant.variantAttributes.length > 0) {
        const variantText = item.variant.variantAttributes
          .map(
            (attr) =>
              `${attr.attributeValue.attribute.name}: ${attr.attributeValue.value}`
          )
          .join(", ");

        doc
          .fontSize(7)
          .fillColor(this.colors.gray)
          .font("Helvetica")
          .text(variantText, margin + 5, currentY + 9, { width: 130 }); // Reduced from 140 to 130

        itemHeight = 18; // Reduced from 20 to 18
      }

      if (item.discount > 0) {
        itemHeight = Math.max(itemHeight, 18); // Ensure minimum 18px for discount pricing
      }

      // Weight
      const itemWeight = item.product.weight ? Number(item.product.weight) : 0;
      const totalItemWeight = itemWeight * item.quantity;
      totalWeight += totalItemWeight;

      doc
        .fontSize(7)
        .fillColor(this.colors.darkGray)
        .font("Helvetica")
        .text(
          itemWeight > 0 ? `${itemWeight}` : "-", // Removed 'g' suffix since weight is in kg
          margin + 140, // Changed from 150 to 140 for better spacing
          currentY,
          { width: 35, align: "right" } // Changed from 30 to 35
        );

      // Quantity
      doc
        .fontSize(8)
        .fillColor(this.colors.darkGray)
        .font("Helvetica")
        .text(item.quantity.toString(), margin + 190, currentY, {
          // Double spacing - increased to 190
          width: 20
        });

      // Unit price (with strikethrough if discounted)
      const originalPrice = Number(item.unitPrice) + Number(item.discount);
      if (item.discount > 0) {
        // Show original price with strikethrough
        doc
          .fontSize(7)
          .fillColor(this.colors.gray)
          .font("Helvetica")
          .text(`Tk ${originalPrice.toFixed(2)}`, margin + 215, currentY, {
            width: 60,
            align: "right",
            strike: true
          });
        // Show discounted price below
        doc
          .fontSize(8)
          .fillColor(this.colors.black)
          .font("Helvetica-Bold")
          .text(
            `Tk ${Number(item.unitPrice).toFixed(2)}`,
            margin + 215,
            currentY + 8,
            {
              width: 60,
              align: "right"
            }
          );
      } else {
        // No discount, just show price
        doc
          .fontSize(8)
          .fillColor(this.colors.darkGray)
          .font("Helvetica")
          .text(
            `Tk ${Number(item.unitPrice).toFixed(2)}`,
            margin + 210,
            currentY,
            {
              width: 60,
              align: "right"
            }
          );
      }

      // Discount amount
      if (item.discount > 0) {
        doc
          .fontSize(8)
          .fillColor(this.colors.black)
          .font("Helvetica-Bold")
          .text(
            `-Tk ${Number(item.discount).toFixed(2)}`,
            margin + 345,
            currentY,
            {
              width: 45,
              align: "right"
            }
          );
      } else {
        doc
          .fontSize(8)
          .fillColor(this.colors.gray)
          .font("Helvetica")
          .text("-", margin + 345, currentY, {
            width: 45,
            align: "right"
          });
      }

      // Total price
      doc
        .fontSize(8)
        .fillColor(this.colors.black)
        .font("Helvetica-Bold")
        .text(
          `Tk ${Number(item.totalPrice).toFixed(2)}`,
          margin + 410,
          currentY,
          {
            width: 60,
            align: "right"
          }
        );

      currentY += itemHeight + 3; // Reduced from 5 to 3 for compactness
    });

    // Bottom border
    doc
      .moveTo(margin, currentY)
      .lineTo(doc.page.width - margin, currentY)
      .lineWidth(1)
      .stroke(this.colors.black);

    currentY += 5;

    // Total Weight row
    if (totalWeight > 0) {
      doc
        .fontSize(8)
        .fillColor(this.colors.black)
        .font("Helvetica-Bold")
        .text("Total Weight:", margin + 5, currentY, { width: 130 }); // Changed from 140 to 130

      doc.font("Helvetica-Bold").text(
        `${totalWeight.toFixed(2)}kg`, // Changed to kg with 2 decimals
        margin + 140, // Changed from 150 to 140
        currentY,
        { width: 35, align: "right" } // Changed from 30 to 35
      );

      currentY += 12;
    }

    doc.y = currentY;

    // Summary section (compact, right-aligned, B&W)
    const summaryX = doc.page.width - margin - 180;
    const startY = doc.y + 10;
    let currentSummaryY = startY;

    // Subtotal
    doc
      .fontSize(9)
      .fillColor(this.colors.black)
      .font("Helvetica")
      .text("Items Subtotal:", summaryX, currentSummaryY);

    doc
      .font("Helvetica-Bold")
      .text(
        `Tk ${Number(data.subtotal || 0).toFixed(2)}`,
        summaryX + 90,
        currentSummaryY,
        { width: 90, align: "right" }
      );

    currentSummaryY += 12;

    // Discount (if applicable)
    if (data.totalDiscount > 0) {
      doc
        .fontSize(9)
        .fillColor(this.colors.black)
        .font("Helvetica")
        .text("Total Discount:", summaryX, currentSummaryY);

      doc
        .font("Helvetica-Bold")
        .text(
          `-Tk ${Number(data.totalDiscount).toFixed(2)}`,
          summaryX + 90,
          currentSummaryY,
          { width: 90, align: "right" }
        );

      currentSummaryY += 12;
    }

    // Delivery Fee
    doc
      .fontSize(9)
      .fillColor(this.colors.black)
      .font("Helvetica")
      .text("Delivery Charge:", summaryX, currentSummaryY);

    doc
      .font("Helvetica-Bold")
      .text(
        `Tk ${Number(data.deliveryFee || 0).toFixed(2)}`,
        summaryX + 90,
        currentSummaryY,
        { width: 90, align: "right" }
      );

    currentSummaryY += 15;

    // Divider line
    doc
      .moveTo(summaryX, currentSummaryY)
      .lineTo(doc.page.width - margin, currentSummaryY)
      .lineWidth(1)
      .stroke(this.colors.black);

    currentSummaryY += 8;

    // Total (bold)
    doc
      .fontSize(11)
      .fillColor(this.colors.black)
      .font("Helvetica-Bold")
      .text("Total Amount:", summaryX, currentSummaryY);

    doc.text(
      `Tk ${Number(data.totalAmount || 0).toFixed(2)}`,
      summaryX + 90,
      currentSummaryY,
      { width: 90, align: "right" }
    );

    currentSummaryY += 12;

    // Double line under total
    doc
      .moveTo(summaryX, currentSummaryY)
      .lineTo(doc.page.width - margin, currentSummaryY)
      .lineWidth(2)
      .stroke(this.colors.black);

    doc.y = currentSummaryY + 10;
  }

  /**
   * Generate compact footer with KNYTR branding (always at bottom of page)
   */
  private generateFooter(doc: PDFKit.PDFDocument): void {
    const margin = 50;
    const footerY = doc.y + 10; // Use current position with small gap (no forced page height)

    // Horizontal line
    doc
      .moveTo(margin, footerY)
      .lineTo(doc.page.width - margin, footerY)
      .lineWidth(0.5)
      .stroke(this.colors.lightGray);

    const textY = footerY + 6;

    // Thank you message (left side)
    doc
      .fontSize(8)
      .fillColor(this.colors.gray)
      .font("Helvetica")
      .text("Thank you for your business!", margin, textY, {
        lineBreak: false
      });

    // Powered by KNYTR (right side, stylish italic)
    doc
      .fontSize(8)
      .fillColor(this.colors.black)
      .font("Helvetica-Oblique")
      .text("Powered by KNYTR", doc.page.width - margin - 85, textY, {
        lineBreak: false
      });
  }
}

export default new InvoiceService();
