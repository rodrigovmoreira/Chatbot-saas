import os
import json
from playwright.sync_api import sync_playwright

def verify_smart_loader():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Define mock user and token
        user = {
            "id": "123",
            "name": "Test User",
            "company": "Test Company",
            "email": "test@example.com"
        }
        token = "fake-token"

        # Mock API calls
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({"data": {"businessName": "Test Biz", "aiGlobalDisabled": False}})
        ))

        # Navigate to Dashboard with mock localStorage
        # We need to set localStorage before the app logic runs, but we can't do it before page.goto on a new page easily
        # except via add_init_script
        page.add_init_script(f"""
            localStorage.setItem('token', '{token}');
            localStorage.setItem('user', '{json.dumps(user)}');
        """)

        print("Navigating to Dashboard...")
        try:
            page.goto("http://localhost:3000/dashboard", timeout=30000)
        except Exception as e:
            print(f"Navigation failed: {e}")
            # If navigation fails (e.g. server not ready), we can't proceed
            return

        print("Waiting for page load...")
        page.wait_for_timeout(3000)

        # Click on "Conexão & Negócio" tab
        print("Clicking Connection tab...")
        try:
            page.get_by_text("Conexão & Negócio").click()
        except Exception as e:
            print(f"Could not click tab: {e}")
            # Maybe already there or sidebar hidden?
            # Dashboard default initialTab is 0 (Overview).

        page.wait_for_timeout(2000)

        # Take screenshot
        screenshot_path = "/home/jules/verification/smart_loader.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    os.makedirs("/home/jules/verification", exist_ok=True)
    verify_smart_loader()
