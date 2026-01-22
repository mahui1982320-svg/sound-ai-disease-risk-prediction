export type AlarmRecord = {
  id: number;
  elderlyId: number;
  eventType: "fall" | "scream" | "cough" | "moan";
  confidenceScore: number;
  audioUrl: string;
  reviewStatus: "pending" | "confirmed" | "falseAlarm";
  reviewedBy?: number | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Elderly = {
  id: number;
  name: string;
  roomNumber: string;
  address?: string | null;
  healthStatus?: string | null;
  carerName?: string | null;
  carerPhone?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReviewLog = {
  id: number;
  alarmRecordId: number;
  userId: number;
  action: "confirmed" | "falseAlarm";
  notes?: string | null;
  createdAt: Date;
};
