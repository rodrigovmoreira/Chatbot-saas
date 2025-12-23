// frontend/src/theme.js
import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light', // Começa claro
  useSystemColorMode: false, // Se true, obedece a configuração do Windows/Mac
};

const theme = extendTheme({ config });

export default theme;