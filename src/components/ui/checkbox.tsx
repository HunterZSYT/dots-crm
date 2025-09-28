import * as MyCheckbox from '@radix-ui/react-checkbox';
import { CheckIcon } from '@radix-ui/react-icons';

interface MyCheckboxProps {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;
  label: string;
}

export const Checkbox = ({ checked, onCheckedChange, label }: MyCheckboxProps) => (
  <div className="flex items-center space-x-2">
    <MyCheckbox.Root
      className="
        CheckboxRoot
        flex h-5 w-5 items-center justify-center 
        rounded border border-gray-400 
        bg-white 
        hover:bg-gray-100
        data-[state=checked]:bg-blue-600
        data-[state=checked]:border-blue-600
        focus:outline-none focus:ring-2 focus:ring-blue-400
        transition
      "
      checked={checked}
      onCheckedChange={onCheckedChange}
      id="my-checkbox"
    >
      <MyCheckbox.Indicator className="text-white">
        <CheckIcon className="h-4 w-4" />
      </MyCheckbox.Indicator>
    </MyCheckbox.Root>
    <label
      className="text-sm font-medium text-gray-700 cursor-pointer"
      htmlFor="my-checkbox"
    >
      {label}
    </label>
  </div>
);
