import React from 'react';
import SelectInput from 'ink-select-input';

export interface SelectItem {
  label: string;
  value: string;
}

interface SelectProps {
  items: SelectItem[];
  onSelect: (item: SelectItem) => void;
}

export const Select: React.FC<SelectProps> = ({ items, onSelect }) => {
  return <SelectInput items={items} onSelect={onSelect} />;
};
