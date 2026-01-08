from playwright.sync_api import sync_playwright
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        # Inject mock auth data
        context.add_init_script("""
            localStorage.setItem('token', 'mock-token');
            localStorage.setItem('user', JSON.stringify({
                id: 'user123',
                name: 'Test User',
                email: 'test@example.com',
                avatarUrl: 'https://via.placeholder.com/150'
            }));
        """)

        page = context.new_page()

        # Intercept and mock API calls
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"_id": "business123", "name": "Test Business"}'
        ))

        page.route("**/api/business/conversations", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='[{"_id": "c1", "name": "Contact 1", "lastInteraction": "2023-10-27T10:00:00Z", "channel": "whatsapp"}, {"_id": "c2", "name": "Contact 2", "lastInteraction": "2023-10-27T09:30:00Z", "channel": "web"}]'
        ))

        page.route("**/api/business/conversations/*/messages", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='[{"_id": "m1", "role": "user", "content": "Hello", "timestamp": "2023-10-27T10:00:00Z"}, {"_id": "m2", "role": "bot", "content": "Hi there!", "timestamp": "2023-10-27T10:00:05Z"}]'
        ))

        page.route("**/api/whatsapp/status", lambda route: route.fulfill(status=200, body='{"isConnected": true, "mode": "Conectado"}'))
        page.route("**/api/appointments*", lambda route: route.fulfill(status=200, body='[]'))
        page.route("**/api/business/presets", lambda route: route.fulfill(status=200, body='[]'))
        page.route("**/api/business/custom-prompts", lambda route: route.fulfill(status=200, body='[]'))

        # Go to Dashboard
        try:
            print("Navigating to Dashboard...")
            page.goto("http://localhost:3000/dashboard")

            # Click the Live Chat tab (index 4)
            # Find it by text
            print("Clicking Live Chat tab...")
            page.click("text=Live Chat")

            # Wait for any text to indicate load
            print("Waiting for conversations...")
            page.wait_for_selector("text=Conversas", timeout=10000)
            print("Dashboard loaded.")

            # Click on first contact
            print("Clicking Contact 1...")
            page.click("text=Contact 1")

            # Wait for messages
            print("Waiting for messages...")
            page.wait_for_selector("text=Hi there!", timeout=5000)

            # Take screenshot
            screenshot_path = os.path.join(os.getcwd(), "verification", "live_chat_verified.png")
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
