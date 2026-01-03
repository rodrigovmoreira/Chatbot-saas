from playwright.sync_api import sync_playwright

def verify_theme_refined():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # 1. Dark Mode Verification
        context_dark = browser.new_context(color_scheme='dark')
        page_dark = context_dark.new_page()
        page_dark.add_init_script("""
            localStorage.setItem('chakra-ui-color-mode', 'dark');
            localStorage.setItem('token', 'fake-token');
            localStorage.setItem('user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }));
        """)

        try:
            print("Capturing Dark Mode...")
            page_dark.goto("http://localhost:3000/dashboard")
            page_dark.wait_for_load_state("networkidle")
            page_dark.wait_for_selector("text=Dados da Empresa", timeout=15000)
            page_dark.screenshot(path="verification/dashboard_neon_dark_refined.png")
            print("Dark Mode screenshot captured.")
        except Exception as e:
            print(f"Dark Mode Error: {e}")

        # 2. Light Mode Verification
        context_light = browser.new_context(color_scheme='light')
        page_light = context_light.new_page()
        page_light.add_init_script("""
            localStorage.setItem('chakra-ui-color-mode', 'light');
            localStorage.setItem('token', 'fake-token');
            localStorage.setItem('user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }));
        """)

        try:
            print("Capturing Light Mode...")
            page_light.goto("http://localhost:3000/dashboard")
            page_light.wait_for_load_state("networkidle")
            page_light.wait_for_selector("text=Dados da Empresa", timeout=15000)
            # Force light mode just in case localStorage isn't picked up instantly by Chakra
            page_light.evaluate("() => { if(localStorage.getItem('chakra-ui-color-mode') !== 'light') { localStorage.setItem('chakra-ui-color-mode', 'light'); window.location.reload(); } }")
            page_light.wait_for_timeout(2000) # Wait for reload if happened

            page_light.screenshot(path="verification/dashboard_neon_light_refined.png")
            print("Light Mode screenshot captured.")
        except Exception as e:
            print(f"Light Mode Error: {e}")

        browser.close()

if __name__ == "__main__":
    verify_theme_refined()
