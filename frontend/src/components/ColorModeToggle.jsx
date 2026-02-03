import React from 'react';
import { useColorMode, IconButton, Tooltip } from '@chakra-ui/react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';

export default function ColorModeToggle(props) {
  const { colorMode, toggleColorMode } = useColorMode();
  return (
    <Tooltip label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}>
      <IconButton
        aria-label="Toggle dark mode"
        icon={colorMode === 'light' ? <SunIcon /> : <MoonIcon />}
        onClick={toggleColorMode}
        variant="ghost"
        color="current"
        {...props}
      />
    </Tooltip>
  );
}
