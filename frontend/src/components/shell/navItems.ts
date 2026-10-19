import { IconType } from 'react-icons';
import { HiOutlineChartBar, HiOutlineChatBubbleOvalLeft, HiOutlineMap, HiOutlineRectangleStack } from 'react-icons/hi2';
import { StudentView } from '../Student/studentLocation';

export interface NavItem {
  view: StudentView;
  label: string;
  icon: IconType;
}

/** The four primary destinations (DESIGN.md 3.2). The course graph is secondary on purpose. */
export const STUDENT_NAV: NavItem[] = [
  { view: 'path', label: 'Path', icon: HiOutlineMap },
  { view: 'ask', label: 'Ask', icon: HiOutlineChatBubbleOvalLeft },
  { view: 'review', label: 'Review', icon: HiOutlineRectangleStack },
  { view: 'progress', label: 'Progress', icon: HiOutlineChartBar },
];
