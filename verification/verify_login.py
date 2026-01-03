from playwright.sync_api import sync_playwright

def verify_login_redesign():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant permissions for clipboard if necessary, but mainly just load page
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        try:
            # Navigate to the login page (default route usually redirects to /login if unauth)
            # The frontend runs on 3000 by default (create-react-app)
            page.goto("http://localhost:3000/login")

            # Wait for key elements to ensure page is loaded
            page.wait_for_selector('text=Calango Bot')
            page.wait_for_selector('text=Automação Inteligente para WhatsApp')

            # Take a screenshot of the desktop view
            page.screenshot(path="verification/login_desktop.png")
            print("Desktop screenshot taken.")

            # Test Mobile Viewport
            page.set_viewport_size({"width": 375, "height": 812})
            page.reload()
            page.wait_for_selector('text=Calango Bot')
            # On mobile, the logo192 should be visible inside the form area
            # page.wait_for_selector('img[alt="Calango Bot"]')

            page.screenshot(path="verification/login_mobile.png")
            print("Mobile screenshot taken.")

        except Exception as e:
            print(f"Error during verification: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_login_redesign()