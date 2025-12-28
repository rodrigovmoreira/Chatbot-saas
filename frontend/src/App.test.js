import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import App from './App';
import theme from './theme';

// Mock getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    value: () => ({
        getPropertyValue: (prop) => {
            return '';
        }
    })
});

test('renders landing page by default', () => {
    // Rely on setupTests.js for matchMedia
  render(
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  );

  const linkElement = screen.getByText(/Automate your WhatsApp Service with AI/i);
  expect(linkElement).toBeInTheDocument();
});
