from playwright.sync_api import sync_playwright

def verify_theme():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(color_scheme='dark')
        page = context.new_page()

        page.add_init_script("""
            localStorage.setItem('chakra-ui-color-mode', 'dark');
            localStorage.setItem('token', 'fake-token');
            localStorage.setItem('user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }));
        """)

        try:
            page.goto("http://localhost:3000/dashboard")
            page.wait_for_load_state("networkidle")
            page.wait_for_selector("text=Dados da Empresa", timeout=15000)
            page.screenshot(path="verification/dashboard_neon.png")
            print("Dashboard screenshot captured.")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_theme()
