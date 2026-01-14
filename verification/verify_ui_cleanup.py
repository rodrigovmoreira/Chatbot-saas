from playwright.sync_api import sync_playwright, expect
import time

def mock_apis(page):
    page.route("**/api/business/config", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"_id": "debug_id_should_be_hidden", "businessName": "UI Test", "availableTags": []}'
    ))

    # Mock conversation with phone number as name to test cleanup
    # And mock one with proper name
    conversations = """
    [
        {
            "_id": "c1",
            "name": "5511999999999",
            "phone": "5511999999999",
            "channel": "whatsapp",
            "lastInteraction": "2023-10-27T10:00:00.000Z",
            "tags": []
        },
        {
            "_id": "c2",
            "name": "John Doe",
            "phone": "5511888888888",
            "channel": "whatsapp",
            "lastInteraction": "2023-10-27T10:05:00.000Z",
            "tags": ["VIP"]
        }
    ]
    """
    page.route("**/api/business/conversations", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=conversations
    ))

    page.route("**/api/business/conversations/*/messages", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[]'
    ))

    page.route("**/api/whatsapp/status", lambda route: route.fulfill(
        status=200, body='{"status": "CONNECTED"}'
    ))

def verify_ui_cleanup():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        mock_apis(page)

        page.add_init_script("""
            localStorage.setItem('token', 'mock_token');
            localStorage.setItem('user', JSON.stringify({
                name: 'Agent',
                email: 'agent@test.com',
                company: 'Test Corp'
            }));
        """)

        try:
            print("Navigating to dashboard...")
            page.goto("http://localhost:3000/dashboard")
            page.wait_for_load_state("networkidle")

            print("Clicking Live Chat...")
            page.get_by_text("Live Chat").click()
            time.sleep(2) # Wait for tab to load

            # 1. Verify "Debug ID" is gone
            debug_text = page.get_by_text("Debug ID:")
            if debug_text.count() > 0 and debug_text.is_visible():
                print("❌ FAILED: 'Debug ID' is still visible!")
                exit(1)
            else:
                print("✅ 'Debug ID' is not visible.")

            # 2. Verify Contact List Cleanup
            # Check for John Doe
            page.get_by_text("John Doe").wait_for()

            # Check if phone number "5511888888888" is visible?
            # It should NOT be visible.
            phone_text = page.get_by_text("5511888888888")
            if phone_text.count() > 0 and phone_text.is_visible():
                 # If it is visible, it might be because I missed something or my assumption about rendering is wrong.
                 # But in LiveChatTab.jsx I removed the line displaying phone/sessionId.
                 # Unless it is displayed in the "name" slot? No, name is "John Doe".
                 print("❌ FAILED: Phone number is visible in list (should be hidden per cleanup).")
            else:
                 print("✅ Phone number is hidden.")

            page.screenshot(path="verification/ui_cleanup.png")
            print("Captured verification/ui_cleanup.png")

        except Exception as e:
            print(f"Error: {e}")
            exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_ui_cleanup()
