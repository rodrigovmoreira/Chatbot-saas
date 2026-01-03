
import os
import time
from playwright.sync_api import sync_playwright

def verify_theme(page):
    print("Navigating to Dashboard...")
    # Inject auth token to bypass login
    page.goto("http://localhost:3000/login")

    # Mocking localStorage for authentication
    page.evaluate("""() => {
        localStorage.setItem('token', 'fake-jwt-token');
        localStorage.setItem('user', JSON.stringify({
            id: 'user123',
            name: 'Rodrigo Vasconcelos Moreira',
            email: 'rodrigo@example.com',
            avatarUrl: 'https://via.placeholder.com/150'
        }));
    }""")

    # Navigate to dashboard
    page.goto("http://localhost:3000/dashboard")

    # Wait for the dashboard to load.
    print("Selecting Conexão & Geral tab...")
    page.get_by_text("Conexão & Geral").first.click()

    # Wait for the card to be visible
    page.wait_for_selector("text=Status do WhatsApp")

    # Allow some time for styles to apply
    time.sleep(2)

    # Take screenshot in Light Mode
    # Using relative path to current working directory (repo root)
    print("Taking Light Mode screenshot...")
    page.screenshot(path="verification/dashboard_neon_light_final.png")

    # Toggle Dark Mode
    print("Toggling Dark Mode...")
    page.evaluate("localStorage.setItem('chakra-ui-color-mode', 'dark')")
    page.reload()

    # Wait for reload
    page.wait_for_selector("text=Status do WhatsApp")
    time.sleep(2)

    print("Taking Dark Mode screenshot...")
    page.screenshot(path="verification/dashboard_neon_dark_final.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        try:
            verify_theme(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
