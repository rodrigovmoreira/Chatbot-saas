from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 375, "height": 667},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
        )
        page = context.new_page()

        # Mock APIs
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"aiResponseMode": "all", "botName": "TestBot", "tone": "Friendly"}'
        ))
        page.route("**/api/business/conversations", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[]'
        ))
        page.route("**/api/campaigns", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[]'
        ))
        page.route("**/api/contacts", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[]'
        ))
        page.route("**/api/dashboard/summary", lambda route: route.fulfill(status=200, body='{}'))
        page.route("**/api/whatsapp/status", lambda route: route.fulfill(status=200, body='{}'))

        # Set LocalStorage
        print("Navigating to Login to set token...")
        page.goto("http://localhost:3000/login")
        page.evaluate("""
            localStorage.setItem('token', 'fake-token');
            localStorage.setItem('user', JSON.stringify({ name: 'Test User', email: 'test@test.com' }));
        """)

        # Go to Dashboard
        print("Navigating to Dashboard...")
        page.goto("http://localhost:3000/dashboard")

        # 1. Verify Mobile Navigation
        print("Verifying Mobile Nav...")
        # Expect Hamburger Menu
        hamburger = page.get_by_label("open menu")
        expect(hamburger).to_be_visible()

        # Take screenshot of Dashboard (Mobile)
        page.screenshot(path="verification/mobile_dashboard.png")
        print("Screenshot saved: mobile_dashboard.png")

        # 2. Open Sidebar
        print("Opening Sidebar...")
        hamburger.click()

        # Wait for drawer content
        # Scope to dialog (Drawer)
        print("Navigating to Campaigns...")
        drawer = page.get_by_role("dialog")
        expect(drawer).to_be_visible()
        drawer.get_by_text("Campanhas").click()

        # Wait for Campaign Tab to load
        expect(page.get_by_role("button", name="Nova Campanha")).to_be_visible()

        page.screenshot(path="verification/mobile_campaigns.png")
        print("Screenshot saved: mobile_campaigns.png")

        # 3. Navigate to Live Chat
        print("Navigating to Live Chat...")
        hamburger.click() # Re-open sidebar

        # Scope to dialog (Drawer)
        drawer = page.get_by_role("dialog")
        expect(drawer).to_be_visible()

        drawer.get_by_text("Chat Ao vivo").click()

        # Wait for Live Chat
        expect(page.get_by_text("Chats")).to_be_visible()

        page.screenshot(path="verification/mobile_livechat.png")
        print("Screenshot saved: mobile_livechat.png")

        browser.close()

if __name__ == "__main__":
    run()
