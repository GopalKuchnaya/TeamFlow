import { IconButton, Input, InputGroup, type InputProps } from '@chakra-ui/react';
import { forwardRef, useState } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';

/** Password field with an accessible show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup
      endElement={
        <IconButton
          type="button"
          variant="ghost"
          size="xs"
          me="-2"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => { setVisible((value) => !value); }}
        >
          {visible ? <LuEyeOff /> : <LuEye />}
        </IconButton>
      }
    >
      <Input ref={ref} type={visible ? 'text' : 'password'} {...props} />
    </InputGroup>
  );
});
