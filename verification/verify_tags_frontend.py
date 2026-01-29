from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock APIs
        # 1. Config
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"aiResponseMode": "whitelist", "aiWhitelistTags": ["ExistingTag"], "aiBlacklistTags": [], "botName": "TestBot", "tone": "Friendly"}'
        ))

        # 2. Tags Endpoint
        page.route("**/api/contacts/tags", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='["VIP", "Lead", "ExistingTag"]'
        ))

        # 3. Other dependencies
        page.route("**/api/business/presets", lambda route: route.fulfill(status=200, body='[]'))
        page.route("**/api/business/custom-prompts", lambda route: route.fulfill(status=200, body='[]'))
        page.route("**/api/dashboard/summary", lambda route: route.fulfill(status=200, body='{}'))
        page.route("**/api/whatsapp/status", lambda route: route.fulfill(status=200, body='{}'))
        page.route("**/api/auth/login", lambda route: route.fulfill(status=200, body='{"token": "fake", "user": {"name": "Test"}}'))

        # Set LocalStorage (Fake Login)
        print("Navigating to Login to set token...")
        page.goto("http://localhost:3000/login")

        page.evaluate("""
            localStorage.setItem('token', 'fake-token');
            localStorage.setItem('user', JSON.stringify({ name: 'Test User', email: 'test@test.com' }));
        """)

        # Go to Dashboard
        print("Navigating to Dashboard...")
        page.goto("http://localhost:3000/dashboard")

        # Wait for Sidebar
        print("Waiting for Sidebar...")
        # Check if we are on dashboard
        expect(page).to_have_url("http://localhost:3000/dashboard")

        print("Navigating to Intelligence Tab...")
        # Use get_by_role if possible, or text
        # Sidebar items might be hidden in mobile view if window is small.
        # Ensure window size is large enough.
        page.set_viewport_size({"width": 1280, "height": 720})

        page.get_by_text("Inteligência & Nicho").click()

        # Wait for input
        print("Waiting for input...")
        input_locator = page.get_by_placeholder("Digite para buscar ou criar tag...")
        expect(input_locator).to_be_visible()

        # Test 1: Autocomplete existing tag
        print("Testing Autocomplete 'VI' -> 'VIP'")
        input_locator.fill("VI")

        # Check suggestions
        # Expect "VIP"
        vip_option = page.get_by_text("VIP", exact=True)
        expect(vip_option).to_be_visible()

        page.screenshot(path="verification/tags_suggestion.png")
        print("Screenshot saved: tags_suggestion.png")

        # Select VIP
        vip_option.click()

        # Verify added
        expect(page.get_by_text("VIP").first).to_be_visible()

        # Test 2: Create new tag
        print("Testing Create New Tag 'SuperNew'")
        input_locator.fill("SuperNew")

        create_option = page.get_by_text('Criar nova tag: "SuperNew"')
        expect(create_option).to_be_visible()

        page.screenshot(path="verification/tags_create.png")
        print("Screenshot saved: tags_create.png")

        create_option.click()

        expect(page.get_by_text("SuperNew").first).to_be_visible()

        # Final Screenshot
        page.screenshot(path="verification/final_result.png")
        print("Screenshot saved: final_result.png")

        browser.close()

if __name__ == "__main__":
    run()
