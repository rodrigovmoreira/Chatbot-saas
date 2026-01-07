from playwright.sync_api import sync_playwright, expect
import time

def verify_mobile_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()

        # Mock APIs
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200, content_type="application/json", body='{"_id": "test_id", "businessName": "Teste Mobile", "products": [], "menuOptions": [], "prompts": {}}'
        ))
        page.route("**/api/auth/verify", lambda route: route.fulfill(
            status=200, content_type="application/json", body='{"user": {"name": "Tester", "email": "test@example.com"}, "token": "fake_token"}'
        ))

        # Login
        page.goto("http://localhost:3000/login")
        page.evaluate("() => { localStorage.setItem('token', 'fake_token'); localStorage.setItem('user', JSON.stringify({name: 'Tester'})); }")

        # Dashboard
        page.goto("http://localhost:3000/dashboard")
        page.wait_for_timeout(3000)

        # 1. Open Drawer
        hamburger = page.get_by_label("open menu")
        hamburger.click()
        page.wait_for_timeout(1000)

        # 2. Click Live Chat in Drawer
        # Target the one inside the Drawer Content (Chakra Modal)
        # We can use last() or filter by visibility, as the sidebar one should be hidden on mobile
        page.get_by_text("Live Chat").filter(has_text="Live Chat").last.click()
        page.wait_for_timeout(2000)

        # 3. Verify Live Chat Mobile Layout (List View)
        page.screenshot(path="/home/jules/verification/mobile_livechat_list.png")

        # Mock conversations
        page.route("**/api/business/conversations", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[{"_id": "c1", "name": "Cliente Teste", "channel": "whatsapp", "lastInteraction": "2023-10-27T10:00:00Z"}]'
        ))

        # Reload to ensure conversation list is populated
        page.reload()
        page.wait_for_timeout(3000)

        # Re-navigate to Live Chat (since reload resets to tab 0)
        hamburger = page.get_by_label("open menu")
        hamburger.click()
        page.wait_for_timeout(1000)
        page.get_by_text("Live Chat").filter(has_text="Live Chat").last.click()
        page.wait_for_timeout(2000)

        # Click on the conversation
        page.get_by_text("Cliente Teste").click()
        page.wait_for_timeout(1000)

        # 4. Verify Chat View (Back button must be visible)
        back_button = page.get_by_label("Voltar")
        if back_button.is_visible():
            print("Back button is visible")
        else:
            print("Back button NOT visible")

        page.screenshot(path="/home/jules/verification/mobile_livechat_view.png")

        # 5. Click Back
        back_button.click()
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/mobile_livechat_back.png")

        browser.close()

if __name__ == "__main__":
    verify_mobile_layout()
