export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface ClassItem {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface CreateClassPayload {
  name: string;
  totalSeats: number;
}

export interface CreateClassResponse {
  id: string;
  name: string;
  totalSeats: number;
}

export interface HoldItem {
  holdId: string;
  classId: string;
  studentId: string;
  status: HoldStatus;
  expiresAt: string;
}

export interface HoldDetails {
  holdId: string;
  classId: string;
  status: HoldStatus;
  expiresAt: string;
}

export interface ConfirmHoldResponse {
  holdId: string;
  status: HoldStatus;
}

export interface StudentHoldSummary {
  holdId: string;
  classId: string;
  className: string;
  status: HoldStatus;
  expiresAt: string;
}

export interface ApiError {
  code: string;
  message: string;
}

