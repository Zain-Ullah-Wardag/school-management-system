export type ApiResponse<T> = { success: boolean; data: T; message?: string };
export type Pagination = { page: number; limit: number; total: number; totalPages: number };
export type Paginated<T> = { data: T[]; pagination: Pagination };
export type Permission = string;

export type User = { id: number; username: string; fullName: string; full_name?: string; role: string; role_name?: string; permissions: Permission[]; photo_path?: string | null; must_change_password?: boolean };
export type Option = { id: number; name?: string; code?: string; first_name?: string; last_name?: string; [key: string]: unknown };
export type Student = { id: number; admission_no: string; first_name: string; last_name?: string | null; gender: 'male' | 'female' | 'other'; photo_path?: string | null; status: string; phone?: string | null; admission_date: string; roll_no?: string | null; class_name?: string | null; section_name?: string | null; class_id?: number; section_id?: number | null; [key: string]: unknown };
export type Staff = { id: number; employee_no: string; first_name: string; last_name?: string | null; photo_path?: string | null; phone?: string | null; status: string; salary: number; designation_name?: string | null; department_name?: string | null; [key: string]: unknown };
export type Class = { id: number; code: string; name: string; name_ur?: string | null; status: string; display_order: number; [key: string]: unknown };
export type Section = { id: number; class_id: number; name: string; status: string; [key: string]: unknown };
export type Subject = { id: number; code: string; name: string; max_marks: number; pass_marks: number; status: string; [key: string]: unknown };
export type Toast = { id: string; type: 'success' | 'error' | 'info'; title: string; detail?: string };

declare global {
  interface Window { desktop?: { savePdf: (html: string, suggestedName?: string, landscape?: boolean) => Promise<{ canceled: boolean; filePath?: string }>; openPrintPreview: (html: string, title?: string, landscape?: boolean) => Promise<boolean>; openExternal: (url: string) => Promise<void>; isElectron: boolean } }
}
