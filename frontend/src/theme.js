// frontend/src/theme.js
import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: true,
};

const colors = {
  brand: {
    50: '#f0fff4',
    100: '#c6f6d5',
    200: '#9ae6b4',
    300: '#68d391',
    400: '#48bb78',
    500: '#25D366',
    600: '#128C7E',
    700: '#065f46',
    800: '#064e3b',
    900: '#022c22',
  },
};

const fonts = {
  heading: '"Segoe UI", sans-serif',
  body: '"Segoe UI", sans-serif',
};

const styles = {
  global: {
    body: {
      transitionProperty: 'background-color, color',
      transitionDuration: '200ms',
    },
    '*': {
      transitionProperty: 'background-color, border-color, color',
      transitionDuration: '200ms',
    },
  },
};

const theme = extendTheme({ config, colors, fonts, styles });

export default theme;
