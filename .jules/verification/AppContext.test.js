
const React = require('react');
const { render } = require('@testing-library/react');
const { AppProvider, useApp } = require('../../frontend/src/context/AppContext');

// Helper component to expose dispatch for testing
const TestComponent = () => {
  const { state, dispatch } = useApp();
  return (
    <div>
      <span data-testid="mode">{state.whatsappStatus.mode}</span>
      <span data-testid="qrcode">{state.whatsappStatus.qrCode ? 'HAS_QR' : 'NO_QR'}</span>
      <button onClick={() => dispatch({ type: 'SET_QR_CODE', payload: 'mock-qr' })}>Set QR</button>
      <button onClick={() => dispatch({ type: 'SET_WHATSAPP_STATUS', payload: { isConnected: false, mode: 'Desconectado' } })}>Disconnect</button>
    </div>
  );
};

// Mock dependencies
jest.mock('../../frontend/src/services/api', () => ({
  businessAPI: {
    getConfig: jest.fn().mockResolvedValue({ data: {} })
  }
}));

// Mock Socket.io
jest.mock('socket.io-client', () => ({
  io: () => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn()
  })
}));

describe('AppContext Reducer Logic', () => {
  // We need to bypass the React internal state updates which are async,
  // or use testing-library user-events.
  // Ideally, we test the reducer in isolation if it was exported, but it's not.
  // So we test via component interaction.

  // Note: Since we are running in node environment without full browser API,
  // we rely on JSDOM which is provided by jest-environment-jsdom (usually).
  // But our environment setup here might be tricky.
  // Let's try a simple unit test of logic if possible.

  // Since we cannot easily import the reducer function (it's not exported),
  // we will trust the component integration test.

  test('should clear QR code when status becomes Disconnected', () => {
      // Manual test via component not feasible easily without setting up events.
      // But we can verify the logic changes we made by reading the file?
      // No, we already did that.

      // Let's write a "Simulated Reducer Test" by extracting the logic if we could,
      // but simpler: Just run a basic react test.

      // IMPORTANT: "render" from @testing-library/react works in JSDOM.

      const { getByText, getByTestId } = render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      // 1. Set QR Code
      getByText('Set QR').click();
      expect(getByTestId('qrcode').textContent).toBe('HAS_QR');

      // 2. Disconnect
      getByText('Disconnect').click();

      // 3. Assert QR is gone
      expect(getByTestId('mode').textContent).toBe('Desconectado');
      expect(getByTestId('qrcode').textContent).toBe('NO_QR');
  });
});
