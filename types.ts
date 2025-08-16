
export interface Receipt {
  id: number;
  receiptNumber: string;
  name: string;
  blockNumber: string;
  amount: number;
  date: string;
  forMonth: string;
  paymentMethod: 'Cash' | 'Cheque' | 'Online';
}

export interface Expense {
  id: number;
  date: string;
  description: string;
  amount: number;
}

export interface Settings {
  id: number;
  adminName: string;
  blockNumber: string;
  signatureType: 'typed' | 'drawn' | 'uploaded';
  typedSignature: string;
  drawnSignature: string; // base64 data URL
  uploadedSignature: string; // base64 data URL
}