import { extendTheme } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: true,
};

const colors = {
  brand: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#6FA374', // Moss Green (Primary)
    600: '#578A5C', // Darker Moss (Hover)
    700: '#388E3C',
    800: '#2E7D32',
    900: '#1B5E20',
    neon: '#A78BFA', // Lavender
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
      sm: {
        default: '0 1px 2px 0 rgba(167, 139, 250, 0.5)',
        _dark: 'none',
      },
      base: {
        default: '0 1px 3px 0 rgba(167, 139, 250, 0.6), 0 1px 2px 0 rgba(167, 139, 250, 0.3)',
        _dark: 'none',
      },
      md: {
        default: '0 4px 6px -1px rgba(167, 139, 250, 0.6), 0 2px 4px -1px rgba(167, 139, 250, 0.3)',
        _dark: 'none',
      },
      lg: {
        default: '0 10px 15px -3px rgba(167, 139, 250, 0.6), 0 4px 6px -2px rgba(167, 139, 250, 0.3)',
        _dark: 'none',
      },
      xl: {
        default: '0 20px 25px -5px rgba(167, 139, 250, 0.6), 0 10px 10px -5px rgba(167, 139, 250, 0.3)',
        _dark: 'none',
      },
    }
  },
  components: {
    Card: {
      baseStyle: (props) => ({
        container: {
          borderColor: mode('rgba(167, 139, 250, 0.3)', '#30363D')(props),
          borderWidth: '1px',
          boxShadow: 'md',
          bg: mode('white', '#161B22')(props),
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
            boxShadow: mode('md', 'none')(props),
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
            bg: mode('white', '#0D1117')(props),
            borderColor: mode('inherit', '#30363D')(props),
            _focus: {
              borderColor: 'brand.neon',
              boxShadow: '0 0 0 1px #A78BFA',
            },
          },
        }),
      },
    },
    Select: {
      variants: {
        outline: (props) => ({
          field: {
            bg: mode('white', '#0D1117')(props),
            borderColor: mode('inherit', '#30363D')(props),
            _focus: {
              borderColor: 'brand.neon',
              boxShadow: '0 0 0 1px #A78BFA',
            },
          },
        }),
      },
    },
    Menu: {
      baseStyle: (props) => ({
        list: {
          bg: mode('white', '#161B22')(props),
          borderColor: mode('brand.neon', '#30363D')(props),
          boxShadow: 'md',
          borderWidth: '1px',
        },
      }),
    },
    Modal: {
      baseStyle: (props) => ({
        overlay: {
          bg: 'blackAlpha.600',
          backdropFilter: 'blur(4px)',
        },
        dialog: {
          bg: mode('white', '#161B22')(props),
          borderColor: mode('brand.neon', '#30363D')(props),
          boxShadow: 'lg',
          borderWidth: '1px',
        },
      }),
    },
    Drawer: {
      baseStyle: (props) => ({
        overlay: {
          bg: 'blackAlpha.600',
          backdropFilter: 'blur(4px)',
        },
        dialog: {
          bg: mode('white', '#161B22')(props),
          borderColor: mode('brand.neon', '#30363D')(props),
          boxShadow: 'lg',
        },
      }),
    },
    Popover: {
      baseStyle: (props) => ({
        content: {
           bg: mode('white', '#161B22')(props),
           borderColor: mode('brand.neon', '#30363D')(props),
           boxShadow: 'md',
           borderWidth: '1px',
        }
      })
    }
  },
  styles: {
    global: (props) => ({
      body: {
        bg: mode('gray.50', '#0D1117')(props),
        color: mode('gray.800', '#C9D1D9')(props),
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
