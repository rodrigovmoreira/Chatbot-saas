import { extendTheme } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: true,
};

const colors = {
  // GitHub-like Dark Mode Palette
  github: {
    bg: '#0D1117',        // Deepest Slate (Global Bg)
    surface: '#161B22',   // Slightly lighter slate (Cards/Sidebar)
    surfaceHigh: '#21262d', // For elevated elements on top of surface
    border: '#30363D',    // Subtle separation
    text: '#E6EDF3',      // Off-white / Silver
    textMuted: '#8B949E', // Muted Gray
  },
  // Dusty Lavender Brand Scale (Primary)
  brand: {
    50: '#F3E5F5',
    100: '#E1BEE7',
    200: '#CE93D8',
    300: '#B794F4', // Purple 300
    400: '#A78BFA', // Suggested Pastel
    500: '#9F7AEA', // Dusty Lavender (Primary) - Purple 400
    600: '#805AD5', // Purple 500
    700: '#6B46C1', // Purple 600
    800: '#553C9A',
    900: '#44337A',
  },
  // Sage/Moss Green Scale (Success/Action)
  green: {
    50: '#F0FFF4',
    100: '#C6F6D5',
    200: '#9AE6B4', // Light Sage
    300: '#68D391',
    400: '#48BB78',
    500: '#68A063', // Sage Green (Success) - requested
    600: '#2F855A',
    700: '#276749',
    800: '#22543D',
    900: '#1C4532',
  }
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
        default: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        _dark: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
      },
      base: {
        default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        _dark: '0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px 0 rgba(0, 0, 0, 0.4)',
      },
      md: {
        default: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        _dark: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.4)',
      },
      lg: {
        default: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        _dark: '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.5)',
      },
      xl: {
        default: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        _dark: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
      },
    }
  },
  components: {
    Card: {
      baseStyle: (props) => ({
        container: {
          borderColor: mode('gray.200', 'github.border')(props),
          borderWidth: '1px',
          boxShadow: 'md',
          bg: mode('white', 'github.surface')(props),
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
            boxShadow: 'md',
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
              borderColor: 'brand.500',
              boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
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
              borderColor: 'brand.500',
              boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
            },
          },
        }),
      },
    },
    Menu: {
      baseStyle: (props) => ({
        list: {
          bg: mode('white', 'github.surface')(props),
          borderColor: mode('gray.200', 'github.border')(props),
          boxShadow: 'md',
          borderWidth: '1px',
        },
        item: {
          bg: mode('white', 'github.surface')(props),
          _focus: {
            bg: mode('gray.100', 'github.surfaceHigh')(props),
          },
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
          bg: mode('white', 'github.surface')(props),
          borderColor: mode('gray.200', 'github.border')(props),
          boxShadow: 'xl',
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
          bg: mode('white', 'github.surface')(props),
          borderColor: mode('gray.200', 'github.border')(props),
          boxShadow: 'xl',
        },
      }),
    },
    Popover: {
      baseStyle: (props) => ({
        content: {
           bg: mode('white', 'github.surface')(props),
           borderColor: mode('gray.200', 'github.border')(props),
           boxShadow: 'md',
           borderWidth: '1px',
        }
      })
    }
  },
  styles: {
    global: (props) => ({
      body: {
        bg: mode('gray.50', 'github.bg')(props),
        color: mode('gray.800', 'github.text')(props),
        transitionProperty: 'background-color, color',
        transitionDuration: '200ms',
      },
      '*': {
        transitionProperty: 'background-color, border-color, color, box-shadow',
        transitionDuration: '200ms',
        borderColor: mode('gray.200', 'github.border')(props),
      },
    }),
  },
});

export default theme;
