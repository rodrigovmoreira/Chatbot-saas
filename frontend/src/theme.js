import { extendTheme } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';

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
    neon: '#A801E5',
  },
};

const fonts = {
  heading: '"Segoe UI", sans-serif',
  body: '"Segoe UI", sans-serif',
};

const theme = extendTheme({
  config,
  colors,
  fonts,
  semanticTokens: {
    shadows: {
      base: {
        default: '0 1px 3px 0 rgba(168, 1, 229, 0.15), 0 1px 2px 0 rgba(168, 1, 229, 0.1)',
        _dark: '0px 0px 12px 2px #A801E5',
      },
      md: {
        default: '0 4px 6px -1px rgba(168, 1, 229, 0.15), 0 2px 4px -1px rgba(168, 1, 229, 0.1)',
        _dark: '0px 0px 16px 3px #A801E5',
      },
      lg: {
        default: '0 10px 15px -3px rgba(168, 1, 229, 0.15), 0 4px 6px -2px rgba(168, 1, 229, 0.1)',
        _dark: '0px 0px 20px 4px #A801E5',
      },
      xl: {
        default: '0 20px 25px -5px rgba(168, 1, 229, 0.15), 0 10px 10px -5px rgba(168, 1, 229, 0.1)',
        _dark: '0px 0px 24px 5px #A801E5',
      },
    }
  },
  components: {
    Card: {
      baseStyle: (props) => ({
        container: {
          borderColor: mode('gray.200', 'whiteAlpha.300')(props),
          borderWidth: '1px',
          boxShadow: 'base',
          _dark: {
            borderColor: 'rgba(168, 1, 229, 0.3)',
          },
        }
      })
    },
    Button: {
      variants: {
        brand: (props) => ({
          bg: 'brand.500',
          color: 'white',
          _hover: {
            bg: 'brand.600',
            boxShadow: mode('md', '0 0 12px 2px #A801E5')(props),
            _disabled: {
              bg: 'brand.500',
            }
          },
          _active: {
            bg: 'brand.700',
          }
        }),
      },
    },
    Input: {
      variants: {
        outline: (props) => ({
          field: {
            _focus: {
              borderColor: 'brand.neon',
              boxShadow: '0 0 0 1px #A801E5',
            },
          },
        }),
      },
    },
    Select: {
      variants: {
        outline: (props) => ({
          field: {
            _focus: {
              borderColor: 'brand.neon',
              boxShadow: '0 0 0 1px #A801E5',
            },
          },
        }),
      },
    },
  },
  styles: {
    global: (props) => ({
      body: {
        bg: mode('gray.50', 'gray.900')(props),
        transitionProperty: 'background-color, color',
        transitionDuration: '200ms',
      },
      '*': {
        transitionProperty: 'background-color, border-color, color, box-shadow',
        transitionDuration: '200ms',
      },
    }),
  },
});

export default theme;
