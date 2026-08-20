export const academicTabIds = ['classes', 'sections', 'subjects', 'assignments', 'sessions', 'rooms'] as const;
export type AcademicTab = typeof academicTabIds[number];

export type AcademicTabConfig = {
  id: AcademicTab;
  label: string;
  singular: string;
  actionLabel: string;
};

export const academicTabs: AcademicTabConfig[] = [
  { id: 'classes', label: 'Classes', singular: 'Class', actionLabel: 'Add Class' },
  { id: 'sections', label: 'Sections', singular: 'Section', actionLabel: 'Add Section' },
  { id: 'subjects', label: 'Subjects', singular: 'Subject', actionLabel: 'Add Subject' },
  { id: 'assignments', label: 'Subject allocation', singular: 'Allocation', actionLabel: 'Add Allocation' },
  { id: 'sessions', label: 'Academic sessions', singular: 'Academic Session', actionLabel: 'Add Academic Session' },
  { id: 'rooms', label: 'Rooms', singular: 'Room', actionLabel: 'Add Room' }
];

const byId = Object.fromEntries(academicTabs.map((tab) => [tab.id, tab])) as Record<AcademicTab, AcademicTabConfig>;

export function academicTabConfig(tab: AcademicTab) {
  return byId[tab];
}

export function academicActionLabel(tab: AcademicTab) {
  return academicTabConfig(tab).actionLabel;
}

export function academicEditorTitle(tab: AcademicTab, editing = false) {
  return `${editing ? 'Edit' : 'Add'} ${academicTabConfig(tab).singular}`;
}
