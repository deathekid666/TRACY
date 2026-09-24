declare module "pdf-parse" {
  type PdfResult = {
    text: string;
    numPages?: number;
    info?: unknown;
    metadata?: unknown;
  };

  export default function pdfParse(data: Buffer): Promise<PdfResult>;
}
