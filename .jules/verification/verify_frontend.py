
from playwright.sync_api import sync_playwright, expect
import time
import os

def run():
    print("Iniciando verificação do Frontend...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant permissions to avoid issues with clipboard or other APIs if needed
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800}
        )
        page = context.new_page()

        # 1. Bypass Login (Mock LocalStorage)
        print("Acessando aplicação...")
        page.goto("http://localhost:3000/login")

        # Inject fake token
        page.evaluate("""() => {
            localStorage.setItem('token', 'fake-jwt-token');
            localStorage.setItem('user', JSON.stringify({
                userId: 'test-user',
                name: 'Test User',
                email: 'test@example.com',
                avatarUrl: 'https://via.placeholder.com/150'
            }));
        }""")

        # Navigate to Dashboard
        page.goto("http://localhost:3000/dashboard")

        # Wait for dashboard to load (look for specific element)
        try:
            expect(page.get_by_text("Status do WhatsApp")).to_be_visible(timeout=10000)
            print("Dashboard carregado.")
        except:
            print("Dashboard não carregou. Verifique logs.")
            page.screenshot(path=".jules/verification/dashboard_fail.png")
            return

        # 2. Mock State to show QR Code
        # Since we can't easily trigger the backend to generate a real QR without a real phone,
        # we will rely on finding the element IF we could trigger it.
        # HOWEVER, we can try to force the state if we can access internal React state, which is hard.
        # Alternatively, we can assume the backend is running and click 'Ligar Robô'
        # and hope it goes to 'Iniciando...' then 'QRCode'.
        # But without real backend wwebjs logic completing (which requires chrome-headless inside backend),
        # it might just stay on 'Iniciando...'.

        # Let's try to click "Ligar Robô"
        try:
            ligar_btn = page.get_by_role("button", name="Ligar Robô")
            if ligar_btn.is_visible():
                print("Clicando em Ligar Robô...")
                ligar_btn.click()

                # Wait for 'Iniciando...'
                expect(page.get_by_text("Iniciando motor...")).to_be_visible()
                print("Estado 'Iniciando motor...' verificado.")

                # Wait a bit to see if it moves to QR Code (might timeout if backend fails)
                # In this environment, wwebjs might fail to start chrome or take time.
                # If it fails, it shows error. If it succeeds, it shows QR.
                # We mainly want to see the cancel button IF QR appears.

                # To guarantee we see the button, we might need to mock the API response or socket event.
                # Since we can't easily mock socket.io from outside without a proxy,
                # we will screenshot the 'Iniciando...' state and potentially the button if it appears.

                # Wait up to 15 seconds for QR or Error
                time.sleep(5)

        except Exception as e:
            print(f"Erro ao tentar ligar robô: {e}")

        # Screenshot the current state
        page.screenshot(path=".jules/verification/connection_tab.png")
        print("Screenshot salvo em .jules/verification/connection_tab.png")

        browser.close()

if __name__ == "__main__":
    run()
