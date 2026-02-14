import React from 'react';
import { Spinner as InkSpinner, type SpinnerProps as InkSpinnerProps } from '@inkjs/ui';

interface SpinnerProps {
  type?: InkSpinnerProps['type'];
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ type = 'dots', label = 'Loading...' }) => {
  return <InkSpinner type={type} label={label} />;
};
