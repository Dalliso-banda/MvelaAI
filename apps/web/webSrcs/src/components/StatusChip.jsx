import { Chip } from '@mui/material';

const MAP = {
  ai_resolved: ['AI resolved', 'success', 'filled'], escalated: ['Escalated', 'warning', 'filled'],
  human_resolved: ['Human resolved', 'default', 'outlined'], open: ['In progress', 'info', 'outlined'],
};
export default function StatusChip({ status }) {
  const [label, color, variant] = MAP[status] || [status, 'default', 'outlined'];
  return <Chip label={label} size="small" color={color} variant={variant} sx={{ height: 24 }} />;
}
export const PriorityChip = ({ priority }) => (
  <Chip label={priority} size="small" color={priority === 'high' ? 'error' : priority === 'low' ? 'default' : 'warning'} variant={priority === 'normal' ? 'outlined' : 'filled'} sx={{ height: 22, textTransform: 'capitalize' }} />
);
