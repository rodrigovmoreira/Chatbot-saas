import React from 'react';
import { useColorMode, IconButton, Tooltip } from '@chakra-ui/react';
import { FaSun, FaMoon } from 'react-icons/fa';

export default function ColorModeToggle(props) {
  const { colorMode, toggleColorMode } = useColorMode();
  return (
    <Tooltip label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}>
      <IconButton
        aria-label="Toggle dark mode"
        icon={colorMode === 'light' ? <FaSun /> : <FaMoon />}
        onClick={toggleColorMode}
        variant="ghost"
        color="current"
        {...props}
      />
    </Tooltip>
  );
}
